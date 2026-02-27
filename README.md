# DocuExtract MVP (scanny-mvp)

DocuExtract is a Minimum Viable Product (MVP) web application that allows users to upload document images (like payment receipts or invoices) and dynamically extract structured JSON data from them using **Qwen2.5-VL**, entirely processed **locally** on-device.

![Demo](demo.webp)

## Features
- **Dynamic Schema Builder**: Add specific fields (e.g., "Vendor", "Total") and instructions (e.g., "text", "number without currency") that you want to extract from your document.
- **Local Vision Language Model (VLM)**: Integrates `Qwen2.5-VL-3B-Instruct` running precisely on Mac Apple Silicon (`mps`) or CPU, ensuring strict data privacy without relying on expensive cloud APIs.
- **Anti-OOM Protection**: Automatically scales down massive images (`>768x768`) natively in Python using `Pillow` to prevent memory blowouts (Error 247).
- **Aggressive Memory Management**: Enforces heavy tensor garbage collection (`mps.empty_cache`) right after inference to keep your system fast and responsive.
- **Dual Flow Pipeline**: Generate prompt instructions for manual use or trigger full end-to-end Local Extraction with a single click.
- **Auditable Operations**: All operations, errors, and memory actions are tracked in a persistent `processing.log`.

## Installation

### 1. Requirements
- Python 3.10+
- Mac with Apple Silicon (M1/M2/M3/M4) recommended for optimal MPS acceleration, though compatible with CPU/CUDA.

### 2. Setup
Clone the repository and spin up your virtual environment:
```bash
git clone git@github.com:reneang17/scanny-mvp.git
cd scanny-mvp
python -m venv venv
source venv/bin/activate
```

Install requirements:
```bash
pip install -r requirements.txt
pip install git+https://github.com/huggingface/transformers accelerate qwen-vl-utils torchvision Pillow
```

*Note: Qwen2.5-VL weights (~6 GB) will be downloaded automatically by Hugging Face on the first inference.*

### 3. Run the Server
```bash
python app.py
```
Open `http://127.0.0.1:5000` in your web browser.

## How to use
1. Go to the web app (`http://127.0.0.1:5000`).
2. Upload exactly one document photo (JPG/PNG).
3. Type the general document title (e.g., "Invoice").
4. Add the specific fields you need to discover (e.g., Name="Total", Instruction="float").
5. Click **Extract with Qwen2.5-VL**. Give it a moment to download the model into memory (if it's the first time), compress your image, run inference, flush its vRAM cache, and output your clean JSON!

## License
MIT License. See [LICENSE](LICENSE) for more details.
