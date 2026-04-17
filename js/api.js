// api.js – API layer dùng chung
const API_URL = 'http://localhost:5280/api';

/**
 * Gọi API có Bearer token (dành cho Student/Admin đã đăng nhập).
 * Tự redirect về login.html nếu chưa có token hoặc 401.
 */
async function callApi(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            // Chỉ xóa đúng key, nhất quán với logout() trong auth.js
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('role');
            alert('Phiên đăng nhập hết hạn! Vui lòng đăng nhập lại.');
            window.location.href = 'login.html';
            return null;
        }

        // Trả về { ok, status, data } để caller biết thành công hay thất bại
        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            data = await res.json();
        }
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        console.error('callApi error:', e);
        return null;
    }
}

/**
 * Gọi API không cần token (đăng ký, đăng nhập, xem phòng trống...).
 */
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
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData
        });
        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        console.error('callApiUpload error:', e);
        return null;
    }
}

/** Format ngày thành dd/MM/yyyy */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('vi-VN');
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
        'Expired':   { label: 'Hết hạn',       cls: 'badge-muted'   },
        'Cancelled': { label: 'Đã hủy',          cls: 'badge-muted'   },
        'Paid':      { label: 'Đã thanh toán',    cls: 'badge-success' },
        'Unpaid':    { label: 'Chưa thanh toán',  cls: 'badge-pending' },
        'Draft':     { label: 'Nháp',             cls: 'badge-muted'   },
        'Completed': { label: 'Hoàn thành',       cls: 'badge-success' },
    };
    const m = map[status] || { label: status, cls: 'badge-muted' };
    return `<span class="badge ${m.cls}">${m.label}</span>`;
}