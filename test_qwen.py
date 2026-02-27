import sys
import json
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info
import torch

def process_document(json_instructions_path):
    print(f"Loading instructions from {json_instructions_path}...")
    with open(json_instructions_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    system_prompt = data.get('system_message', "You are a helpful assistant.")
    user_prompt = data.get('prompt', "")
    image_path = data.get('image_path', "")
    
    if not image_path:
        print("Error: No image path found in instructions.")
        return

    print("Loading Qwen2.5-VL-3B-Instruct model (this might take a while on first run)...")
    
    # Check if MPS (Metal Performance Shaders) is available for Mac GPU acceleration
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Using device: {device}")
    
    # Load model and processor
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-3B-Instruct",
        torch_dtype=torch.float16 if device == "mps" else torch.float32,
        device_map=device
    )
    processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-3B-Instruct")

    # Format the message for Qwen
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
        {
            "role": "user",
            "content": [
                {
                    "type": "image", 
                    "image": f"file://{image_path}" if not image_path.startswith("file://") and not image_path.startswith("http") else image_path,
                    "max_pixels": 1280 * 28 * 28  # Limit image size to prevent OOM
                },
                {"type": "text", "text": user_prompt},
            ],
        }
    ]

    print("Preparing inputs for the model...")
    # Preparation for inference
    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    )
    inputs = inputs.to(device)

    print("Generating response...")
    # Inference
    generated_ids = model.generate(**inputs, max_new_tokens=1024)
    generated_ids_trimmed = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )
    
    print("\n\n--- MODEL OUTPUT ---")
    print(output_text[0])
    print("--------------------\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_qwen.py <path_to_generated_json_file>")
        sys.exit(1)
        
    process_document(sys.argv[1])
