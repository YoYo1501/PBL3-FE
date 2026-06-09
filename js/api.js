// api.js – API layer dùng chung
const API_URL = 'http://localhost:5280/api';
const DATA_CHANGE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DATA_CHANGE_EVENT = 'app:data-changed';
const DATA_CHANGE_STORAGE_KEY = 'ktx:data-changed';
const DATA_CHANGE_CLIENT_KEY = 'ktx:realtime-client';
const dataChangeChannel = 'BroadcastChannel' in window
    ? new BroadcastChannel(DATA_CHANGE_STORAGE_KEY)
    : null;
let realtimeEventSource = null;

function getRealtimeClientId() {
    let clientId = sessionStorage.getItem(DATA_CHANGE_CLIENT_KEY);
    if (!clientId) {
        clientId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(DATA_CHANGE_CLIENT_KEY, clientId);
    }
    return clientId;
}

function getRequestMethod(options = {}) {
    return String(options.method || 'GET').toUpperCase();
}

function notifyDataChanged(detail = {}) {
    const payload = {
        endpoint: detail.endpoint || '',
        method: detail.method || '',
        clientId: detail.clientId || getRealtimeClientId(),
        at: Date.now()
    };

    if (!detail.skipCurrentTab) {
        window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: payload }));
    }
    dataChangeChannel?.postMessage(payload);

    try {
        localStorage.setItem(DATA_CHANGE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
        // Ignore storage errors; same-tab and BroadcastChannel still work.
    }
}

function onDataChanged(handler) {
    window.addEventListener(DATA_CHANGE_EVENT, event => handler(event.detail || {}));
    dataChangeChannel?.addEventListener('message', event => handler(event.data || {}));
    window.addEventListener('storage', event => {
        if (event.key !== DATA_CHANGE_STORAGE_KEY || !event.newValue) return;
        try {
            handler(JSON.parse(event.newValue));
        } catch (_) {
            handler({});
        }
    });
}

function connectRealtimeUpdates() {
    if (realtimeEventSource || !('EventSource' in window)) return;
    const token = getToken();
    if (!token) return;

    realtimeEventSource = new EventSource(`${API_URL}/realtime/events?access_token=${encodeURIComponent(token)}`);
    realtimeEventSource.addEventListener('data-changed', event => {
        try {
            const payload = JSON.parse(event.data || '{}');
            if (payload.clientId && payload.clientId === getRealtimeClientId()) return;
            notifyDataChanged(payload);
        } catch (_) {
            notifyDataChanged({ method: 'REMOTE', endpoint: 'realtime' });
        }
    });
    realtimeEventSource.onerror = () => {
        realtimeEventSource?.close();
        realtimeEventSource = null;
        window.setTimeout(connectRealtimeUpdates, 3000);
    };
}

/**
 * Gọi API có Bearer token (dành cho Student/Admin đã đăng nhập).
 * Tự redirect về login.html nếu chưa có token hoặc 401.
 */
async function callApi(endpoint, options = {}) {
    // API LAYER: moi request can dang nhap se di qua day de lay token hien tai.
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        // API LAYER: gui request len BE, gan Bearer token de Controller [Authorize] doc duoc user/role.
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Realtime-Client': getRealtimeClientId(),
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            // Chỉ xóa đúng key, nhất quán với logout() trong auth.js
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('fullName');
            localStorage.removeItem('mustChangePassword');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('role');
            sessionStorage.removeItem('fullName');
            sessionStorage.removeItem('mustChangePassword');
            alert('Phiên đăng nhập hết hạn! Vui lòng đăng nhập lại.');
            window.location.href = 'login.html';
            return null;
        }

        if (res.status === 423) {
            const data = await res.json().catch(() => null);
            showOverdueInvoiceLock(data?.message);
            return { ok: false, status: res.status, data };
        }

        // Trả về { ok, status, data } để caller biết thành công hay thất bại
        // API LAYER: Controller tra JSON thi parse thanh data de JS phia tren xu ly tiep.
        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            data = await res.json();
        }
        const result = { ok: res.ok, status: res.status, data };
        if (result.ok && DATA_CHANGE_METHODS.has(getRequestMethod(options))) {
            notifyDataChanged({ endpoint, method: getRequestMethod(options), skipCurrentTab: true });
        }
        return result;
    } catch (e) {
        console.error('callApi error:', e);
        return null;
    }
}

/**
 * Gọi API không cần token (đăng ký, đăng nhập, xem phòng trống...).
 */
function showOverdueInvoiceLock(message) {
    const text = message || 'Tài khoản đang bị tạm khóa do có hóa đơn quá hạn. Vui lòng thanh toán hóa đơn để tiếp tục sử dụng các chức năng.';
    if (!window.__overdueInvoiceLockShown) {
        window.__overdueInvoiceLockShown = true;
        showOverdueInvoiceModal(text);
    }

    if (typeof activateStudentSection === 'function' && typeof loadMyInvoices === 'function') {
        activateStudentSection('section-invoice');
        loadMyInvoices();
    }
}

function showOverdueInvoiceModal(message) {
    let modal = document.getElementById('overdue-invoice-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'overdue-invoice-modal';
        modal.className = 'overdue-lock-backdrop';
        modal.innerHTML = `
            <div class="overdue-lock-card" role="dialog" aria-modal="true" aria-labelledby="overdue-lock-title">
                <button type="button" class="overdue-lock-close" data-overdue-close aria-label="Đóng">×</button>
                <div class="overdue-lock-icon"></div>
                <div class="overdue-lock-content">
                    <span class="overdue-lock-eyebrow">Tạm khóa chức năng</span>
                    <h3 id="overdue-lock-title">Hóa đơn đã quá hạn</h3>
                    <p data-overdue-message></p>
                </div>
                <div class="overdue-lock-actions">
                    <button type="button" class="overdue-lock-secondary" data-overdue-close>Để sau</button>
                    <button type="button" class="overdue-lock-primary" data-overdue-go-invoice>Thanh toán ngay</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', event => {
            if (event.target === modal || event.target.closest('[data-overdue-close]')) {
                modal.classList.remove('open');
                document.body.classList.remove('modal-open');
            }
            if (event.target.closest('[data-overdue-go-invoice]')) {
                modal.classList.remove('open');
                document.body.classList.remove('modal-open');
                if (typeof activateStudentSection === 'function' && typeof loadMyInvoices === 'function') {
                    activateStudentSection('section-invoice');
                    loadMyInvoices();
                }
            }
        });
    }

    const messageEl = modal.querySelector('[data-overdue-message]');
    if (messageEl) messageEl.textContent = message;
    modal.classList.add('open');
    document.body.classList.add('modal-open');
}

async function callApiPublic(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            data = await res.json();
        }
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        console.error('callApiPublic error:', e);
        return null;
    }
}

/**
 * Upload file (multipart/form-data) không cần token.
 */
async function callApiUpload(endpoint, formData) {
    const token = getToken();
    try {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        headers['X-Realtime-Client'] = getRealtimeClientId();
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData
        });
        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) data = await res.json();
        const result = { ok: res.ok, status: res.status, data };
        if (result.ok) {
            notifyDataChanged({ endpoint, method: 'POST', skipCurrentTab: true });
        }
        return result;
    } catch (e) {
        console.error('callApiUpload error:', e);
        return null;
    }
}

/**
 * Goi API tra ve file/blob co Bearer token.
 */
async function callApiBlob(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('fullName');
            localStorage.removeItem('mustChangePassword');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('role');
            sessionStorage.removeItem('fullName');
            sessionStorage.removeItem('mustChangePassword');
            alert('Phiên đăng nhập hết hạn! Vui lòng đăng nhập lại.');
            window.location.href = 'login.html';
            return null;
        }

        const blob = await res.blob();
        return {
            ok: res.ok,
            status: res.status,
            blob,
            fileName: res.headers.get('content-disposition') || ''
        };
    } catch (e) {
        console.error('callApiBlob error:', e);
        return null;
    }
}

/** Format ngày thành dd/MM/yyyy */
function formatDate(dateStr) {
    const d = parseDateValue(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('vi-VN');
}

function parseDateValue(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;

    const raw = String(value).trim();
    const vnMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (vnMatch) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = vnMatch;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
        );
    }

    return new Date(raw);
}

/** Format tiền VND */
function formatCurrency(amount) {
    if (amount == null) return '—';
    return Number(amount).toLocaleString('vi-VN') + ' ₫';
}

/** Hiển thị badge status */
function statusBadge(status) {
    const map = {
        'Pending':   { label: 'Chờ duyệt',   cls: 'badge-pending' },
        'Approved':  { label: 'Đã duyệt',     cls: 'badge-success' },
        'Rejected':  { label: 'Từ chối',       cls: 'badge-danger'  },
        'Active':    { label: 'Đang hiệu lực', cls: 'badge-success' },
        'Inactive':  { label: 'Vô hiệu',       cls: 'badge-muted'   },
        'Expired':   { label: 'Hết hạn',       cls: 'badge-muted'   },
        'Cancelled': { label: 'Đã hủy',          cls: 'badge-muted'   },
        'Terminated': { label: 'Đã chấm dứt',    cls: 'badge-danger'  },
        'Paid':      { label: 'Đã thanh toán',    cls: 'badge-success' },
        'Unpaid':    { label: 'Chưa thanh toán',  cls: 'badge-pending' },
        'Draft':     { label: 'Nháp',             cls: 'badge-muted'   },
        'Completed': { label: 'Đã duyệt',         cls: 'badge-success' },
        'Good':      { label: 'Tốt',              cls: 'badge-success' },
        'Damaged':   { label: 'Hư hỏng',          cls: 'badge-danger'  },
        'UnderMaintenance': { label: 'Đang bảo trì', cls: 'badge-muted' },
    };
    const m = map[status] || { label: status, cls: 'badge-muted' };
    return `<span class="badge ${m.cls}">${m.label}</span>`;
}
