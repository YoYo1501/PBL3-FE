// auth.js

function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getRole() {
    return localStorage.getItem('role') || sessionStorage.getItem('role');
}

function requireRole(role) {
    const token    = getToken();
    const userRole = getRole();

    // Nếu chưa login hoặc sai quyền → đá về login
    if (!token || userRole !== role) {
        window.location.href = 'login.html';
    }
}

function logout() {
    // Chỉ xóa đúng key, không dùng clear() để tránh mất dữ liệu khác
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');

    window.location.href = 'login.html';
}