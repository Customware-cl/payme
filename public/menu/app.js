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

// Cargar nombre de usuario y detectar onboarding
async function loadUserName() {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`);
        const data = await response.json();

        if (data.success) {
            // Verificar si requiere onboarding
            if (data.requires_onboarding) {
                console.log('User requires onboarding');
                showOnboardingScreen();
                return;
            }

            // Si tiene nombre, actualizar saludo
            if (data.name) {
                const greeting = $('#user-greeting');
                if (greeting) {
                    greeting.textContent = `¡Hola ${data.name}! 👋`;
                }
            }
        }
    } catch (error) {
        console.error('Error loading user name:', error);
        // Mantener saludo genérico si falla
    }
}

// Mostrar pantalla de onboarding
function showOnboardingScreen() {
    const onboardingScreen = $('#onboarding-screen');
    const welcomeSection = $('#welcome-section');
    const mainMenu = $('#main-menu');
    const footer = $('.footer');

    if (onboardingScreen) onboardingScreen.style.display = 'block';
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';
    if (footer) footer.style.display = 'none';

    // Setup onboarding form listener
    const form = $('#onboarding-form');
    if (form) {
        form.addEventListener('submit', handleOnboardingSubmit);
    }
}

// Manejar envío de formulario de onboarding
async function handleOnboardingSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = $('#btn-complete-onboarding');
    const errorDiv = $('#onboarding-error');
    const loadingDiv = $('#onboarding-loading');

    // Obtener valores del formulario
    const firstName = $('#first_name').value.trim();
    const lastName = $('#last_name').value.trim();
    const email = $('#email').value.trim();

    // Validaciones básicas
    if (!firstName || !lastName || !email) {
        showOnboardingError('Por favor completa todos los campos');
        return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showOnboardingError('Por favor ingresa un correo electrónico válido');
        return;
    }

    // Validar nombres (solo letras y espacios)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
        showOnboardingError('Los nombres solo pueden contener letras');
        return;
    }

    // Mostrar loading
    if (submitButton) submitButton.disabled = true;
    if (errorDiv) errorDiv.style.display = 'none';
    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/complete-onboarding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: state.token,
                first_name: firstName,
                last_name: lastName,
                email: email
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Error al completar onboarding');
        }

        console.log('Onboarding completed successfully:', data);

        // Recargar la página para mostrar el menú completo
        window.location.reload();

    } catch (error) {
        console.error('Error completing onboarding:', error);
        showOnboardingError(error.message || 'Hubo un error. Por favor intenta de nuevo.');

        // Ocultar loading y habilitar botón
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (submitButton) submitButton.disabled = false;
    }
}

// Mostrar error en onboarding
function showOnboardingError(message) {
    const errorDiv = $('#onboarding-error');
    if (errorDiv) {
        const errorText = errorDiv.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        }
        errorDiv.style.display = 'block';
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
