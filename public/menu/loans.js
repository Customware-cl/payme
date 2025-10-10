// Estado de la aplicación
const state = {
    token: null,
    loans: {
        lent: [],
        borrowed: []
    }
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';

// Utilidades
const $ = (selector) => document.querySelector(selector);

function formatMoney(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function isOverdue(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
}

// Inicialización
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    console.log('Loans page initialized', { hasToken: !!state.token });

    if (!state.token) {
        alert('Token inválido o expirado');
        window.location.href = '/menu';
        return;
    }

    setupEventListeners();
    await loadLoans();
}

// Setup event listeners
function setupEventListeners() {
    // Volver al menú
    $('#back-to-menu').addEventListener('click', () => {
        window.location.href = `/menu?token=${state.token}`;
    });

    // Botón crear préstamo desde empty state
    const btnNewLoanEmpty = $('#btn-new-loan-empty');
    if (btnNewLoanEmpty) {
        btnNewLoanEmpty.addEventListener('click', () => {
            window.location.href = `/loan-form?token=${state.token}`;
        });
    }
}

// Cargar préstamos
async function loadLoans() {
    const loadingState = $('#loading-state');
    const emptyState = $('#empty-state');
    const loansContent = $('#loans-content');

    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    loansContent.classList.add('hidden');

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=loans`
        );

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al cargar préstamos');
        }

        state.loans = data.loans;

        console.log('Loans loaded:', state.loans);

        // Si no hay préstamos, mostrar empty state
        if (state.loans.lent.length === 0 && state.loans.borrowed.length === 0) {
            loadingState.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        // Renderizar préstamos
        renderLoans();

        loadingState.classList.add('hidden');
        loansContent.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading loans:', error);
        loadingState.classList.add('hidden');
        alert('Error al cargar préstamos: ' + error.message);
    }
}

// Renderizar préstamos
function renderLoans() {
    // Renderizar préstamos que hiciste
    const lentList = $('#lent-list');
    const lentSection = $('#lent-section');

    if (state.loans.lent.length === 0) {
        lentSection.classList.add('hidden');
    } else {
        lentSection.classList.remove('hidden');
        lentList.innerHTML = state.loans.lent.map(loan => renderLoanCard(loan, 'lent')).join('');
    }

    // Renderizar préstamos que te hicieron
    const borrowedList = $('#borrowed-list');
    const borrowedSection = $('#borrowed-section');

    if (state.loans.borrowed.length === 0) {
        borrowedSection.classList.add('hidden');
    } else {
        borrowedSection.classList.remove('hidden');
        borrowedList.innerHTML = state.loans.borrowed.map(loan => renderLoanCard(loan, 'borrowed')).join('');
    }

    // Agregar event listeners a las tarjetas
    document.querySelectorAll('.loan-card').forEach(card => {
        card.addEventListener('click', () => {
            const loanId = card.dataset.loanId;
            window.location.href = `/menu/loan-detail.html?token=${state.token}&loan_id=${loanId}`;
        });
    });
}

// Renderizar tarjeta de préstamo
function renderLoanCard(loan, type) {
    const isPending = loan.status === 'pending_confirmation';
    const overdue = isOverdue(loan.due_date);

    // Determinar quién es el contacto relacionado
    const contact = type === 'lent' ? loan.borrower : loan.lender;
    const contactName = contact ? contact.name : 'Contacto desconocido';

    // Determinar el texto del préstamo
    let loanText = '';
    if (loan.amount) {
        loanText = formatMoney(loan.amount);
    } else {
        loanText = loan.item_description || 'Objeto';
    }

    // Status badge
    let statusBadge = '';
    if (isPending) {
        statusBadge = '<span class="status-badge pending">⏳ Pendiente</span>';
    } else if (overdue) {
        statusBadge = '<span class="status-badge overdue">⚠️ Vencido</span>';
    }

    return `
        <div class="loan-card" data-loan-id="${loan.id}">
            <div class="loan-card-header">
                <div class="loan-contact">${type === 'lent' ? 'A' : 'De'} <strong>${contactName}</strong></div>
                ${statusBadge}
            </div>
            <div class="loan-card-body">
                <div class="loan-amount">${loanText}</div>
                <div class="loan-due-date">Vence: ${formatDate(loan.due_date)}</div>
            </div>
            <div class="loan-card-arrow">›</div>
        </div>
    `;
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
