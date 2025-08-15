import requests
import base64
import json

# Test data (you can replace this with a real image)
test_image_path = "test_image.jpg"  # Replace with actual image path

def test_prompt_types():
    url = "http://localhost:8001/api/v1/llava/analyze"
    
    # Create a simple test image (base64 encoded placeholder)
    # In real usage, you would load an actual image file
    test_image_b64 = ""  # This would be your actual base64 image
    
    prompt_types = ["default", "detailed", "quick", "security"]
    
    print("Enhanced Motion Detection Analysis - Prompt Types:")
    print("=" * 60)
    
    for prompt_type in prompt_types:
        print(f"\n{prompt_type.upper()} ANALYSIS:")
        print("-" * 30)
        
        # Get the prompt for this type
        prompts_response = requests.get("http://localhost:8001/api/v1/llava/prompts")
        prompts = prompts_response.json()
        
        print(f"Prompt: {prompts[prompt_type]['prompt']}")
        print(f"Description: {prompts[prompt_type]['description']}")
        
        # Note: Actual analysis would require a real image and LLaVA model
        # payload = {
        #     "image_base64": test_image_b64,
        #     "prompt_type": prompt_type
        # }
        # response = requests.post(url, json=payload)
        # result = response.json()
        # print(f"Analysis: {result['description']}")
        
        print()

if __name__ == "__main__":
    test_prompt_types()
