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
    showLoader(true);

    // Redirigir a la vista de perfil
    const profileUrl = state.token
        ? `/menu/profile.html?token=${state.token}`
        : '/menu/profile.html';

    console.log('Redirecting to profile:', profileUrl);

    setTimeout(() => {
        window.location.href = profileUrl;
    }, 300);
}

function handleBankDetailsClick() {
    showLoader(true);

    // Redirigir a la vista de datos bancarios
    const bankUrl = state.token
        ? `/menu/bank-details.html?token=${state.token}`
        : '/menu/bank-details.html';

    console.log('Redirecting to bank details:', bankUrl);

    setTimeout(() => {
        window.location.href = bankUrl;
    }, 300);
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
