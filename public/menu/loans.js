// Estado de la aplicación
const state = {
    token: null,
    loanType: null, // 'lent' | 'borrowed' | null
    loans: {
        lent: [],
        borrowed: []
    },
    viewMode: 'grouped', // 'grouped' | 'detailed'
    drawerOpen: false,
    currentGroup: null
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

function formatDateTime(isoString) {
    const date = new Date(isoString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${hours}:${minutes}`;
}

// Agrupar préstamos de dinero por contacto + fecha de devolución
function groupLoansByContactAndDate(loans, type) {
    // 1. Separar dinero y objetos usando loan_type (con fallback para datos legacy)
    const moneyLoans = loans.filter(l =>
        l.loan_type === 'money' ||
        (l.loan_type === 'unknown' && l.amount !== null && l.amount > 0)
    );
    const objectLoans = loans.filter(l =>
        l.loan_type === 'object' ||
        (l.loan_type === 'unknown' && (l.amount === null || l.amount === 0))
    );

    // 2. Agrupar préstamos de dinero por contacto + fecha
    const groups = new Map();

    moneyLoans.forEach(loan => {
        const contact = type === 'lent' ? loan.borrower : loan.lender;
        const contactId = contact?.id || 'unknown';
        const dueDate = loan.due_date;
        const groupKey = `${contactId}_${dueDate}`;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(loan);
    });

    // 3. Crear resultado con grupos y préstamos individuales
    const result = [];

    // Agregar grupos (2+ préstamos) o individuales (1 préstamo)
    groups.forEach((groupLoans, groupKey) => {
        if (groupLoans.length >= 2) {
            // Grupo: calcular total y crear objeto agrupado
            const totalAmount = groupLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
            const contact = type === 'lent' ? groupLoans[0].borrower : groupLoans[0].lender;
            const dueDate = groupLoans[0].due_date;

            // Determinar estado del grupo (pendiente si al menos 1 está pendiente)
            const hasPending = groupLoans.some(l => l.status === 'pending_confirmation');

            result.push({
                isGroup: true,
                groupKey: groupKey,
                contact: contact,
                totalAmount: totalAmount,
                dueDate: dueDate,
                count: groupLoans.length,
                status: hasPending ? 'pending_confirmation' : groupLoans[0].status,
                loans: groupLoans.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
                type: type
            });
        } else {
            // Préstamo individual
            result.push(groupLoans[0]);
        }
    });

    // 4. Agregar objetos (siempre individuales)
    objectLoans.forEach(loan => result.push(loan));

    // 5. Ordenar por fecha de devolución
    result.sort((a, b) => {
        const dateA = a.isGroup ? a.dueDate : a.due_date;
        const dateB = b.isGroup ? b.dueDate : b.due_date;
        return new Date(dateA) - new Date(dateB);
    });

    return result;
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

    // Mostrar pantalla de selección (NO cargar préstamos aún)
    showDirectionScreen();
}

// Setup event listeners
function setupEventListeners() {
    // Botones de selección de tipo de préstamo
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const loanType = btn.dataset.loanType;
            state.loanType = loanType;
            loadLoansForType(loanType);
        });
    });

    // Back desde screen-direction → menú
    $('#back-to-menu-from-direction').addEventListener('click', () => {
        window.location.href = `/menu?token=${state.token}`;
    });

    // Back desde loans-content → screen-direction
    $('#back-to-direction').addEventListener('click', () => {
        goBackToDirectionScreen();
    });

    // Botón crear préstamo desde empty state
    const btnNewLoanEmpty = $('#btn-new-loan-empty');
    if (btnNewLoanEmpty) {
        btnNewLoanEmpty.addEventListener('click', () => {
            window.location.href = `/loan-form?token=${state.token}`;
        });
    }

    // Toggle de vista (agrupada/detallada)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            state.viewMode = view;

            // Guardar en localStorage
            localStorage.setItem('loansViewMode', view);

            // Actualizar UI del toggle
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-renderizar con el tipo seleccionado
            renderLoansForType(state.loanType);
        });
    });

    // Cerrar drawer (botón X)
    const btnCloseDrawer = $('#btn-close-drawer');
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', closeDrawer);
    }

    // Cerrar drawer (click en overlay)
    const drawerOverlay = document.querySelector('#drawer-grouped-loans .drawer-overlay');
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeDrawer);
    }

    // Cargar preferencia de vista desde localStorage
    const savedViewMode = localStorage.getItem('loansViewMode');
    if (savedViewMode && (savedViewMode === 'grouped' || savedViewMode === 'detailed')) {
        state.viewMode = savedViewMode;

        // Actualizar UI del toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            if (btn.dataset.view === savedViewMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// Mostrar pantalla de selección de tipo
function showDirectionScreen() {
    const screenDirection = $('#screen-direction');
    const loansViewContainer = $('#loans-view-container');

    // Mostrar solo screen-direction, ocultar todo lo demás
    screenDirection.classList.add('active');
    loansViewContainer.classList.add('hidden');
}

// Volver a la pantalla de selección
function goBackToDirectionScreen() {
    // Resetear estado
    state.loanType = null;

    // Mostrar screen-direction
    showDirectionScreen();
}

// Cargar préstamos para el tipo seleccionado
async function loadLoansForType(loanType) {
    const screenDirection = $('#screen-direction');
    const loansViewContainer = $('#loans-view-container');
    const loansHeader = $('#loans-header');
    const loadingState = $('#loading-state');
    const emptyState = $('#empty-state');
    const loansContent = $('#loans-content');

    // Ocultar screen-direction y mostrar loans view container
    screenDirection.classList.remove('active');
    loansViewContainer.classList.remove('hidden');

    // Mostrar loading dentro del container
    loansHeader.classList.remove('hidden');
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    loansContent.classList.add('hidden');

    // Actualizar título del header según el tipo
    const title = loanType === 'lent' ? 'Préstamos que hiciste' : 'Préstamos que te hicieron';
    $('#loans-title').textContent = title;
    $('#loans-subtitle').textContent = 'Revisa tus préstamos';

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

        // Verificar si hay préstamos del tipo seleccionado
        const loansForType = state.loans[loanType];

        if (loansForType.length === 0) {
            // No hay préstamos de este tipo
            loadingState.classList.add('hidden');
            emptyState.classList.remove('hidden');

            // Actualizar mensaje del empty state
            const emptyTitle = loanType === 'lent' ? 'No has prestado aún' : 'No te han prestado aún';
            const emptyMessage = loanType === 'lent'
                ? 'Cuando prestes dinero u objetos aparecerán aquí'
                : 'Cuando te presten dinero u objetos aparecerán aquí';

            $('#empty-title').textContent = emptyTitle;
            $('#empty-message').textContent = emptyMessage;

            return;
        }

        // Mostrar préstamos
        loadingState.classList.add('hidden');
        loansContent.classList.remove('hidden');

        // Renderizar préstamos del tipo seleccionado
        renderLoansForType(loanType);

    } catch (error) {
        console.error('Error loading loans:', error);
        loadingState.classList.add('hidden');
        alert('Error al cargar préstamos: ' + error.message);
    }
}

// Renderizar préstamos para el tipo seleccionado
function renderLoansForType(loanType) {
    if (!loanType) return;

    // Obtener préstamos del tipo seleccionado
    const loansData = state.loans[loanType];

    // Ordenar por fecha ascendente
    loansData.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    // Actualizar título de la sección
    const sectionTitle = loanType === 'lent' ? '💰 Préstamos que hiciste' : '📥 Préstamos que te hicieron';
    $('#section-title').textContent = sectionTitle;

    // Renderizar según modo de vista
    const loansList = $('#loans-list');

    if (state.viewMode === 'grouped') {
        // Vista agrupada
        const grouped = groupLoansByContactAndDate(loansData, loanType);
        loansList.innerHTML = grouped.map(item =>
            item.isGroup ? renderGroupedLoanCard(item, loanType) : renderLoanCard(item, loanType)
        ).join('');
    } else {
        // Vista detallada
        loansList.innerHTML = loansData.map(loan => renderLoanCard(loan, loanType)).join('');
    }

    attachLoanCardListeners();
}

// Renderizar tarjeta agrupada
function renderGroupedLoanCard(group, type) {
    const isPending = group.status === 'pending_confirmation';
    const overdue = isOverdue(group.dueDate);
    const contactName = group.contact?.name || 'Contacto desconocido';

    let statusBadge = '';
    if (isPending) {
        statusBadge = '<span class="status-badge pending">⏳ Pendiente</span>';
    } else if (overdue) {
        statusBadge = '<span class="status-badge overdue">⚠️ Vencido</span>';
    }

    return `
        <div class="loan-card loan-card-grouped" data-group-key="${group.groupKey}">
            <div class="loan-card-header">
                <div class="loan-contact">${type === 'lent' ? 'A' : 'De'} <strong>${contactName}</strong></div>
                ${statusBadge}
            </div>
            <div class="loan-card-body">
                <div class="loan-amount">💰 ${formatMoney(group.totalAmount)}</div>
                <div class="loan-meta">
                    <span class="loan-count">${group.count} préstamos</span>
                    <span class="loan-separator">•</span>
                    <span class="loan-due-date">Vence: ${formatDate(group.dueDate)}</span>
                </div>
            </div>
            <div class="loan-card-arrow">›</div>
        </div>
    `;
}

// Agregar event listeners a tarjetas
function attachLoanCardListeners() {
    // Tarjetas agrupadas (abrir drawer)
    document.querySelectorAll('.loan-card-grouped').forEach(card => {
        card.addEventListener('click', () => {
            const groupKey = card.dataset.groupKey;
            openDrawer(groupKey);
        });
    });

    // Tarjetas individuales (ir a detalle)
    document.querySelectorAll('.loan-card:not(.loan-card-grouped)').forEach(card => {
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

    // Determinar el texto del préstamo con icono (usando loan_type)
    let loanIcon = '';
    let loanText = '';
    const isMoneyLoan = loan.loan_type === 'money' ||
        (loan.loan_type === 'unknown' && loan.amount !== null && loan.amount > 0);

    if (isMoneyLoan) {
        loanIcon = '💰';
        loanText = formatMoney(loan.amount);
    } else {
        loanIcon = '📦';
        loanText = loan.item_description || loan.title || 'Objeto';
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

// Abrir drawer con detalles de grupo
function openDrawer(groupKey) {
    // Buscar grupo en lent o borrowed
    const groupedLent = groupLoansByContactAndDate(state.loans.lent, 'lent');
    const groupedBorrowed = groupLoansByContactAndDate(state.loans.borrowed, 'borrowed');

    const group = [...groupedLent, ...groupedBorrowed].find(g => g.groupKey === groupKey);

    if (!group || !group.isGroup) return;

    state.currentGroup = group;
    state.drawerOpen = true;

    // Actualizar contenido del drawer
    $('#drawer-contact-name').textContent = group.contact?.name || 'Contacto';
    $('#drawer-total').textContent = `💰 ${formatMoney(group.totalAmount)}`;
    $('#drawer-count').textContent = `${group.count} préstamos`;

    // Renderizar lista de préstamos
    const drawerList = $('#drawer-loans-list');
    drawerList.innerHTML = group.loans.map(loan => {
        // Usar el campo description de la tabla agreements
        const concept = loan.description || 'Sin concepto';
        return `
            <div class="drawer-loan-item" data-loan-id="${loan.id}">
                <div class="drawer-loan-amount">${formatMoney(loan.amount)}</div>
                <div class="drawer-loan-concept">${concept}</div>
                <div class="drawer-loan-created">Creado: ${formatDateTime(loan.created_at)}</div>
                <div class="drawer-loan-arrow">›</div>
            </div>
        `;
    }).join('');

    // Mostrar drawer con animación
    const drawer = $('#drawer-grouped-loans');
    drawer.classList.remove('hidden');
    setTimeout(() => drawer.classList.add('open'), 10);

    // Event listeners para sub-items
    document.querySelectorAll('.drawer-loan-item').forEach(item => {
        item.addEventListener('click', () => {
            const loanId = item.dataset.loanId;
            closeDrawer();
            setTimeout(() => {
                window.location.href = `/menu/loan-detail.html?token=${state.token}&loan_id=${loanId}`;
            }, 300);
        });
    });
}

// Cerrar drawer
function closeDrawer() {
    const drawer = $('#drawer-grouped-loans');
    drawer.classList.remove('open');
    setTimeout(() => {
        drawer.classList.add('hidden');
        state.drawerOpen = false;
        state.currentGroup = null;
    }, 300);
}

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
