import os
import json
import uuid
import logging
import time
from PIL import Image

# Disable PIL's decompression bomb limit to allow processing of huge documents (e.g. 200MP+)
Image.MAX_IMAGE_PIXELS = None 

from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from qwen_service import extractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("processing.log"),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    # 1. Handle image upload
    if 'image' not in request.files:
        return jsonify({'error': 'No image part'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    doc_type = request.form.get('doc_type', 'unknown')
    lang = request.form.get('lang', 'es')
    action = request.form.get('action', 'generate')
    
    # 2. Handle dynamically added fields (passed as JSON string in the form)
    fields_json = request.form.get('fields', '[]')
    try:
        fields = json.loads(fields_json)
    except Exception as e:
        return jsonify({'error': 'Invalid fields data'}), 400

    if file:
        # Generate unique ID for this upload to link image and json
        unique_id = str(uuid.uuid4())
        
        logging.info(f"[{unique_id}] Proceso iniciado para documento tipo: '{doc_type}', idioma: '{lang}', acción: '{action}'")
        
        # Save and preprocess image
        original_ext = os.path.splitext(file.filename)[1].lower()
        if not original_ext:
            original_ext = '.jpg'
            
        image_filename = f"{unique_id}_image{original_ext}"
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
        
        try:
            # Open with PIL to resize if necessary
            img = Image.open(file)
            
            # Reduce image only when needed to prevent Mac MPS Out of Memory
            MAX_DIM = 768
            original_size = img.size
            if img.width > MAX_DIM or img.height > MAX_DIM:
                img.thumbnail((MAX_DIM, MAX_DIM), Image.Resampling.LANCZOS)
                logging.info(f"[{unique_id}] Imagen excedía límites ({original_size}). Reducida dinámicamente a: {img.size}")
            
            # Convert to RGB if saving as JPEG and image has alpha channel
            if original_ext in ['.jpg', '.jpeg'] and img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            img.save(image_path)
            logging.info(f"[{unique_id}] Imagen guardada y pre-procesada: {image_path} (Tamaño: {img.size})")
        except Exception as e:
            logging.error(f"[{unique_id}] Error procesando imagen: {e}")
            return jsonify({'error': f'Error processing image: {str(e)}'}), 500
        
        # Prepare JSON for Qwen2.5-VL using best practices for prompt engineering
        if lang == 'es':
            schema = {f["name"]: f["instruction"] for f in fields}
            prompt = (
                f"Eres un Modelo de Visión y Lenguaje especializado en extraer datos estructurados de imágenes de documentos. "
                f"Tu tarea es analizar la imagen proporcionada de un '{doc_type}' y extraer la información relevante "
                f"en un formato JSON bien estructurado.\n\n"
                f"El esquema JSON esperado es el siguiente, donde las claves representan lo que debes buscar, y los valores "
                f"son las instrucciones de cómo extraerlo:\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n\n"
                f"Concéntrate en identificar estos campos de datos y asegúrate de que la salida se adhiera estrictamente "
                f"al esquema JSON solicitado. Proporciona SOLAMENTE la salida JSON basada en la información extraída. "
                f"Evita explicaciones o comentarios adicionales."
            )
            
            qwen_instruction = {
                "system_message": "Eres un asistente experto en extracción de datos que responde únicamente con JSON válido.",
                "prompt": prompt,
                "image_path": f"uploads/{image_filename}",
                "expected_schema": schema
            }
        else:
            schema = {f["name"]: f["instruction"] for f in fields}
            prompt = (
                f"You are a Vision Language Model specialized in extracting structured data from visual representations of documents. "
                f"Your task is to analyze the provided image of a '{doc_type}' and extract the relevant information into a "
                f"well-structured JSON format.\n\n"
                f"The expected JSON schema is as follows, where the keys represent what to look for, and the values are "
                f"the instructions on how to extract it:\n{json.dumps(schema, indent=2)}\n\n"
                f"Focus on identifying these key data fields and ensuring the output adheres strictly to the requested "
                f"JSON structure. Provide ONLY the JSON output based on the extracted information. "
                f"Avoid additional explanations or comments."
            )
            
            qwen_instruction = {
                "system_message": "You are an expert data extraction assistant that responds only with valid JSON.",
                "prompt": prompt,
                "image_path": f"uploads/{image_filename}",
                "expected_schema": schema
            }
        
        # Save JSON
        json_filename = f"{unique_id}_instructions.json"
        json_path = os.path.join(app.config['UPLOAD_FOLDER'], json_filename)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(qwen_instruction, f, ensure_ascii=False, indent=4)
            
        if action == 'extract':
            try:
                logging.info(f"[{unique_id}] Iniciando extracción con Qwen2.5-VL...")
                # Construct absolute path for the Qwen image loader
                full_image_path = os.path.abspath(image_path)
                
                start_time = time.time()
                result_text = extractor.extract(
                    qwen_instruction['system_message'],
                    qwen_instruction['prompt'],
                    full_image_path
                )
                elapsed_time = round(time.time() - start_time, 2)
                
                logging.info(f"[{unique_id}] Extracción completada exitosamente en {elapsed_time}s.")
                return jsonify({
                    'success': True,
                    'message': 'Extraction completed successfully.',
                    'image_saved': image_filename,
                    'json_saved': json_filename,
                    'json_content': qwen_instruction,
                    'extracted_data': result_text,
                    'processing_time_seconds': elapsed_time,
                    'is_extraction': True
                })
            except Exception as e:
                import traceback
                logging.error(f"[{unique_id}] Error durante la extracción: {e}")
                traceback.print_exc()
                return jsonify({'error': f"Extraction error: {str(e)}"}), 500
        else:
            logging.info(f"[{unique_id}] Solo generación de JSON completada.")
            return jsonify({
                'success': True,
                'message': 'File and instructions generated successfully.',
                'image_saved': image_filename,
                'json_saved': json_filename,
                'json_content': qwen_instruction,
                'is_extraction': False
            })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
