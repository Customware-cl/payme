// Estado de la aplicación
const state = {
    token: null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';

// Utilidades
const $ = (selector) => document.querySelector(selector);

function showLoader(show = true) {
    $('#loader').classList.toggle('hidden', !show);
}

// Inicialización
function init() {
    // Obtener token de URL si existe
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    console.log('Menu initialized', { hasToken: !!state.token });

    // Setup event listeners
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    // Ver Perfil
    $('#btn-profile').addEventListener('click', () => {
        console.log('Profile button clicked');
        handleProfileClick();
    });

    // Datos bancarios
    $('#btn-bank').addEventListener('click', () => {
        console.log('Bank details button clicked');
        handleBankDetailsClick();
    });

    // Nuevo préstamo
    $('#btn-loan').addEventListener('click', () => {
        console.log('New loan button clicked');
        handleNewLoanClick();
    });
}

// Handlers
function handleProfileClick() {
    // TODO: Implementar vista de perfil
    // Por ahora mostrar mensaje
    alert('Función de perfil en desarrollo.\n\nPronto podrás gestionar tu información personal desde aquí.');
}

function handleBankDetailsClick() {
    // TODO: Implementar vista de datos bancarios
    // Por ahora mostrar mensaje
    alert('Función de datos bancarios en desarrollo.\n\nPronto podrás administrar tus cuentas bancarias desde aquí.');
}

function handleNewLoanClick() {
    showLoader(true);

    // Redirigir al formulario de préstamos
    const loanFormUrl = state.token
        ? `/loan-form?token=${state.token}`
        : '/loan-form';

    console.log('Redirecting to loan form:', loanFormUrl);

    // Pequeño delay para que se vea el loader
    setTimeout(() => {
        window.location.href = loanFormUrl;
    }, 300);
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
