// Estado de la aplicación
const state = {
    token: null,
    loanId: null,
    loan: null,
    userRole: null, // 'lender' or 'borrower'
    pendingAction: null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const LOAN_ACTIONS_ENDPOINT = `${SUPABASE_URL}/functions/v1/loan-actions`;

// Utilidades
const $ = (selector) => document.querySelector(selector);

function formatMoney(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function showLoader(show = true) {
    $('#loader').classList.toggle('hidden', !show);
}

function showToast(message, duration = 3000) {
    const toast = $('#toast');
    const toastMessage = $('#toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function isOverdue(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = dueDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);
    return due < today;
}

// Inicialización
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');
    state.loanId = urlParams.get('loan_id');

    if (!state.token || !state.loanId) {
        showToast('Token o ID de préstamo inválido', 5000);
        setTimeout(() => window.location.href = '/menu', 3000);
        return;
    }

    setupEventListeners();
    await loadLoanDetails();
}

// Setup event listeners
function setupEventListeners() {
    // Volver a loans
    $('#back-to-loans').addEventListener('click', () => {
        window.location.href = `/menu/loans.html?token=${state.token}`;
    });

    // Modales
    $('#btn-close-confirm').addEventListener('click', closeConfirmModal);
    $('#btn-cancel-confirm').addEventListener('click', closeConfirmModal);
    $('#btn-confirm-action').addEventListener('click', executeAction);

    $('#btn-close-edit-date').addEventListener('click', closeEditDateModal);
    $('#btn-cancel-edit-date').addEventListener('click', closeEditDateModal);
    $('#btn-save-edit-date').addEventListener('click', saveNewDate);
}

// Cargar detalles del préstamo
async function loadLoanDetails() {
    showLoader(true);

    try {
        const response = await fetch(
            `${LOAN_ACTIONS_ENDPOINT}?token=${state.token}&loan_id=${state.loanId}&action=get_detail`
        );

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al cargar el préstamo');
        }

        state.loan = data.loan;
        state.userRole = data.userRole;

        renderLoanDetails();
        renderActionButtons();

        $('#loan-content').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading loan:', error);
        showToast('Error al cargar el préstamo: ' + error.message, 5000);
        setTimeout(() => window.location.href = `/menu/loans.html?token=${state.token}`, 3000);
    } finally {
        showLoader(false);
    }
}

// Renderizar detalles del préstamo
function renderLoanDetails() {
    const { loan, userRole } = state;
    const isPending = loan.status === 'pending_confirmation';
    const overdue = isOverdue(loan.due_date);

    // Título del header
    const headerTitle = userRole === 'lender' ? 'Préstamo que hiciste' : 'Préstamo que te hicieron';
    $('#loan-title').textContent = headerTitle;

    // Tipo (Préstamo de dinero o préstamo de objeto) - usando loan_type
    const isMoneyLoan = loan.loan_type === 'money' ||
        (loan.loan_type === 'unknown' && loan.amount !== null && loan.amount > 0);
    const loanTypeLabel = isMoneyLoan ? '💰 Préstamo de dinero' : '📦 Préstamo de objeto';
    $('#detail-type').textContent = loanTypeLabel;

    // Contacto
    const contactLabel = userRole === 'lender' ? 'A quien le prestaste' : 'Quien te prestó';
    const contact = userRole === 'lender' ? loan.borrower : loan.lender;
    $('#contact-label').textContent = contactLabel;
    $('#detail-contact').textContent = contact ? contact.name : 'Contacto desconocido';

    // Préstamo (dinero u objeto) - usando loan_type
    let loanDisplayText = '';
    if (isMoneyLoan) {
        loanDisplayText = formatMoney(loan.amount);
    } else {
        loanDisplayText = loan.item_description || loan.title || 'Objeto';
    }
    $('#detail-loan').textContent = loanDisplayText;

    // Concepto/Descripción del préstamo
    const descriptionRow = $('#detail-description-row');
    const descriptionValue = $('#detail-description');

    // Usar el campo description de la tabla agreements
    const concept = loan.description;

    if (concept && concept.trim() !== '') {
        descriptionValue.textContent = concept;
        descriptionRow.style.display = 'flex';
    } else {
        descriptionRow.style.display = 'none';
    }

    // Fecha de devolución
    let dueDateText = formatDate(loan.due_date);
    if (overdue && loan.status === 'active') {
        dueDateText += ' Vencido';
    }
    $('#detail-due-date').textContent = dueDateText;

    // Estado
    let statusText = '';
    if (isPending) {
        statusText = '⏳ Confirmación pendiente';
    } else if (loan.status === 'active' && overdue) {
        statusText = '⚠️ Vencido';
    } else if (loan.status === 'active') {
        statusText = '✅ Activo';
    } else if (loan.status === 'completed') {
        statusText = '✔️ Devuelto';
    } else if (loan.status === 'rejected') {
        statusText = '❌ Rechazado';
    } else if (loan.status === 'cancelled') {
        statusText = '🚫 Cancelado';
    }
    $('#detail-status').textContent = statusText;

    // Fecha de creación
    $('#detail-created').textContent = formatDateTime(loan.created_at);

    // Mostrar imagen si existe
    const imageSection = $('#loan-image-section');
    const loanImage = $('#loan-image');

    if (loan.metadata && loan.metadata.image_url) {
        loanImage.src = loan.metadata.image_url;
        imageSection.classList.remove('hidden');
    } else {
        imageSection.classList.add('hidden');
    }
}

// Renderizar botones de acción
function renderActionButtons() {
    const { loan, userRole } = state;
    const isPending = loan.status === 'pending_confirmation';
    const isActive = loan.status === 'active';
    const overdue = isActive && isOverdue(loan.due_date);
    const container = $('#action-buttons');

    // Limpiar botones existentes
    container.innerHTML = '';

    // Definir acciones según rol y estado
    let actions = [];

    if (userRole === 'lender' && isPending) {
        actions = [
            { icon: '🔔', text: 'Reenviar solicitud', action: 'resend', style: 'secondary' },
            { icon: '❌', text: 'Cancelar solicitud', action: 'cancel', style: 'danger' }
        ];
    } else if (userRole === 'lender' && isActive && overdue) {
        // Prestamista con préstamo vencido (orden: positivo → negativo)
        actions = [
            { icon: '✅', text: 'Marcar como devuelto', action: 'mark_returned', style: 'primary' },
            { icon: '📝', text: 'Renegociar fecha', action: 'edit_date', style: 'secondary' },
            { icon: '🚨', text: 'Enviar recordatorio', action: 'remind', style: 'secondary' },
            { icon: '❌', text: 'Cancelar/Condonar préstamo', action: 'cancel', style: 'danger' }
        ];
    } else if (userRole === 'lender' && isActive) {
        // Prestamista con préstamo activo no vencido (orden: positivo → negativo)
        actions = [
            { icon: '✅', text: 'Marcar como devuelto', action: 'mark_returned', style: 'primary' },
            { icon: '📝', text: 'Editar fecha de devolución', action: 'edit_date', style: 'secondary' },
            { icon: '🔔', text: 'Enviar recordatorio', action: 'remind', style: 'secondary' },
            { icon: '❌', text: 'Cancelar préstamo', action: 'cancel', style: 'danger' }
        ];
    } else if (userRole === 'borrower' && isPending) {
        actions = [
            { icon: '✅', text: 'Confirmar préstamo', action: 'confirm', style: 'primary' },
            { icon: '❌', text: 'Rechazar préstamo', action: 'reject', style: 'danger' }
        ];
    } else if (userRole === 'borrower' && isActive) {
        // Prestatario con préstamo activo (vencido o no)
        actions = [
            { icon: '✅', text: 'Marcar como devuelto', action: 'mark_returned', style: 'primary' },
            { icon: '📝', text: 'Solicitar más plazo', action: 'request_extension', style: 'secondary' }
        ];
    }

    // Renderizar botones
    actions.forEach(({ icon, text, action, style }) => {
        const btn = document.createElement('button');
        btn.className = `btn-${style}`;
        btn.innerHTML = `${icon} ${text}`;
        btn.dataset.action = action;
        btn.addEventListener('click', () => handleAction(action));
        container.appendChild(btn);
    });

    // Agregar mensaje conciliador para prestatarios con préstamos activos
    if (userRole === 'borrower' && isActive) {
        const contact = loan.lender;
        const contactName = contact ? contact.name : 'tu prestamista';
        const adviceMessage = document.createElement('div');
        adviceMessage.className = 'advice-message';
        adviceMessage.innerHTML = `💬 <em>Te recomendamos conversar con ${contactName} en caso que presentes inconvenientes</em>`;
        container.appendChild(adviceMessage);
    }
}

// Manejar acciones
async function handleAction(action) {
    state.pendingAction = action;

    switch (action) {
        case 'confirm':
            showConfirmModal(
                'Confirmar préstamo',
                '¿Confirmas que recibiste este préstamo? Esta acción no se puede deshacer.'
            );
            break;
        case 'reject':
            showConfirmModal(
                'Rechazar préstamo',
                '¿Estás seguro de rechazar este préstamo? El prestamista será notificado.'
            );
            break;
        case 'mark_returned':
            showConfirmModal(
                'Marcar como devuelto',
                '¿Confirmas que este préstamo ya fue devuelto?'
            );
            break;
        case 'cancel':
            showConfirmModal(
                'Cancelar préstamo',
                '¿Estás seguro de cancelar este préstamo? Esta acción no se puede deshacer.'
            );
            break;
        case 'remind':
            await executeActionDirect('remind');
            break;
        case 'resend':
            await executeActionDirect('resend');
            break;
        case 'request_extension':
            await executeActionDirect('request_extension');
            break;
        case 'edit_date':
            showEditDateModal();
            break;
        case 'contact':
            contactPerson();
            break;
        default:
            break;
    }
}

// Mostrar modal de confirmación
function showConfirmModal(title, message) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-modal').classList.remove('hidden');
}

// Cerrar modal de confirmación
function closeConfirmModal() {
    $('#confirm-modal').classList.add('hidden');
    state.pendingAction = null;
}

// Ejecutar acción confirmada
async function executeAction() {
    if (!state.pendingAction) return;

    const actionToExecute = state.pendingAction; // Guardar antes de cerrar
    closeConfirmModal();
    await executeActionDirect(actionToExecute);
}

// Ejecutar acción directamente (sin modal)
async function executeActionDirect(action) {
    showLoader(true);

    try {
        const response = await fetch(LOAN_ACTIONS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: state.token,
                loan_id: state.loanId,
                action: action
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al ejecutar la acción');
        }

        showToast(data.message || 'Acción ejecutada exitosamente', 3000);

        // Recargar detalles si el préstamo sigue existiendo
        if (action === 'confirm' || action === 'mark_returned' || action === 'reject' || action === 'cancel') {
            setTimeout(() => {
                window.location.href = `/menu/loans.html?token=${state.token}`;
            }, 2000);
        } else {
            await loadLoanDetails();
        }
    } catch (error) {
        console.error('Error executing action:', error);
        showToast('Error: ' + error.message, 5000);
    } finally {
        showLoader(false);
    }
}

// Mostrar modal de editar fecha
function showEditDateModal() {
    const today = new Date().toISOString().split('T')[0];
    $('#new-due-date').setAttribute('min', today);
    $('#new-due-date').value = state.loan.due_date;
    $('#edit-date-modal').classList.remove('hidden');
}

// Cerrar modal de editar fecha
function closeEditDateModal() {
    $('#edit-date-modal').classList.add('hidden');
}

// Guardar nueva fecha
async function saveNewDate() {
    const newDate = $('#new-due-date').value;

    if (!newDate) {
        showToast('Selecciona una fecha válida', 3000);
        return;
    }

    if (newDate === state.loan.due_date) {
        showToast('La fecha es la misma que antes', 3000);
        return;
    }

    closeEditDateModal();
    showLoader(true);

    try {
        const response = await fetch(LOAN_ACTIONS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: state.token,
                loan_id: state.loanId,
                action: 'edit_date',
                new_date: newDate
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al actualizar la fecha');
        }

        showToast('Fecha actualizada exitosamente', 3000);
        await loadLoanDetails();
    } catch (error) {
        console.error('Error updating date:', error);
        showToast('Error: ' + error.message, 5000);
    } finally {
        showLoader(false);
    }
}

// Contactar persona
function contactPerson() {
    const contact = state.userRole === 'borrower' ? state.loan.lender : state.loan.borrower;

    if (!contact || !contact.phone) {
        showToast('No hay número de teléfono disponible', 3000);
        return;
    }

    // Formatear el número para WhatsApp (quitar '+' y espacios)
    const phone = contact.phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hola ${contact.name}, te contacto sobre el préstamo que tenemos registrado.`);
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

    window.open(whatsappUrl, '_blank');
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
