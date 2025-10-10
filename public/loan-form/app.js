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
        dateOption: null,
        customDate: null
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
            const detailLabel = $('#detail-label');
            const input = $('#loan-detail');
            const hint = $('#detail-hint');

            if (type === 'money') {
                detailLabel.textContent = 'Monto';
                input.type = 'text';
                input.placeholder = 'Ej: $50.000';
                input.value = '';
                hint.textContent = 'Se formateará automáticamente';
            } else {
                detailLabel.textContent = 'Descripción';
                input.type = 'text';
                input.placeholder = 'Ej: Bicicleta';
                input.value = '';
                hint.textContent = 'Describe el objeto prestado';
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

    $('#btn-create-loan').addEventListener('click', createLoan);

    // Pantalla 5: Éxito
    $('#btn-back-to-whatsapp').addEventListener('click', () => {
        // Intentar cerrar la ventana/tab
        if (window.opener) {
            window.close();
        } else {
            // Si no se puede cerrar, redirigir a WhatsApp Web
            window.location.href = 'https://web.whatsapp.com';
        }
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
            dateOption: null,
            customDate: null
        };

        // Reset UI
        $$('.contact-item').forEach(i => i.classList.remove('selected'));
        $$('.type-btn').forEach(b => b.classList.remove('selected'));
        $$('.date-chip').forEach(c => c.classList.remove('selected'));
        $('#detail-input').classList.add('hidden');
        $('#custom-date-input').classList.add('hidden');
        $('#btn-continue-what').classList.add('hidden');
        $('#btn-continue-when').classList.add('hidden');
        $('#loan-detail').value = '';
        $('#custom-date').value = '';

        showScreen('screen-who');
    });
}

function closeModal() {
    $('#modal-new-contact').classList.add('hidden');
    $('#new-contact-name').value = '';
    $('#new-contact-phone').value = '';
}

function updateSummary() {
    const { contactName, loanType, loanDetail, dateOption, customDate } = state.formData;

    // Who
    $('#summary-who').textContent = contactName;
    $('#success-who').textContent = contactName;

    // What
    let whatText = '';
    if (loanType === 'money') {
        const amount = loanDetail.replace(/[.,\s]/g, '');
        whatText = `$${formatMoney(parseInt(amount))}`;
    } else {
        whatText = loanDetail;
    }
    $('#summary-what').textContent = whatText;
    $('#success-what').textContent = whatText;

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
        const { contactId, contactName, contactPhone, newContact, loanType, loanDetail, dateOption, customDate } = state.formData;

        const payload = {
            token: state.token,
            contact_id: contactId,
            contact_name: contactName,
            contact_phone: contactPhone,
            new_contact: newContact,
            loan_type: loanType,
            loan_detail: loanDetail,
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

        if (data.success) {
            showScreen('screen-success');
        } else {
            throw new Error(data.error || 'Error al crear el préstamo');
        }
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
