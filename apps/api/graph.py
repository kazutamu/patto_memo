import httpx
from typing import TypedDict
from langgraph.graph import StateGraph, END


class State(TypedDict):
    image_base64: str
    prompt: str
    result: str


async def llava_node(state: State) -> State:
    """LLaVA node"""
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
    
    return state


# Create graph
workflow = StateGraph(State)
workflow.add_node("llava", llava_node)
workflow.set_entry_point("llava")
workflow.add_edge("llava", END)
graph = workflow.compile()


async def analyze_with_graph(image_base64: str, prompt: str) -> str:
    """Run the graph"""
    result = await graph.ainvoke({
        "image_base64": image_base64,
        "prompt": prompt,
        "result": ""
    })
    return result["result"]