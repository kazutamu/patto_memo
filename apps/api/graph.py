import os
from dataclasses import dataclass
from typing import Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph


@dataclass
class OllamaConfig:
    timeout_seconds: float = 60.0
    ollama_url: str = "http://localhost:11434/api/generate"
    model_name: str = "llava:latest"

    @classmethod
    def from_env(cls) -> "OllamaConfig":
        """Create config from environment variables"""
        return cls(
            timeout_seconds=float(os.getenv("OLLAMA_TIMEOUT", "60.0")),
            ollama_url=os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
            model_name=os.getenv("OLLAMA_MODEL", "llava:latest"),
        )


class State(TypedDict):
    image_base64: str
    prompt: str
    result: str
    error_type: Optional[str]
    error_message: Optional[str]


# Initialize config
_ollama_config = OllamaConfig.from_env()


async def llava_node(state: State) -> State:
    """LLaVA processing node"""
    try:
        payload = {
            "model": _ollama_config.model_name,
            "prompt": state["prompt"],
            "images": [state["image_base64"]],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=_ollama_config.timeout_seconds) as client:
            response = await client.post(_ollama_config.ollama_url, json=payload)

            # Handle HTTP error statuses
            if response.status_code == 503:
                state["error_type"] = "service_unavailable"
                state["error_message"] = "Service unavailable"
                state["result"] = ""
                return state

            response.raise_for_status()
            result = response.json()

            # Handle malformed responses
            if "response" not in result:
                state["result"] = "No description available"
            else:
                state["result"] = result.get("response", "No response")

    except httpx.TimeoutException as e:
        state["error_type"] = "timeout"
        state["error_message"] = f"Timeout error: {str(e)}"
        state["result"] = ""
    except httpx.ConnectError as e:
        state["error_type"] = "connection_error"
        state["error_message"] = f"Connection error: {str(e)}"
        state["result"] = ""
    except Exception as e:
        state["error_type"] = "general_error"
        state["error_message"] = str(e)
        state["result"] = ""

    return state


def create_graph(config: Optional[OllamaConfig] = None) -> StateGraph:
    """Create graph with optional custom configuration"""
    global _ollama_config
    if config:
        _ollama_config = config

    workflow = StateGraph(State)
    workflow.add_node("llava", llava_node)
    workflow.set_entry_point("llava")
    workflow.add_edge("llava", END)
    return workflow.compile()


# Create default graph
graph = create_graph()


async def analyze_with_graph(image_base64: str, prompt: str):
    """Run the graph for LLaVA analysis"""
    result = await graph.ainvoke(
        {
            "image_base64": image_base64,
            "prompt": prompt,
            "result": "",
            "error_type": None,
            "error_message": None,
        }
    )

    # Return error information if present
    if result.get("error_type"):
        return {
            "error_type": result["error_type"],
            "error_message": result["error_message"],
            "result": result["result"],
        }

    return result["result"]
