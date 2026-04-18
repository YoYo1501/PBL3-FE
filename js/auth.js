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

function showAppConfirm(options = {}) {
    const settings = {
        title: options.title || 'Xác nhận',
        message: options.message || 'Bạn có chắc muốn tiếp tục?',
        confirmText: options.confirmText || 'Xác nhận',
        cancelText: options.cancelText || 'Hủy'
    };

    let modal = document.getElementById('app-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'app-confirm-modal';
        modal.className = 'app-confirm-backdrop';
        modal.innerHTML = `
            <div class="app-confirm-card" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title">
                <div class="app-confirm-icon" aria-hidden="true"></div>
                <h3 id="app-confirm-title" class="app-confirm-title"></h3>
                <p class="app-confirm-message"></p>
                <div class="app-confirm-actions">
                    <button type="button" class="app-confirm-btn app-confirm-cancel"></button>
                    <button type="button" class="app-confirm-btn app-confirm-ok"></button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('.app-confirm-title');
    const messageEl = modal.querySelector('.app-confirm-message');
    const cancelBtn = modal.querySelector('.app-confirm-cancel');
    const okBtn = modal.querySelector('.app-confirm-ok');

    titleEl.textContent = settings.title;
    messageEl.textContent = settings.message;
    cancelBtn.textContent = settings.cancelText;
    okBtn.textContent = settings.confirmText;

    return new Promise(resolve => {
        const close = (result) => {
            modal.classList.remove('open');
            modal.removeEventListener('click', handleBackdropClick);
            document.removeEventListener('keydown', handleKeydown);
            cancelBtn.removeEventListener('click', handleCancel);
            okBtn.removeEventListener('click', handleConfirm);
            resolve(result);
        };

        const handleCancel = () => close(false);
        const handleConfirm = () => close(true);
        const handleBackdropClick = (event) => {
            if (event.target === modal) close(false);
        };
        const handleKeydown = (event) => {
            if (event.key === 'Escape') close(false);
        };

        cancelBtn.addEventListener('click', handleCancel);
        okBtn.addEventListener('click', handleConfirm);
        modal.addEventListener('click', handleBackdropClick);
        document.addEventListener('keydown', handleKeydown);

        modal.classList.add('open');
        okBtn.focus();
    });
}
