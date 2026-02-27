// translations
const i18n = {
    es: {
        title: "Document Extractor form MVP",
        header_title: "DocuExtract",
        main_heading: "Extraer Información",
        main_subheading: "Sube tu documento y define exactamente qué necesitas extraer de él.",
        section_1_title: "1. Documento",
        upload_text: "Haz clic o arrastra una imagen aquí",
        upload_hint: "JPG, PNG hasta 16MB",
        doc_type_label: "Título o Tipo de Documento",
        doc_type_placeholder: "Ej. Recibo de pago, Tabla de excel",
        section_2_title: "2. Campos a Extraer",
        section_2_desc: "Agrega toda la información que te interese extraer de la imagen.",
        btn_add_field_text: "Agregar Campo",
        btn_submit_text: "Generar Instrucciones JSON",
        btn_extract_text: "Extraer con Qwen2.5-VL",
        field_name_label: "Nombre del Campo",
        field_name_placeholder: "Ej. Proveedor",
        field_instruction_label: "Instrucción de Extracción",
        field_instruction_placeholder: "Ej. texto, numero sin simbolo, etc.",
        success_title: "¡Generado con éxito!",
        success_desc: "La imagen ha sido procesada y las instrucciones JSON creadas.",
        success_extract_title: "¡Extracción Completa!",
        success_extract_desc: "Qwen2.5-VL ha procesado la imagen y extraído los datos exitosamente.",
        code_title: "Resultado",
        btn_reset_text: "Procesar otro documento",
        btn_loading: "Generando...",
        btn_extracting: "Extrayendo... (Espera un par de minutos la primera vez)",
        error_general: "Ocurrió un error al procesar la solicitud.",
        error_image: "Por favor selecciona una imagen.",
        error_incomplete_field: "Todos los campos deben tener Nombre e Instrucción. Por favor, completa o elimina las filas vacías antes de continuar.",
        time_taken: "Tiempo de procesamiento: {time}s"
    },
    en: {
        title: "Document Extractor form MVP",
        header_title: "DocuExtract",
        main_heading: "Extract Information",
        main_subheading: "Upload your document and exactly define what you need to extract from it.",
        section_1_title: "1. Document",
        upload_text: "Click or drag an image here",
        upload_hint: "JPG, PNG up to 16MB",
        doc_type_label: "Document Title or Type",
        doc_type_placeholder: "E.g. Payment receipt, Excel table",
        section_2_title: "2. Fields to Extract",
        section_2_desc: "Add all the information you are interested in extracting from the image.",
        btn_add_field_text: "Add Field",
        btn_submit_text: "Generate JSON Instructions",
        btn_extract_text: "Extract with Qwen2.5-VL",
        field_name_label: "Field Name",
        field_name_placeholder: "E.g. Vendor",
        field_instruction_label: "Extraction Instruction",
        field_instruction_placeholder: "E.g. text, number without symbol, etc.",
        success_title: "Successfully generated!",
        success_desc: "The image has been processed and JSON instructions created.",
        success_extract_title: "Extraction Complete!",
        success_extract_desc: "Qwen2.5-VL has successfully processed the image and extracted the data.",
        code_title: "Result",
        btn_reset_text: "Process another document",
        btn_loading: "Generating...",
        btn_extracting: "Extracting... (Please wait a couple of minutes on first run)",
        error_general: "An error occurred while processing the request.",
        error_image: "Please select an image.",
        error_incomplete_field: "All fields must have both a Name and an Instruction. Please complete or delete empty rows before proceeding.",
        time_taken: "Processing time: {time}s"
    }
};

let currentLang = 'es';
let fileToUpload = null;

// DOM Elements
const form = document.getElementById('extractor_form');
const fieldsContainer = document.getElementById('fields_container');
const addFieldBtn = document.getElementById('add_field_btn');
const dropZone = document.getElementById('drop_zone');
const imageInput = document.getElementById('image_input');
const imagePreviewContainer = document.getElementById('image_preview_container');
const imagePreview = document.getElementById('image_preview');
const removeImageBtn = document.getElementById('remove_image_btn');
const submitBtn = document.getElementById('submit_btn');
const btnSubmitText = document.getElementById('btn_submit_text');

// Language initialization
function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    
    // Update active button
    document.getElementById('btn_es').classList.toggle('active', lang === 'es');
    document.getElementById('btn_en').classList.toggle('active', lang === 'en');
    
    // Update texts
    const t = i18n[lang];
    document.getElementById('title').textContent = t.title;
    document.getElementById('header_title').textContent = t.header_title;
    document.getElementById('main_heading').textContent = t.main_heading;
    document.getElementById('main_subheading').textContent = t.main_subheading;
    document.getElementById('section_1_title').textContent = t.section_1_title;
    document.getElementById('upload_text').textContent = t.upload_text;
    document.getElementById('upload_hint').textContent = t.upload_hint;
    document.getElementById('doc_type_label').textContent = t.doc_type_label;
    document.getElementById('doc_type').placeholder = t.doc_type_placeholder;
    document.getElementById('section_2_title').textContent = t.section_2_title;
    document.getElementById('section_2_desc').textContent = t.section_2_desc;
    document.getElementById('btn_add_field_text').textContent = t.btn_add_field_text;
    
    if(!submitBtn.disabled) {
        btnSubmitText.textContent = t.btn_submit_text;
    }
    
    const extractBtn = document.getElementById('extract_btn');
    const btnExtractText = document.getElementById('btn_extract_text');
    if(extractBtn && !extractBtn.disabled) {
        btnExtractText.textContent = t.btn_extract_text;
    }
    
    // We update success texts only if we aren't displaying one. If we are, logic in submit will handle it.
    if(document.getElementById('success_state').classList.contains('hidden')) {
        document.getElementById('success_title').textContent = t.success_title;
        document.getElementById('success_desc').textContent = t.success_desc;
    }
    document.getElementById('code_title').textContent = t.code_title;
    document.getElementById('btn_reset_text').textContent = t.btn_reset_text;

    // Update dynamic fields placeholders and labels
    document.querySelectorAll('.field-item').forEach(item => {
        item.querySelector('.name-label').textContent = t.field_name_label;
        item.querySelector('.name-input').placeholder = t.field_name_placeholder;
        item.querySelector('.inst-label').textContent = t.field_instruction_label;
        item.querySelector('.inst-input').placeholder = t.field_instruction_placeholder;
    });
}

document.getElementById('btn_es').addEventListener('click', () => setLanguage('es'));
document.getElementById('btn_en').addEventListener('click', () => setLanguage('en'));

// Dynamic Fields Creation
function createFieldElement() {
    const t = i18n[currentLang];
    const div = document.createElement('div');
    div.className = 'field-item';
    div.innerHTML = `
        <div class="input-group">
            <label class="name-label">${t.field_name_label}</label>
            <input type="text" class="name-input" name="field_name[]" placeholder="${t.field_name_placeholder}" required>
        </div>
        <div class="input-group">
            <label class="inst-label">${t.field_instruction_label}</label>
            <input type="text" class="inst-input" name="field_instruction[]" placeholder="${t.field_instruction_placeholder}" required>
        </div>
        <button type="button" class="icon-btn danger remove-field" title="Eliminar">
            <i class="ph ph-trash"></i>
        </button>
    `;
    
    div.querySelector('.remove-field').addEventListener('click', () => {
        div.style.animation = 'scaleIn 0.3s ease-in reverse';
        setTimeout(() => div.remove(), 250);
    });
    
    fieldsContainer.appendChild(div);
}

addFieldBtn.addEventListener('click', createFieldElement);

// Initialization: add ONE field by default
createFieldElement();

// File Upload Logic (Drag and Drop / Select)
function handleFile(file) {
    if (file && file.type.startsWith('image/')) {
        fileToUpload = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

imageInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent clicking the label
    fileToUpload = null;
    imageInput.value = '';
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
});

// Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!fileToUpload) {
        alert(i18n[currentLang].error_image);
        return;
    }
    
    // Set loading state
    const action = document.getElementById('form_action').value;
    const extractBtn = document.getElementById('extract_btn');
    
    submitBtn.disabled = true;
    extractBtn.disabled = true;
    
    let originalSubmitIcon = submitBtn.innerHTML;
    let originalExtractIcon = extractBtn.innerHTML;
    
    if (action === 'extract') {
        extractBtn.innerHTML = `<span class="spinner"></span> <span id="btn_extract_text">${i18n[currentLang].btn_extracting}</span>`;
    } else {
        submitBtn.innerHTML = `<span class="spinner"></span> <span id="btn_submit_text">${i18n[currentLang].btn_loading}</span>`;
    }
    
    // Collect data
    const formData = new FormData();
    formData.append('image', fileToUpload);
    formData.append('doc_type', document.getElementById('doc_type').value);
    formData.append('lang', currentLang);
    formData.append('action', action);
    
    // Collect fields
    const names = document.querySelectorAll('.name-input');
    const instructions = document.querySelectorAll('.inst-input');
    const fields = [];
    
    for (let i = 0; i < names.length; i++) {
        const nameVal = names[i].value.trim();
        const instVal = instructions[i].value.trim();
        
        // Validation: If row exists but is partially or completely empty
        if (!nameVal || !instVal) {
            alert(i18n[currentLang].error_incomplete_field);
            
            // Reset loading state back to normal
            submitBtn.disabled = false;
            extractBtn.disabled = false;
            submitBtn.innerHTML = originalSubmitIcon;
            extractBtn.innerHTML = originalExtractIcon;
            return;
        }
        
        if (nameVal && instVal) {
            fields.push({
                name: nameVal,
                instruction: instVal
            });
        }
    }
    
    formData.append('fields', JSON.stringify(fields));

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Show success logic
            form.classList.add('hidden');
            document.querySelector('.hero').classList.add('hidden');
            
            const successPanel = document.getElementById('success_state');
            successPanel.classList.remove('hidden');
            document.getElementById('processing_time_msg').classList.add('hidden');
            
            if (result.is_extraction) {
                document.getElementById('success_title').textContent = i18n[currentLang].success_extract_title;
                document.getElementById('success_desc').textContent = i18n[currentLang].success_extract_desc;
                
                // Show raw text/json from Qwen
                // Usually Qwen outputs something like ```json ... ```, so we can clean it up dynamically or just display it
                let finalData = result.extracted_data.replace(/```json\n?/g, '').replace(/```/g, '');
                
                try {
                    // Try to pretty print if it's purely valid JSON
                    parsed = JSON.parse(finalData);
                    document.getElementById('json_output').textContent = JSON.stringify(parsed, null, 2);
                } catch(e) {
                    // Otherwise show raw
                    document.getElementById('json_output').textContent = finalData;
                }
                
                if (result.processing_time_seconds) {
                    const timeMsg = document.getElementById('processing_time_msg');
                    timeMsg.textContent = i18n[currentLang].time_taken.replace('{time}', result.processing_time_seconds);
                    timeMsg.classList.remove('hidden');
                }
                
            } else {
                document.getElementById('success_title').textContent = i18n[currentLang].success_title;
                document.getElementById('success_desc').textContent = i18n[currentLang].success_desc;
                
                // Format JSON for display
                document.getElementById('json_output').textContent = JSON.stringify(result.json_content, null, 2);
            }
            
        } else {
            alert(result.error || i18n[currentLang].error_general);
        }
    } catch (error) {
        console.error(error);
        alert(i18n[currentLang].error_general);
    } finally {
        // Reset loading state
        submitBtn.disabled = false;
        extractBtn.disabled = false;
        submitBtn.innerHTML = originalSubmitIcon;
        extractBtn.innerHTML = originalExtractIcon;
    }
});

// Copy JSON btn
document.getElementById('copy_btn').addEventListener('click', () => {
    const code = document.getElementById('json_output').textContent;
    navigator.clipboard.writeText(code);
    
    const icon = document.querySelector('#copy_btn i');
    icon.className = 'ph-fill ph-check text-green-500';
    setTimeout(() => {
        icon.className = 'ph ph-copy';
    }, 2000);
});

// Reset logic
document.getElementById('reset_btn').addEventListener('click', () => {
    form.reset();
    fileToUpload = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    
    document.getElementById('success_state').classList.add('hidden');
    form.classList.remove('hidden');
    document.querySelector('.hero').classList.remove('hidden');
    
    // Reset fields to 1 empty one
    fieldsContainer.innerHTML = '';
    createFieldElement();
});

// Force initials lang apply
setLanguage('es');
