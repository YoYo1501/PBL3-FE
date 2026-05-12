// 1. KHỞI TẠO
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Cập nhật tên trên header
    const fullName = localStorage.getItem('fullName') || sessionStorage.getItem('fullName') || 'Sinh viên';
    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = fullName;
    const avatar = document.getElementById('header-avatar');
    if (avatar) avatar.textContent = fullName.charAt(0).toUpperCase();

    // KIểm tra mustChangePassword (từ BE LoginResponse)
    const mustChangePw = localStorage.getItem('mustChangePassword') || sessionStorage.getItem('mustChangePassword');
    if (mustChangePw === 'true') {
        const modal = document.getElementById('force-change-pw-modal');
        if (modal) modal.classList.add('open');
    }

    initNavigation();
    initSubTabs();
    initRequestMenu();
    initWelcomeMenu();
    initTopActions();
    initNotificationPanel();
    initFacilityTabs();
    initPasswordPanel();
    initLogout();
    initForceChangePassword();
    handlePaymentReturnState();

    // Load section đầu tiên
    await loadProfile();
    await loadNotificationCount();
});

// =====================================================================
