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

    // Estado de préstamos
    $('#btn-loans-status').addEventListener('click', () => {
        console.log('Loans status button clicked');
        handleLoansStatusClick();
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

    window.location.href = profileUrl;
}

function handleBankDetailsClick() {
    showLoader(true);

    // Redirigir a la vista de datos bancarios
    const bankUrl = state.token
        ? `/menu/bank-details.html?token=${state.token}`
        : '/menu/bank-details.html';

    console.log('Redirecting to bank details:', bankUrl);

    window.location.href = bankUrl;
}

function handleNewLoanClick() {
    showLoader(true);

    // Redirigir al formulario de préstamos
    const loanFormUrl = state.token
        ? `/loan-form?token=${state.token}`
        : '/loan-form';

    console.log('Redirecting to loan form:', loanFormUrl);

    window.location.href = loanFormUrl;
}

function handleLoansStatusClick() {
    showLoader(true);

    // Redirigir a la vista de estado de préstamos
    const loansUrl = state.token
        ? `/menu/loans.html?token=${state.token}`
        : '/menu/loans.html';

    console.log('Redirecting to loans status:', loansUrl);

    window.location.href = loansUrl;
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
