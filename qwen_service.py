import os
import gc
import torch
import logging
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

class QwenExtractor:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"

    def load_model(self):
        if self.model is None:
            logging.info("Cargando modelo Qwen2.5-VL-3B-Instruct en memoria... (Esto puede tomar un momento)")
            self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                "Qwen/Qwen2.5-VL-3B-Instruct",
                torch_dtype=torch.float16 if self.device == "mps" else torch.float32,
                device_map=self.device
            )
            self.processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-3B-Instruct")
            logging.info("Modelo cargado exitosamente en MPS/CPU.")

    def extract(self, system_prompt, user_prompt, image_path):
        self.load_model()
        
        # Format the message for Qwen
        messages = [
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image", 
                        "image": f"file://{image_path}",
                        "max_pixels": 262144  # Limit resolution to 512x512 to prevent Mac MPS Out of Memory
                    },
                    {"type": "text", "text": user_prompt},
                ],
            }
        ]

        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(messages)
        
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(self.device)

        logging.info("Generando extracción mediante la red neuronal...")
        generated_ids = self.model.generate(**inputs, max_new_tokens=1024)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = self.processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )
        
        # Explicitly free huge tensor variables
        result = output_text[0]
        del inputs
        del image_inputs
        del video_inputs
        del generated_ids
        del generated_ids_trimmed
        
        # Clear hardware cache
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        
        logging.info("Extracción de red neuronal finalizada. Memoria residual y caché liberada.")
        return result

# Singleton instance for lazy loading inside Flask avoiding multiple huge memory allocations
extractor = QwenExtractor()
