import httpx
import time
import os
from typing import TypedDict, Optional
from dataclasses import dataclass
from langgraph.graph import StateGraph, END


@dataclass
class LoadBalancerConfig:
    max_concurrent: int = 3
    min_interval_seconds: float = 1.0
    timeout_seconds: float = 60.0
    ollama_url: str = "http://localhost:11434/api/generate"
    model_name: str = "llava:latest"
    
    @classmethod
    def from_env(cls) -> 'LoadBalancerConfig':
        """Create config from environment variables"""
        return cls(
            max_concurrent=int(os.getenv('LB_MAX_CONCURRENT', '3')),
            min_interval_seconds=float(os.getenv('LB_MIN_INTERVAL', '1.0')),
            timeout_seconds=float(os.getenv('OLLAMA_TIMEOUT', '60.0')),
            ollama_url=os.getenv('OLLAMA_URL', 'http://localhost:11434/api/generate'),
            model_name=os.getenv('OLLAMA_MODEL', 'llava:latest')
        )


class LoadBalancer:
    def __init__(self, config: LoadBalancerConfig):
        self.config = config
        self._processing_count = 0
        self._last_process_time = 0.0
    
    def can_process(self) -> bool:
        return self._processing_count < self.config.max_concurrent
    
    def should_rate_limit(self) -> bool:
        current_time = time.time()
        return current_time - self._last_process_time < self.config.min_interval_seconds
    
    def start_processing(self):
        self._processing_count += 1
        self._last_process_time = time.time()
    
    def end_processing(self):
        self._processing_count = max(0, self._processing_count - 1)


class State(TypedDict):
    image_base64: str
    prompt: str
    result: str
    priority: int
    should_process: bool


# Initialize load balancer with environment-based config
_load_balancer = LoadBalancer(LoadBalancerConfig.from_env())


async def load_balancer_node(state: State) -> State:
    """Load balancing with configurable traffic control"""
    if not _load_balancer.can_process():
        state["should_process"] = False
        state["result"] = "Request dropped - system busy"
        return state
    
    if _load_balancer.should_rate_limit():
        state["priority"] = 2  # Lower priority for rapid requests
    else:
        state["priority"] = 1  # Normal priority
    
    state["should_process"] = True
    return state


async def llava_node(state: State) -> State:
    """LLaVA processing node"""
    if not state["should_process"]:
        return state
    
    _load_balancer.start_processing()
    try:
        config = _load_balancer.config
        payload = {
            "model": config.model_name,
            "prompt": state["prompt"],
            "images": [state["image_base64"]],
            "stream": False,
        }
        
        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            response = await client.post(config.ollama_url, json=payload)
            result = response.json()
            state["result"] = result.get("response", "No response")
    finally:
        _load_balancer.end_processing()
    
    return state


def route_after_load_balancer(state: State) -> str:
    """Route based on load balancer decision"""
    return "llava" if state["should_process"] else END


def create_graph(config: Optional[LoadBalancerConfig] = None) -> StateGraph:
    """Create graph with optional custom configuration"""
    global _load_balancer
    if config:
        _load_balancer = LoadBalancer(config)
    
    workflow = StateGraph(State)
    workflow.add_node("load_balancer", load_balancer_node)
    workflow.add_node("llava", llava_node)
    workflow.set_entry_point("load_balancer")
    workflow.add_conditional_edges("load_balancer", route_after_load_balancer)
    workflow.add_edge("llava", END)
    return workflow.compile()


# Create default graph
graph = create_graph()


async def analyze_with_graph(image_base64: str, prompt: str) -> str:
    """Run the graph with load balancing"""
    result = await graph.ainvoke({
        "image_base64": image_base64,
        "prompt": prompt,
        "result": "",
        "priority": 1,
        "should_process": True
    })
    return result["result"]