// Estado de la aplicación
const state = {
    token: null,
    loans: {
        lent: [],
        borrowed: []
    },
    currentFilter: null // 'money' | 'objects' | null
};

// Configuración
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';

// Utilidades
const $ = (selector) => document.querySelector(selector);

function formatMoney(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function formatDate(dateString) {
    // Parsear fecha como local (sin offset UTC)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function isOverdue(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parsear fecha como local (sin offset UTC)
    const [year, month, day] = dueDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
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

    // Filtros del submenú
    $('#filter-money').addEventListener('click', () => {
        state.currentFilter = 'money';
        filterAndRenderLoans();
    });

    $('#filter-objects').addEventListener('click', () => {
        state.currentFilter = 'objects';
        filterAndRenderLoans();
    });
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

        // Mostrar submenú de filtros
        showFilterMenu();

    } catch (error) {
        console.error('Error loading loans:', error);
        loadingState.classList.add('hidden');
        alert('Error al cargar préstamos: ' + error.message);
    }
}

// Mostrar submenú de filtros
function showFilterMenu() {
    const filterMenu = $('#filter-menu');
    const loadingState = $('#loading-state');
    const emptyState = $('#empty-state');
    const loansContent = $('#loans-content');

    // Contar préstamos por tipo
    const allLoans = [...state.loans.lent, ...state.loans.borrowed];
    const moneyCount = allLoans.filter(l => l.amount !== null).length;
    const objectsCount = allLoans.filter(l => l.amount === null).length;

    // Actualizar contadores
    $('#money-count').textContent = moneyCount === 1 ? '1 préstamo' : `${moneyCount} préstamos`;
    $('#objects-count').textContent = objectsCount === 1 ? '1 préstamo' : `${objectsCount} préstamos`;

    // Mostrar solo el menú de filtros
    filterMenu.classList.remove('hidden');
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    loansContent.classList.add('hidden');
}

// Filtrar y renderizar préstamos
function filterAndRenderLoans() {
    const filterMenu = $('#filter-menu');
    const loansContent = $('#loans-content');

    // Filtrar según el tipo seleccionado
    const filtered = {
        lent: state.loans.lent.filter(loan => {
            if (state.currentFilter === 'money') {
                return loan.amount !== null;
            } else if (state.currentFilter === 'objects') {
                return loan.amount === null;
            }
            return true;
        }),
        borrowed: state.loans.borrowed.filter(loan => {
            if (state.currentFilter === 'money') {
                return loan.amount !== null;
            } else if (state.currentFilter === 'objects') {
                return loan.amount === null;
            }
            return true;
        })
    };

    // Ordenar por fecha ascendente (próximos a vencer primero)
    filtered.lent.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    filtered.borrowed.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    // Renderizar con datos filtrados
    renderLoans(filtered);

    // Ocultar menú, mostrar préstamos
    filterMenu.classList.add('hidden');
    loansContent.classList.remove('hidden');
}

// Renderizar préstamos
function renderLoans(loansData = state.loans) {
    // Renderizar préstamos que hiciste
    const lentList = $('#lent-list');
    const lentSection = $('#lent-section');

    if (loansData.lent.length === 0) {
        lentSection.classList.add('hidden');
    } else {
        lentSection.classList.remove('hidden');
        lentList.innerHTML = loansData.lent.map(loan => renderLoanCard(loan, 'lent')).join('');
    }

    // Renderizar préstamos que te hicieron
    const borrowedList = $('#borrowed-list');
    const borrowedSection = $('#borrowed-section');

    if (loansData.borrowed.length === 0) {
        borrowedSection.classList.add('hidden');
    } else {
        borrowedSection.classList.remove('hidden');
        borrowedList.innerHTML = loansData.borrowed.map(loan => renderLoanCard(loan, 'borrowed')).join('');
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

    // Determinar el texto del préstamo con icono
    let loanIcon = '';
    let loanText = '';
    if (loan.amount !== null) {
        loanIcon = '💰';
        loanText = formatMoney(loan.amount);
    } else {
        loanIcon = '📦';
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
                <div class="loan-amount">${loanIcon} ${loanText}</div>
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
