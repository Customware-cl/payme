// Estado de la aplicación
const state = {
    token: null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';

// Utilidades
const $ = (selector) => document.querySelector(selector);

// Inicialización
async function init() {
    // Obtener token de URL si existe
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    console.log('Menu initialized', { hasToken: !!state.token });

    // Validar sesión antes de mostrar el menú
    const isValid = await validateSession();

    if (!isValid) {
        showExpiredScreen();
        return;
    }

    // Cargar nombre de usuario si hay token
    if (state.token) {
        await loadUserName();
    }

    // Setup event listeners
    setupEventListeners();
}

// Validar sesión
async function validateSession() {
    // Si no hay token, sesión inválida
    if (!state.token) {
        console.log('No token found');
        return false;
    }

    try {
        // Intentar obtener datos de usuario para validar el token
        const response = await fetch(`${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`);

        // Si el servidor retorna 401, el token es inválido o expirado
        if (response.status === 401) {
            console.log('Token invalid or expired (401)');
            return false;
        }

        const data = await response.json();

        // Si la respuesta indica error, sesión inválida
        if (!data.success) {
            console.log('Session validation failed:', data.error);
            return false;
        }

        console.log('Session validated successfully');
        return true;
    } catch (error) {
        console.error('Error validating session:', error);
        return false;
    }
}

// Mostrar pantalla de expiración
function showExpiredScreen() {
    const expiredScreen = $('#expired-screen');
    const welcomeSection = $('#welcome-section');
    const mainMenu = $('#main-menu');
    const footer = $('.footer');

    if (expiredScreen) expiredScreen.style.display = 'block';
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';
    if (footer) footer.style.display = 'none';
}

// Cargar nombre de usuario
async function loadUserName() {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`);
        const data = await response.json();

        if (data.success && data.name) {
            // Actualizar saludo con el nombre del usuario
            const greeting = $('#user-greeting');
            if (greeting) {
                greeting.textContent = `¡Hola ${data.name}! 👋`;
            }
        }
    } catch (error) {
        console.error('Error loading user name:', error);
        // Mantener saludo genérico si falla
    }
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
    // Redirigir a la vista de perfil
    const profileUrl = state.token
        ? `/menu/profile.html?token=${state.token}`
        : '/menu/profile.html';

    console.log('Redirecting to profile:', profileUrl);

    window.location.href = profileUrl;
}

function handleBankDetailsClick() {
    // Redirigir a la vista de datos bancarios
    const bankUrl = state.token
        ? `/menu/bank-details.html?token=${state.token}`
        : '/menu/bank-details.html';

    console.log('Redirecting to bank details:', bankUrl);

    window.location.href = bankUrl;
}

function handleNewLoanClick() {
    // Redirigir al formulario de préstamos
    const loanFormUrl = state.token
        ? `/loan-form?token=${state.token}`
        : '/loan-form';

    console.log('Redirecting to loan form:', loanFormUrl);

    window.location.href = loanFormUrl;
}

function handleLoansStatusClick() {
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
