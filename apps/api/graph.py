import httpx
import time
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END


class State(TypedDict):
    image_base64: str
    prompt: str
    result: str
    queue_priority: int
    should_process: bool


# Simple in-memory tracking
_processing_count = 0
_last_process_time = 0


async def queue_node(state: State) -> State:
    """Simple queue management with load checking"""
    global _processing_count, _last_process_time
    
    current_time = time.time()
    
    # Simple load check: max 3 concurrent, min 1 second between requests
    if _processing_count >= 3:
        state["should_process"] = False
        state["result"] = "Request dropped - system busy"
        return state
    
    if current_time - _last_process_time < 1.0:
        state["queue_priority"] = 2  # Lower priority for rapid requests
    else:
        state["queue_priority"] = 1  # Normal priority
    
    state["should_process"] = True
    _last_process_time = current_time
    return state


async def llava_node(state: State) -> State:
    """LLaVA node"""
    global _processing_count
    
    if not state["should_process"]:
        return state
    
    _processing_count += 1
    try:
        payload = {
            "model": "llava:latest",
            "prompt": state["prompt"],
            "images": [state["image_base64"]],
            "stream": False,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post("http://localhost:11434/api/generate", json=payload)
            result = response.json()
            state["result"] = result.get("response", "No response")
    finally:
        _processing_count -= 1
    
    return state


def route_after_queue(state: State) -> str:
    """Simple routing: process or end"""
    return "llava" if state["should_process"] else END


# Create graph with queue
workflow = StateGraph(State)
workflow.add_node("queue", queue_node)
workflow.add_node("llava", llava_node)
workflow.set_entry_point("queue")
workflow.add_conditional_edges("queue", route_after_queue)
workflow.add_edge("llava", END)
graph = workflow.compile()


async def analyze_with_graph(image_base64: str, prompt: str) -> str:
    """Run the graph with queue management"""
    result = await graph.ainvoke({
        "image_base64": image_base64,
        "prompt": prompt,
        "result": "",
        "queue_priority": 1,
        "should_process": True
    })
    return result["result"]