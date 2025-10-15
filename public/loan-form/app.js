// Estado de la aplicación
const state = {
    token: null,
    contacts: [],
    formData: {
        contactId: null,
        contactName: null,
        contactPhone: null,
        newContact: false,
        loanType: null,
        loanDetail: null,
        loanConcept: null,
        dateOption: null,
        customDate: null,
        imageFile: null,
        imageUrl: null
    }
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const LOAN_FORM_ENDPOINT = `${SUPABASE_URL}/functions/v1/loan-web-form`;

// Utilidades
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function showScreen(screenId) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(`#${screenId}`).classList.add('active');
    window.scrollTo(0, 0);
}

function showToast(message, duration = 3000) {
    const toast = $('#toast');
    const toastMessage = $('#toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function showLoader(show = true) {
    $('#loader').classList.toggle('hidden', !show);
}

function formatMoney(amount) {
    return new Intl.NumberFormat('es-CL').format(amount);
}

function formatPhone(phone) {
    if (!phone) return 'Sin teléfono';

    // Limpiar el número
    const cleaned = phone.replace(/\D/g, '');

    // Formato chileno: +56 9 xxxx xxxx
    if (cleaned.startsWith('56') && cleaned.length === 11) {
        return `+56 ${cleaned.charAt(2)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }

    // Si no coincide con formato chileno, devolver como está
    return phone;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function calculateDate(option) {
    const today = new Date();
    let targetDate;

    switch (option) {
        case 'tomorrow':
            targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + 1);
            break;
        case 'week':
            targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + 7);
            break;
        case 'month-end':
            targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        default:
            return null;
    }

    // Formatear como YYYY-MM-DD sin conversión UTC
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateLabel(option, customDate = null) {
    switch (option) {
        case 'tomorrow':
            return 'Mañana';
        case 'week':
            return 'En una semana';
        case 'month-end':
            return 'A fin de mes';
        case 'custom':
            return customDate ? formatDate(customDate) : 'Fecha específica';
        default:
            return '';
    }
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// Validaciones
function validatePhone(phone) {
    if (!phone || phone.trim() === '') return true; // Opcional
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    return /^\+?56\d{9}$/.test(cleanPhone);
}

function validateAmount(amount) {
    const cleaned = amount.replace(/[.,\s]/g, '');
    return /^\d+$/.test(cleaned) && parseInt(cleaned) > 0;
}

// Validar archivo de imagen
function validateImageFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file) return { valid: false, error: 'No se seleccionó ningún archivo' };

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no permitido. Usa JPG, PNG o WEBP' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'El archivo es muy grande. Máximo 5MB' };
    }

    return { valid: true };
}

// Mostrar preview de imagen
function showImagePreview(file) {
    const previewContainer = $('#image-preview-container');
    const preview = $('#image-preview');
    const uploadBtn = $('#btn-upload-image');

    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        previewContainer.classList.remove('hidden');
        uploadBtn.textContent = '📸 Cambiar imagen';
    };
    reader.readAsDataURL(file);
}

// Eliminar imagen seleccionada
function removeImage() {
    state.formData.imageFile = null;
    state.formData.imageUrl = null;

    $('#image-preview-container').classList.add('hidden');
    $('#image-preview').src = '';
    $('#loan-image').value = '';
    $('#btn-upload-image').innerHTML = '<span>📸</span><span>Seleccionar imagen</span>';
}

// Subir imagen a Supabase Storage
async function uploadImageToStorage(file, agreementId) {
    try {
        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${agreementId}_${timestamp}.${fileExt}`;
        const filePath = `${agreementId}/${fileName}`;

        // Crear FormData para subir
        const formData = new FormData();
        formData.append('file', file);

        // Subir a Storage usando REST API
        const uploadResponse = await fetch(
            `${SUPABASE_URL}/storage/v1/object/loan-images/${filePath}`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.message || 'Error al subir imagen');
        }

        // Construir URL pública de la imagen
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/loan-images/${filePath}`;

        return { success: true, url: publicUrl, path: filePath };
    } catch (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: error.message };
    }
}

// Inicialización
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    if (!state.token) {
        showToast('Token inválido o expirado', 5000);
        setTimeout(() => window.close(), 3000);
        return;
    }

    showLoader(true);

    try {
        // Obtener lista de contactos
        const response = await fetch(`${SUPABASE_URL}/functions/v1/loan-web-form?token=${state.token}`);
        const data = await response.json();

        if (data.success) {
            state.contacts = data.contacts || [];
            renderContacts();
        } else {
            throw new Error(data.error || 'Error al cargar contactos');
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
        showToast('Error al cargar contactos', 5000);
    } finally {
        showLoader(false);
    }

    setupEventListeners();
}

// Renderizar contactos
function renderContacts() {
    const container = $('#contacts-list');

    if (state.contacts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <p>No hay contactos registrados</p>
                <p style="font-size: 14px; margin-top: 8px;">Crea uno nuevo para continuar</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.contacts.map(contact => `
        <div class="contact-item" data-contact-id="${contact.id}">
            <div class="contact-avatar">${getInitials(contact.name)}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-phone">${formatPhone(contact.phone)}</div>
            </div>
        </div>
    `).join('');
}

// Event Listeners
function setupEventListeners() {
    // Botón volver al menú
    $('#back-to-menu').addEventListener('click', () => {
        // Volver al menú principal
        const menuUrl = state.token
            ? `/menu?token=${state.token}`
            : '/menu';
        window.location.href = menuUrl;
    });

    // Pantalla 1: Selección de contacto
    $('#contacts-list').addEventListener('click', (e) => {
        const item = e.target.closest('.contact-item');
        if (!item) return;

        $$('.contact-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        const contactId = item.dataset.contactId;
        const contact = state.contacts.find(c => c.id === contactId);

        state.formData.contactId = contactId;
        state.formData.contactName = contact.name;
        state.formData.contactPhone = contact.phone;
        state.formData.newContact = false;

        setTimeout(() => showScreen('screen-what'), 300);
    });

    $('#btn-new-contact').addEventListener('click', () => {
        $('#modal-new-contact').classList.remove('hidden');
    });

    // Modal nuevo contacto
    $('#btn-close-modal').addEventListener('click', closeModal);
    $('#btn-cancel-contact').addEventListener('click', closeModal);

    $('#btn-save-contact').addEventListener('click', () => {
        const name = $('#new-contact-name').value.trim();
        const phone = $('#new-contact-phone').value.trim();

        if (!name) {
            showToast('Ingresa el nombre del contacto');
            return;
        }

        if (phone && !validatePhone(phone)) {
            showToast('Formato de teléfono inválido (ej: +56912345678)');
            return;
        }

        state.formData.contactId = null;
        state.formData.contactName = name;
        state.formData.contactPhone = phone || null;
        state.formData.newContact = true;

        closeModal();
        showScreen('screen-what');
    });

    // Pantalla 2: Tipo y detalle
    $$('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            const type = btn.dataset.type;
            state.formData.loanType = type;

            // Mostrar input correspondiente
            const detailInput = $('#detail-input');
            const conceptInput = $('#concept-input');
            const detailLabel = $('#detail-label');
            const input = $('#loan-detail');
            const conceptField = $('#loan-concept');
            const hint = $('#detail-hint');

            if (type === 'money') {
                detailLabel.textContent = 'Monto';
                input.type = 'text';
                input.placeholder = 'Ej: $50.000';
                input.value = '';
                hint.textContent = 'Se formateará automáticamente';

                // Mostrar campo de concepto para dinero
                conceptInput.classList.remove('hidden');
                conceptField.value = '';
            } else {
                detailLabel.textContent = 'Descripción';
                input.type = 'text';
                input.placeholder = 'Ej: Bicicleta';
                input.value = '';
                hint.textContent = 'Describe el objeto prestado';

                // Ocultar campo de concepto para objetos
                conceptInput.classList.add('hidden');
                conceptField.value = '';
                state.formData.loanConcept = null;
            }

            detailInput.classList.remove('hidden');
            input.focus();
        });
    });

    $('#loan-detail').addEventListener('input', (e) => {
        const type = state.formData.loanType;
        const btn = $('#btn-continue-what');
        let isValid = false;

        if (type === 'money') {
            // Obtener solo los números del input
            const rawValue = e.target.value.replace(/[^\d]/g, '');

            if (rawValue === '') {
                e.target.value = '';
                state.formData.loanDetail = '';
                btn.classList.add('hidden');
                return;
            }

            // Formatear con separador de miles y símbolo $
            const numericValue = parseInt(rawValue);
            const formatted = '$' + formatMoney(numericValue);

            // Actualizar el campo con el valor formateado
            e.target.value = formatted;

            // Guardar el valor sin formato para procesar
            state.formData.loanDetail = rawValue;

            // Validar
            isValid = numericValue > 0;
        } else {
            const value = e.target.value.trim();
            isValid = value.length >= 3;

            if (isValid) {
                state.formData.loanDetail = value;
            }
        }

        btn.classList.toggle('hidden', !isValid);
    });

    $('#loan-concept').addEventListener('input', (e) => {
        const value = e.target.value.trim();
        state.formData.loanConcept = value || null;
    });

    $('#btn-continue-what').addEventListener('click', () => {
        showScreen('screen-when');
    });

    $('#back-from-what').addEventListener('click', () => {
        showScreen('screen-who');
    });

    // Pantalla 3: Fecha
    $$('.date-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('.date-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');

            const option = chip.dataset.date;
            state.formData.dateOption = option;

            const customDateInput = $('#custom-date-input');
            const btnContinue = $('#btn-continue-when');

            if (option === 'custom') {
                customDateInput.classList.remove('hidden');
                $('#custom-date').focus();
                btnContinue.classList.add('hidden');
            } else {
                customDateInput.classList.add('hidden');
                state.formData.customDate = null;
                btnContinue.classList.remove('hidden');
            }
        });
    });

    $('#custom-date').addEventListener('change', (e) => {
        const date = e.target.value;
        if (date) {
            state.formData.customDate = date;
            $('#btn-continue-when').classList.remove('hidden');
        }
    });

    $('#btn-continue-when').addEventListener('click', () => {
        updateSummary();
        showScreen('screen-confirm');
    });

    $('#back-from-when').addEventListener('click', () => {
        showScreen('screen-what');
    });

    // Pantalla 4: Confirmación
    $('#back-from-confirm').addEventListener('click', () => {
        showScreen('screen-when');
    });

    $('#btn-edit').addEventListener('click', () => {
        showScreen('screen-who');
    });

    // Manejo de imagen
    $('#btn-upload-image').addEventListener('click', () => {
        $('#loan-image').click();
    });

    $('#loan-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            showToast(validation.error, 4000);
            e.target.value = '';
            return;
        }

        state.formData.imageFile = file;
        showImagePreview(file);
    });

    $('#btn-remove-image').addEventListener('click', removeImage);

    $('#btn-create-loan').addEventListener('click', createLoan);

    // Pantalla 5: Éxito
    $('#btn-back-to-menu-success').addEventListener('click', () => {
        // Volver al menú principal con el token
        const menuUrl = state.token
            ? `/menu?token=${state.token}`
            : '/menu';
        window.location.href = menuUrl;
    });

    $('#btn-create-another').addEventListener('click', () => {
        // Reset form
        state.formData = {
            contactId: null,
            contactName: null,
            contactPhone: null,
            newContact: false,
            loanType: null,
            loanDetail: null,
            loanConcept: null,
            dateOption: null,
            customDate: null,
            imageFile: null,
            imageUrl: null
        };

        // Reset UI
        $$('.contact-item').forEach(i => i.classList.remove('selected'));
        $$('.type-btn').forEach(b => b.classList.remove('selected'));
        $$('.date-chip').forEach(c => c.classList.remove('selected'));
        $('#detail-input').classList.add('hidden');
        $('#concept-input').classList.add('hidden');
        $('#custom-date-input').classList.add('hidden');
        $('#btn-continue-what').classList.add('hidden');
        $('#btn-continue-when').classList.add('hidden');
        $('#loan-detail').value = '';
        $('#loan-concept').value = '';
        $('#custom-date').value = '';

        // Reset imagen
        removeImage();

        showScreen('screen-who');
    });
}

function closeModal() {
    $('#modal-new-contact').classList.add('hidden');
    $('#new-contact-name').value = '';
    $('#new-contact-phone').value = '';
}

function updateSummary() {
    const { contactName, loanType, loanDetail, loanConcept, dateOption, customDate } = state.formData;

    // Who
    $('#summary-who').textContent = contactName;
    $('#success-who').textContent = contactName;

    // What
    const summaryConceptRow = $('#summary-concept-row');
    const successConceptRow = $('#success-concept-row');

    if (loanType === 'money') {
        // Para dinero: mostrar solo el monto en "Préstamo"
        const amount = loanDetail.replace(/[.,\s]/g, '');
        const amountText = `$${formatMoney(parseInt(amount))}`;
        $('#summary-what').textContent = amountText;
        $('#success-what').textContent = amountText;

        // Mostrar concepto en fila separada si existe
        if (loanConcept && loanConcept.trim()) {
            $('#summary-concept').textContent = loanConcept.trim();
            $('#success-concept').textContent = loanConcept.trim();
            summaryConceptRow.style.display = 'flex';
            successConceptRow.style.display = 'flex';
        } else {
            summaryConceptRow.style.display = 'none';
            successConceptRow.style.display = 'none';
        }
    } else {
        // Para objetos: mostrar solo la descripción en "Préstamo"
        $('#summary-what').textContent = loanDetail;
        $('#success-what').textContent = loanDetail;

        // Ocultar fila de concepto para objetos
        summaryConceptRow.style.display = 'none';
        successConceptRow.style.display = 'none';
    }

    // When
    let whenText = '';
    let dateValue = '';

    if (dateOption === 'custom') {
        dateValue = customDate;
        whenText = formatDate(customDate);
    } else {
        dateValue = calculateDate(dateOption);
        whenText = getDateLabel(dateOption);
    }

    $('#summary-when').textContent = whenText;
    $('#success-when').textContent = formatDate(dateValue);
}

async function createLoan() {
    showLoader(true);

    try {
        const { contactId, contactName, contactPhone, newContact, loanType, loanDetail, loanConcept, dateOption, customDate, imageFile } = state.formData;

        // Primer paso: Crear el préstamo sin imagen
        const payload = {
            token: state.token,
            contact_id: contactId,
            contact_name: contactName,
            contact_phone: contactPhone,
            new_contact: newContact,
            loan_type: loanType,
            loan_detail: loanDetail,
            loan_concept: loanConcept,
            date_option: dateOption,
            custom_date: customDate
        };

        const response = await fetch(LOAN_FORM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al crear el préstamo');
        }

        // Si hay imagen, subirla después de crear el préstamo
        if (imageFile && data.agreement_id) {
            const uploadResult = await uploadImageToStorage(imageFile, data.agreement_id);

            if (uploadResult.success) {
                // Actualizar el préstamo con la URL de la imagen
                await fetch(LOAN_FORM_ENDPOINT, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: state.token,
                        agreement_id: data.agreement_id,
                        image_url: uploadResult.url
                    })
                });
            } else {
                console.error('Failed to upload image:', uploadResult.error);
                // No fallar el flujo si la imagen no se sube
                showToast('Préstamo creado, pero la imagen no se pudo subir', 4000);
            }
        }

        showScreen('screen-success');
    } catch (error) {
        console.error('Error creating loan:', error);
        showToast('Error al crear el préstamo. Intenta de nuevo.', 5000);
    } finally {
        showLoader(false);
    }
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
