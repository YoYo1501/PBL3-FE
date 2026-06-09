// 2. NAVIGATION
// =====================================================================
function initNavigation() {
    const menuItems = document.querySelectorAll('.menu-item[data-target]');
    const submenuItems = document.querySelectorAll('.submenu-item[data-target]');
    const requestMenuGroup = document.getElementById('request-menu-group');

    function activateSection(targetId) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.menu-item, .submenu-item').forEach(i => i.classList.remove('active'));
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add('active');
        if (targetId !== 'section-request' && requestMenuGroup) {
            requestMenuGroup.classList.remove('open');
            document.getElementById('request-menu-toggle')?.setAttribute('aria-expanded', 'false');
            document.getElementById('request-submenu')?.style.setProperty('display', 'none');
        }
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            activateSection(target);
            item.classList.add('active');
            onSectionActivated(target, null);
        });
    });

    submenuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target  = item.dataset.target;
            const reqType = item.dataset.reqType;
            activateSection(target);
            item.classList.add('active');
            if (requestMenuGroup) requestMenuGroup.classList.add('open');
            document.getElementById('request-menu-toggle')?.setAttribute('aria-expanded', 'true');
            document.getElementById('request-submenu')?.style.setProperty('display', 'block');
            onSectionActivated(target, reqType);
        });
    });
}

function activateStudentSection(targetId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item, .submenu-item').forEach(i => i.classList.remove('active'));
    const panel = document.getElementById(targetId);
    if (panel) panel.classList.add('active');
    const menuItem = document.querySelector(`.menu-item[data-target="${targetId}"]`);
    if (menuItem) menuItem.classList.add('active');
}

function handlePaymentReturnState() {
    // FE RETURN STEP 1: sau khi BE xu ly callback VNPAY, trinh duyet quay lai trang sinh vien
    // voi query paymentStatus/paymentInvoiceId. Neu khong co query nay thi khong lam gi.
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('paymentStatus');
    if (!paymentStatus) return;

    const paymentInvoiceId = params.get('paymentInvoiceId');
    // FE RETURN STEP 2: mo man hinh hoa don va load lai du lieu moi nhat tu BE.
    // Success thi hien tab bien lai, failed thi quay lai tab hoa don.
    activateStudentSection('section-invoice');
    loadMyInvoices({
        initialTab: paymentStatus === 'success' ? 'receipt' : 'invoice',
        selectedId: paymentInvoiceId
    });

    if (paymentStatus === 'success') {
        showToast('Thanh toán thành công! Hóa đơn đã được chuyển sang biên lai.');
    } else {
        showToast('Thanh toán chưa hoàn tất hoặc đã bị hủy.', true);
    }

    // FE RETURN STEP 3: xoa query paymentStatus khoi URL de refresh trang khong hien toast lai.
    params.delete('paymentStatus');
    params.delete('paymentInvoiceId');
    params.delete('paymentTxnId');
    params.delete('paymentCode');

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
}

function onSectionActivated(sectionId, extra) {
    lastStudentAutoRefreshAt = Date.now();
    switch (sectionId) {
        case 'section-info':     loadProfile();             break;
        case 'section-room':     loadMyRoom(); loadMyContract(); break;
        case 'section-contract': loadMyContract();          break;
        case 'section-facilities': loadFacilitiesSection(); break;
        case 'section-invoice':  loadMyInvoices();          break;
        case 'section-request':  loadRequestSection(extra); break;
        case 'section-notify':   loadNotifications();       break;
    }
}

// =====================================================================
// 3. SUB-TABS (Trong section Thông tin sinh viên)
// =====================================================================
const STUDENT_AUTO_REFRESH_INTERVAL_MS = 15000;
let lastStudentAutoRefreshAt = Date.now();
let pendingStudentRealtimeRefresh = false;
let studentRealtimeRefreshTimer = null;

function getActiveStudentSectionId() {
    return document.querySelector('.tab-panel.active')?.id || 'section-info';
}

function shouldPauseStudentAutoRefresh() {
    if (document.visibilityState !== 'visible') return true;
    const active = document.activeElement;
    if (active?.matches?.('input, textarea, select')) return true;
    if (document.body.classList.contains('modal-open')) return true;
    return false;
}

function refreshActiveStudentSection(force = false) {
    if (shouldPauseStudentAutoRefresh()) return;
    const now = Date.now();
    if (!force && now - lastStudentAutoRefreshAt < STUDENT_AUTO_REFRESH_INTERVAL_MS) return;
    lastStudentAutoRefreshAt = now;
    const sectionId = getActiveStudentSectionId();
    onSectionActivated(sectionId, sectionId === 'section-request' ? currentReqType : null);
    loadNotificationCount();
}

function scheduleStudentRealtimeRefresh() {
    if (shouldPauseStudentAutoRefresh()) {
        pendingStudentRealtimeRefresh = true;
        return;
    }
    window.clearTimeout(studentRealtimeRefreshTimer);
    studentRealtimeRefreshTimer = window.setTimeout(() => {
        refreshActiveStudentSection(true);
    }, 250);
}

function bindStudentAutoRefresh() {
    lastStudentAutoRefreshAt = Date.now();
    let lastHandledChangeAt = 0;
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) refreshActiveStudentSection(true);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (pendingStudentRealtimeRefresh) {
            pendingStudentRealtimeRefresh = false;
            refreshActiveStudentSection(true);
            return;
        }
        refreshActiveStudentSection();
    });
    document.addEventListener('focusout', () => {
        if (!pendingStudentRealtimeRefresh) return;
        window.setTimeout(() => {
            if (shouldPauseStudentAutoRefresh()) return;
            pendingStudentRealtimeRefresh = false;
            refreshActiveStudentSection(true);
        }, 0);
    });
    if (typeof onDataChanged === 'function') {
        onDataChanged((detail = {}) => {
            const now = Date.now();
            if (detail.at && detail.at === lastHandledChangeAt) return;
            if (now - lastHandledChangeAt < 800) return;
            lastHandledChangeAt = detail.at || now;
            scheduleStudentRealtimeRefresh();
        });
    }
    window.setInterval(refreshActiveStudentSection, STUDENT_AUTO_REFRESH_INTERVAL_MS);
}

function initSubTabs() {
    document.querySelectorAll('.s-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.info;
            document.querySelectorAll('.s-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.info-sub-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const panel = document.getElementById(target);
            if (panel) panel.classList.add('active');
        });
    });
}

// =====================================================================
// 4. REQUEST MENU TOGGLE
// =====================================================================
function initRequestMenu() {
    const toggle = document.getElementById('request-menu-toggle');
    const submenu = document.getElementById('request-submenu');
    const group = document.getElementById('request-menu-group');
    if (!toggle || !submenu) return;
    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        submenu.style.display = expanded ? 'none' : 'block';
        if (group) group.classList.toggle('open', !expanded);
    });
}

// =====================================================================
// 5. LOGOUT
// =====================================================================
function initLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        const confirmLogout = typeof showAppConfirm === 'function'
            ? showAppConfirm({
                title: 'Đăng xuất',
                message: 'Bạn có chắc muốn đăng xuất khỏi hệ thống không?',
                confirmText: 'Đăng xuất',
                cancelText: 'Ở lại'
            })
            : Promise.resolve(confirm('Bạn có chắc muốn đăng xuất?'));

        confirmLogout.then(confirmed => {
            if (confirmed) logout();
        });
    });
}

function initWelcomeMenu() {
    const menu = document.getElementById('welcome-menu');
    const trigger = document.getElementById('welcome-trigger');
    if (!menu || !trigger) return;

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const opened = menu.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(opened));
    });

    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) {
            menu.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function initTopActions() {
    document.getElementById('top-notify-btn')?.addEventListener('click', () => {
        activateStudentSection('section-notify');
        loadNotifications();
    });

    document.querySelector('.support-btn')?.addEventListener('click', () => {
        const otherRequestItem = document.querySelector('.submenu-item[data-req-type="Other"]');
        if (otherRequestItem) {
            otherRequestItem.click();
            return;
        }

        activateStudentSection('section-request');
        loadRequestSection('Other');
    });
}

function initNotificationPanel() {
    document.querySelectorAll('.notify-tab[data-notify-filter]').forEach(btn => {
        if (btn._bound) return;
        btn._bound = true;
        btn.addEventListener('click', () => {
            notificationFilter = btn.dataset.notifyFilter || 'all';
            notificationPage = 1;
            renderNotificationsList(currentNotifications);
        });
    });

    const invoiceBtn = document.getElementById('notify-go-invoice');
    if (invoiceBtn && !invoiceBtn._bound) {
        invoiceBtn._bound = true;
        invoiceBtn.addEventListener('click', () => {
            activateStudentSection('section-invoice');
            loadMyInvoices();
        });
    }

    const requestBtn = document.getElementById('notify-go-request');
    if (requestBtn && !requestBtn._bound) {
        requestBtn._bound = true;
        requestBtn.addEventListener('click', () => {
            const otherRequestItem = document.querySelector('.submenu-item[data-req-type="Other"]');
            if (otherRequestItem) {
                otherRequestItem.click();
                return;
            }
            activateStudentSection('section-request');
            loadRequestSection('Other');
        });
    }
}

function initFacilityTabs() {
    document.querySelectorAll('.facility-tab-btn[data-facility-panel]').forEach(btn => {
        if (btn._bound) return;
        btn._bound = true;
        btn.addEventListener('click', () => {
            const target = btn.dataset.facilityPanel;
            document.querySelectorAll('.facility-tab-btn').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.facility-tab-panel').forEach(panel => panel.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(target)?.classList.add('active');
        });
    });
}

function getPasswordStrength(password) {
    const checks = [
        password.length >= 8,
        /[a-z]/.test(password) && /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password)
    ];
    return checks.filter(Boolean).length;
}

function updatePasswordStrength(password = '') {
    const row = document.querySelector('.password-strength-row');
    const label = document.getElementById('pw-strength-label');
    if (!row || !label) return;

    row.classList.remove('empty', 'weak', 'medium', 'strong');
    if (!password) {
        row.classList.add('empty');
        label.textContent = '';
        return;
    }

    const score = getPasswordStrength(password);
    if (score >= 4) {
        row.classList.add('strong');
        label.textContent = 'Mạnh';
    } else if (score >= 2) {
        row.classList.add('medium');
        label.textContent = 'Trung bình';
    } else {
        row.classList.add('weak');
        label.textContent = 'Yếu';
    }
}

function initPasswordPanel() {
    document.querySelectorAll('[data-toggle-password]').forEach(btn => {
        if (btn._bound) return;
        btn._bound = true;
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.togglePassword);
            if (!input) return;
            const shouldShow = input.type === 'password';
            input.type = shouldShow ? 'text' : 'password';
            btn.classList.toggle('visible', shouldShow);
            btn.setAttribute('aria-label', shouldShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    });

    const newPasswordInput = document.getElementById('pw-new');
    if (newPasswordInput && !newPasswordInput._strengthBound) {
        newPasswordInput._strengthBound = true;
        newPasswordInput.addEventListener('input', () => updatePasswordStrength(newPasswordInput.value));
    }
    updatePasswordStrength(newPasswordInput?.value || '');
}

// ======================================================================
