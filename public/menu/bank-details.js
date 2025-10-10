// Estado de la aplicación
const state = {
    token: null,
    contactId: null,
    bankData: null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const BANK_ENDPOINT = `${SUPABASE_URL}/functions/v1/menu-data`;

// Utilidades
const $ = (selector) => document.querySelector(selector);

function showLoader(show = true, text = 'Cargando...') {
    const loader = $('#loader');
    const loaderText = $('#loader-text');

    if (loaderText) {
        loaderText.textContent = text;
    }

    loader.classList.toggle('hidden', !show);
}

function showToast(message, duration = 3000) {
    const toast = $('#toast');
    const toastMessage = $('#toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

// Validación y formateo de RUT
function formatRUT(rut) {
    // Eliminar puntos y guiones
    let value = rut.replace(/\./g, '').replace(/-/g, '');

    // Separar número y dígito verificador
    let body = value.slice(0, -1);
    let dv = value.slice(-1).toUpperCase();

    // Formatear con puntos
    body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return body ? `${body}-${dv}` : '';
}

function validateRUT(rut) {
    // Limpiar formato
    const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '');

    if (cleanRUT.length < 2) return false;

    const body = cleanRUT.slice(0, -1);
    const dv = cleanRUT.slice(-1).toUpperCase();

    // Validar que el cuerpo sean solo números
    if (!/^\d+$/.test(body)) return false;

    // Calcular dígito verificador
    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDV = 11 - (sum % 11);
    const calculatedDV = expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : String(expectedDV);

    return dv === calculatedDV;
}

// Inicialización
async function init() {
    // Obtener token de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    if (!state.token) {
        showToast('Token inválido. Redirigiendo al menú...', 3000);
        setTimeout(() => window.location.href = '/menu', 3000);
        return;
    }

    console.log('Bank details initialized', { token: state.token });

    // Setup event listeners
    setupEventListeners();

    // Cargar datos bancarios
    await loadBankDetails();
}

// Event Listeners
function setupEventListeners() {
    $('#btn-back').addEventListener('click', () => {
        window.location.href = `/menu?token=${state.token}`;
    });

    // Formateo automático de RUT
    $('#rut').addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart;
        const oldValue = e.target.value;
        const newValue = formatRUT(oldValue);

        e.target.value = newValue;

        // Mantener cursor en posición relativa
        if (newValue.length >= oldValue.length) {
            e.target.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
        }
    });

    // Solo números en número de cuenta
    $('#account-number').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    $('#bank-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBankDetails();
    });
}

// Cargar datos bancarios existentes
async function loadBankDetails() {
    showLoader(true);

    try {
        const response = await fetch(`${BANK_ENDPOINT}?token=${state.token}&type=bank`);
        const data = await response.json();

        if (data.success && data.bank_account) {
            state.bankData = data.bank_account;
            state.contactId = data.contact_id;

            // Rellenar formulario
            if (data.bank_account.rut) {
                $('#rut').value = formatRUT(data.bank_account.rut);
            }
            if (data.bank_account.bank_name) {
                $('#bank').value = data.bank_account.bank_name;
            }
            if (data.bank_account.account_type) {
                $('#account-type').value = data.bank_account.account_type;
            }
            if (data.bank_account.account_number) {
                $('#account-number').value = data.bank_account.account_number;
            }

            console.log('Bank details loaded:', data.bank_account);
        } else {
            console.log('No bank data found, starting with empty form');
        }
    } catch (error) {
        console.error('Error loading bank details:', error);
        showToast('Error al cargar los datos bancarios');
    } finally {
        showLoader(false);
    }
}

// Guardar datos bancarios
async function saveBankDetails() {
    const rut = $('#rut').value.trim();
    const bankName = $('#bank').value;
    const accountType = $('#account-type').value;
    const accountNumber = $('#account-number').value.trim();

    // Validar RUT
    if (!validateRUT(rut)) {
        showToast('RUT inválido. Verifica el formato y dígito verificador.');
        $('#rut').focus();
        return;
    }

    showLoader(true, 'Guardando...');

    try {
        const formData = {
            token: state.token,
            type: 'bank',
            data: {
                rut: rut.replace(/\./g, '').replace(/-/g, ''), // Guardar sin formato
                bank_name: bankName,
                account_type: accountType,
                account_number: accountNumber
            }
        };

        const response = await fetch(BANK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('✅ Datos bancarios guardados correctamente');
            setTimeout(() => {
                window.location.href = `/menu?token=${state.token}`;
            }, 1500);
        } else {
            throw new Error(data.error || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error saving bank details:', error);
        showToast('Error al guardar los datos bancarios. Intenta de nuevo.');
    } finally {
        showLoader(false);
    }
}

// Iniciar app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
