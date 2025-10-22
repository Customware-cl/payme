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

    // Setup event listeners primero
    setupEventListeners();

    // Cargar datos de usuario (combinado: validación + nombre + onboarding check)
    if (state.token) {
        await loadUserData();
    } else {
        showExpiredScreen();
    }
}

// Cargar datos del usuario (combinado: validación + nombre + onboarding check)
async function loadUserData() {
    const greetingNameEl = $('#greeting-name');

    try {
        // 1. Intentar cargar desde caché primero (stale-while-revalidate)
        const cachedData = CacheManager.get(state.token, 'user');

        if (cachedData) {
            console.log('[Menu] Using cached data');
            renderUserData(cachedData);

            // Si el caché está stale (cerca de expirar), revalidar en background
            if (CacheManager.isStale(state.token, 'user')) {
                console.log('[Menu] Cache is stale, revalidating in background...');
                revalidateUserData();
            }
            return;
        }

        // 2. No hay caché, hacer fetch (mostrar skeleton durante carga)
        console.log('[Menu] No cache, fetching from API...');
        const data = await fetchUserData();

        if (!data) {
            showExpiredScreen();
            return;
        }

        // Guardar en caché
        CacheManager.set(state.token, 'user', data);

        // Renderizar datos
        renderUserData(data);

    } catch (error) {
        console.error('Error loading user data:', error);
        showExpiredScreen();
    }
}

// Fetch de datos del usuario
async function fetchUserData() {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`);

        if (response.status === 401) {
            console.log('Token invalid or expired (401)');
            return null;
        }

        const data = await response.json();

        if (!data.success) {
            console.log('API error:', data.error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// Renderizar datos del usuario
function renderUserData(data) {
    const greetingNameEl = $('#greeting-name');

    // Verificar si requiere onboarding
    if (data.requires_onboarding) {
        console.log('User requires onboarding');
        showOnboardingScreen();
        return;
    }

    // Mostrar nombre con transición suave
    if (data.name && greetingNameEl) {
        // Remover skeleton y mostrar nombre con fade-in
        greetingNameEl.innerHTML = `<span class="fade-in">${data.name}</span>`;
    }
}

// Revalidar datos en background
async function revalidateUserData() {
    try {
        const data = await fetchUserData();

        if (data) {
            // Actualizar caché
            CacheManager.set(state.token, 'user', data);

            // Si los datos cambiaron, actualizar UI silenciosamente
            const greetingNameEl = $('#greeting-name');
            const currentName = greetingNameEl?.textContent?.trim();

            if (data.name && currentName !== data.name) {
                console.log('[Menu] Name changed, updating UI');
                renderUserData(data);
            }
        }
    } catch (error) {
        console.error('Error revalidating user data:', error);
        // No hacer nada, mantener caché existente
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

// Función removida: ahora se usa loadUserData() que es más eficiente

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
