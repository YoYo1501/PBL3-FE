// HELPERS
// =====================================================================
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isError ? '#b91c1c' : '#24435f';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3200);
}

function setLoading(id, msg = 'Đang tải...') {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="loading-state">${msg}</div>`;
}

function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="empty-state error-state">⚠️ ${msg}</div>`;
}

function setEmpty(id, msg = 'Không có dữ liệu.') {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="empty-state">${msg}</div>`;
}

function escapeText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// =====================================================================
