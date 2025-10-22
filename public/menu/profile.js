// Estado de la aplicación
const state = {
    token: null,
    contactId: null,
    profileData: null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const PROFILE_ENDPOINT = `${SUPABASE_URL}/functions/v1/menu-data`;

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

    console.log('Profile initialized', { token: state.token });

    // Setup event listeners
    setupEventListeners();

    // Cargar datos del perfil
    await loadProfile();
}

// Event Listeners
function setupEventListeners() {
    $('#btn-back').addEventListener('click', () => {
        window.location.href = `/menu?token=${state.token}`;
    });

    $('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });
}

// Cargar perfil con caché y progressive loading
async function loadProfile() {
    try {
        // 1. Intentar cargar desde caché primero (stale-while-revalidate)
        const cachedData = CacheManager.get(state.token, 'profile');

        if (cachedData) {
            console.log('[Profile] Using cached data');
            renderProfile(cachedData);

            // Si el caché está stale, revalidar en background sin loader
            if (CacheManager.isStale(state.token, 'profile')) {
                console.log('[Profile] Cache is stale, revalidating in background...');
                revalidateProfile();
            }
            return;
        }

        // 2. No hay caché, mostrar loader y hacer fetch
        console.log('[Profile] No cache, fetching from API...');
        showLoader(true);

        const data = await fetchProfile();

        if (data) {
            // Guardar en caché
            CacheManager.set(state.token, 'profile', data);
            renderProfile(data);
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Error al cargar el perfil');
    } finally {
        showLoader(false);
    }
}

// Fetch datos del perfil
async function fetchProfile() {
    try {
        const response = await fetch(`${PROFILE_ENDPOINT}?token=${state.token}&type=profile`);
        const data = await response.json();

        if (data.success) {
            return data;
        } else {
            console.log('No profile data found');
            return null;
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}

// Renderizar datos del perfil
function renderProfile(data) {
    if (data.profile) {
        state.profileData = data.profile;
        state.contactId = data.contact_id;

        // Rellenar formulario con transición suave
        if (data.profile.first_name) {
            $('#first-name').value = data.profile.first_name;
        }
        if (data.profile.last_name) {
            $('#last-name').value = data.profile.last_name;
        }
        if (data.profile.email) {
            $('#email').value = data.profile.email;
        }

        console.log('Profile loaded:', data.profile);
    } else {
        console.log('No profile data found, starting with empty form');
    }
}

// Revalidar perfil en background
async function revalidateProfile() {
    try {
        const data = await fetchProfile();

        if (data) {
            // Actualizar caché
            CacheManager.set(state.token, 'profile', data);

            // Actualizar UI silenciosamente si cambió
            const currentFirstName = $('#first-name').value;
            const currentLastName = $('#last-name').value;

            if (data.profile) {
                const changed =
                    currentFirstName !== (data.profile.first_name || '') ||
                    currentLastName !== (data.profile.last_name || '');

                if (changed) {
                    console.log('[Profile] Data changed, updating UI');
                    renderProfile(data);
                }
            }
        }
    } catch (error) {
        console.error('Error revalidating profile:', error);
        // No hacer nada, mantener caché existente
    }
}

// Guardar perfil
async function saveProfile() {
    showLoader(true, 'Guardando...');

    try {
        const formData = {
            token: state.token,
            type: 'profile',
            data: {
                first_name: $('#first-name').value.trim(),
                last_name: $('#last-name').value.trim(),
                email: $('#email').value.trim() || null
            }
        };

        const response = await fetch(PROFILE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            // Invalidar caché para forzar recarga en la próxima visita
            CacheManager.invalidate(state.token, 'profile');
            CacheManager.invalidate(state.token, 'user'); // También invalidar user para actualizar nombre

            showToast('✅ Perfil guardado correctamente');
            setTimeout(() => {
                window.location.href = `/menu?token=${state.token}`;
            }, 1500);
        } else {
            throw new Error(data.error || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Error al guardar el perfil. Intenta de nuevo.');
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
