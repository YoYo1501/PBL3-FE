/**
 * student.js – Logic chính cho trang sinh viên
 * Kết nối với BE qua api.js (callApi / callApiPublic)
 */

// =====================================================================
// GLOBAL STATE
// =====================================================================
let currentReqType = 'Other'; // loại yêu cầu đang hiển thị
let transferRooms  = [];       // danh sách phòng có thể chuyển

// =====================================================================
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

// =====================================================================
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
    initLogout();
    initForceChangePassword();
    handlePaymentReturnState();

    // Load section đầu tiên
    await loadProfile();
    await loadNotificationCount();
});

// =====================================================================
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
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('paymentStatus');
    if (!paymentStatus) return;

    activateStudentSection('section-invoice');
    loadMyInvoices();

    if (paymentStatus === 'success') {
        showToast('Thanh toán thành công! Hóa đơn đã được cập nhật.');
    } else {
        showToast('Thanh toán chưa hoàn tất hoặc đã bị hủy.', true);
    }

    params.delete('paymentStatus');
    params.delete('paymentInvoiceId');
    params.delete('paymentTxnId');
    params.delete('paymentCode');

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
}

function onSectionActivated(sectionId, extra) {
    switch (sectionId) {
        case 'section-info':     loadProfile();             break;
        case 'section-room':     loadMyRoom(); loadMyContract(); break;
        case 'section-contract': loadMyContract();          break;
        case 'section-invoice':  loadMyInvoices();          break;
        case 'section-request':  loadRequestSection(extra); break;
        case 'section-notify':   loadNotifications();       break;
    }
}

// =====================================================================
// 3. SUB-TABS (Trong section Thông tin sinh viên)
// =====================================================================
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

// ======================================================================
// 6. FORCE CHANGE PASSWORD
// BE field names: oldPassword, newPassword, confirmPassword
// Validation: ít nhất 1 chữ hoa, 1 chữ thường, 1 số
// ======================================================================
function initForceChangePassword() {
    const btn = document.getElementById('fcp-submit-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const oldPw     = document.getElementById('fcp-old').value;
        const newPw     = document.getElementById('fcp-new').value;
        const confirmPw = document.getElementById('fcp-confirm').value;
        const errEl     = document.getElementById('fcp-error');

        errEl.textContent = '';
        if (!oldPw)                { errEl.textContent = 'Nhập mật khẩu cũ.'; return; }
        if (!newPw)                { errEl.textContent = 'Nhập mật khẩu mới.'; return; }
        if (newPw.length < 8)     { errEl.textContent = 'Mật khẩu mới phải ít nhất 8 ký tự.'; return; }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPw)) {
            errEl.textContent = 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số.'; return;
        }
        if (newPw !== confirmPw)   { errEl.textContent = 'Mật khẩu xác nhận không khớp.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({
                oldPassword:     oldPw,
                newPassword:     newPw,
                confirmPassword: confirmPw
            })
        });
        btn.disabled = false;

        if (res?.ok) {
            localStorage.setItem('mustChangePassword', 'false');
            sessionStorage.setItem('mustChangePassword', 'false');
            document.getElementById('force-change-pw-modal').classList.remove('open');
            showToast('🎉 Đổi mật khẩu thành công! Chào mừng bạn.');
        } else {
            errEl.textContent = res?.data?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.';
        }
    });
}

// ======================================================================
// 7. PROFILE – GET /api/profile & PUT /api/profile & PUT /api/profile/change-password
// ======================================================================
async function loadProfile() {
    const res = await callApi('/profile');
    if (!res?.ok || !res.data?.data) {
        // Hiển thị thông tin từ localStorage nếu API lỗi
        document.getElementById('sv-fullname').textContent = localStorage.getItem('fullName') || '—';
        return;
    }

    const p = res.data.data; // UserProfileResponse

    // Thông tin chung
    document.getElementById('sv-fullname').textContent   = p.fullName         || '—';
    document.getElementById('sv-citizenid').textContent  = p.citizenId        || '—';
    document.getElementById('sv-gender').textContent     = p.gender           || '—';
    document.getElementById('sv-email').textContent      = p.email            || '—';

    // Thông tin liên hệ (form)
    const phoneEl   = document.getElementById('edit-phone');
    const addrEl    = document.getElementById('edit-address');
    const relNEl    = document.getElementById('edit-relative-name');
    const relPhEl   = document.getElementById('edit-relative-phone');
    const relRelEl  = document.getElementById('edit-relationship');

    if (phoneEl)  phoneEl.value  = p.phone            || '';
    if (addrEl)   addrEl.value   = p.permanentAddress || '';
    if (relNEl)   relNEl.value   = p.relativeName     || '';
    if (relPhEl)  relPhEl.value  = p.relativePhone    || '';
    if (relRelEl) relRelEl.value = p.relationship     || '';

    // Cập nhật header name
    localStorage.setItem('fullName', p.fullName || '');
    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = p.fullName || '—';
    const avatar = document.getElementById('header-avatar');
    if (avatar) avatar.textContent = (p.fullName || 'S').charAt(0).toUpperCase();

    // Bind nút lưu thông tin liên hệ (chỉ bind 1 lần)
    bindSaveContact();
    // Bind đổi mật khẩu
    bindChangePassword();
}

function bindSaveContact() {
    const btn = document.getElementById('save-contact-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl = document.getElementById('contact-error');
        errEl.textContent = '';
        const dto = {
            phone:            document.getElementById('edit-phone').value.trim(),
            permanentAddress: document.getElementById('edit-address').value.trim(),
            relativeName:     document.getElementById('edit-relative-name').value.trim(),
            relativePhone:    document.getElementById('edit-relative-phone').value.trim(),
            relationship:     document.getElementById('edit-relationship').value.trim(),
        };
        if (!dto.phone) { errEl.textContent = 'Số điện thoại không được để trống.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile', { method: 'PUT', body: JSON.stringify(dto) });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Cập nhật thông tin thành công!');
        } else {
            let msg = 'Cập nhật thất bại.';
            if (res?.data?.message) {
                msg = res.data.message;
            } else if (res?.data?.errors) {
                msg = Object.values(res.data.errors).flat().join(' ');
            }
            errEl.textContent = msg;
        }
    });
}

function bindChangePassword() {
    const btn = document.getElementById('change-pw-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl    = document.getElementById('pw-error');
        errEl.textContent = '';
        const current  = document.getElementById('pw-current').value;
        const newPw    = document.getElementById('pw-new').value;
        const confirm  = document.getElementById('pw-confirm').value;
        if (!current || !newPw || !confirm) { errEl.textContent = 'Vui lòng điền đầy đủ.'; return; }
        if (newPw !== confirm)              { errEl.textContent = 'Mật khẩu mới không khớp.'; return; }
        if (newPw.length < 8)              { errEl.textContent = 'Mật khẩu mới phải có ít nhất 8 ký tự.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({ oldPassword: current, newPassword: newPw, confirmPassword: confirm })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Đổi mật khẩu thành công!');
            document.getElementById('pw-current').value = '';
            document.getElementById('pw-new').value     = '';
            document.getElementById('pw-confirm').value = '';
        } else {
            let msg = 'Đổi mật khẩu thất bại.';
            if (res?.data?.message) {
                msg = res.data.message;
            } else if (res?.data?.errors) {
                msg = Object.values(res.data.errors).flat().join(' ');
            }
            errEl.textContent = msg;
        }
    });
}

// ======================================================================
// 8. PHÒNG Ở – GET /api/room/my-room
// ======================================================================
async function loadMyRoom() {
    setLoading('room-content');
    const res = await callApi('/room/my-room');
    const el = document.getElementById('room-content');
    if (!res || !res.ok || !res.data) {
        el.innerHTML = `<div class="empty-state">🏠 Bạn hiện không có phòng đang hoạt động.<br><small>Điều này có nghĩa chưa có hợp đồng Active.</small></div>`;
        return;
    }

    const r = res.data; // RoomDto
    el.innerHTML = `
        <div class="card room-detail-card">
            <div class="room-detail-grid">
                <div class="room-chip">
                    <span class="chip-label">Mã phòng</span>
                    <strong class="chip-value">${r.roomCode || '—'}</strong>
                </div>
                <div class="room-chip">
                    <span class="chip-label">Loại phòng</span>
                    <strong class="chip-value">${r.roomType || '—'}</strong>
                </div>
                <div class="room-chip">
                    <span class="chip-label">Tòa nhà</span>
                    <strong class="chip-value">${r.buildingName || '—'} (${r.buildingCode || '—'})</strong>
                </div>
                <div class="room-chip">
                    <span class="chip-label">Sức chứa</span>
                    <strong class="chip-value">${r.currentOccupancy}/${r.capacity} người</strong>
                </div>
                <div class="room-chip">
                    <span class="chip-label">Giới tính</span>
                    <strong class="chip-value">${r.genderAllowed || '—'}</strong>
                </div>
                <div class="room-chip">
                    <span class="chip-label">Trạng thái</span>
                    <strong class="chip-value">${statusBadge(r.status)}</strong>
                </div>
            </div>
        </div>`;
}

// ======================================================================
// 9. HỢP ĐỒNG – GET /api/contracts/my
// ======================================================================
async function loadMyContract() {
    setLoading('contract-content');
    const res = await callApi('/contracts/my');
    const el = document.getElementById('contract-content');
    const renewSec = document.getElementById('renewal-section');

    if (!res?.ok || !res.data?.data) {
        el.innerHTML = `<div class="empty-state">📄 Không tìm thấy hợp đồng lưu trú đang hoạt động.</div>`;
        if (renewSec) renewSec.style.display = 'none';
        return;
    }

    const c = res.data.data; // ContractResponseDto

    el.innerHTML = `
        <div class="card">
            <h3>📄 ${c.contractCode}</h3>
            <table class="table-details">
                <tr><th>Phòng:</th><td>${c.roomCode || '—'}</td></tr>
                <tr><th>Loại phòng:</th><td>${c.roomType || '—'}</td></tr>
                <tr><th>Ngày bắt đầu:</th><td>${formatDate(c.startDate)}</td></tr>
                <tr><th>Ngày kết thúc:</th><td>${formatDate(c.endDate)}</td></tr>
                <tr><th>Giá thuê:</th><td>${formatCurrency(c.price)} / tháng</td></tr>
                <tr><th>Trạng thái:</th><td>${statusBadge(c.status)}</td></tr>
                <tr><th>Còn lại:</th><td><strong>${c.daysRemaining} ngày</strong></td></tr>
            </table>
            ${c.canRenew ? `<div class="info-save-actions"><button type="button" class="btn-primary" id="show-renewal-btn">🔄 Gia hạn hợp đồng</button></div>` : ''}
        </div>`;

    if (c.canRenew) {
        document.getElementById('show-renewal-btn')?.addEventListener('click', () => {
            if (renewSec) renewSec.style.display = 'block';
            loadRenewalPackages();
        });
    }

    if (renewSec) renewSec.style.display = 'none';
}

async function loadRenewalPackages() {
    const listEl = document.getElementById('renewal-packages-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-state">Đang tải gói gia hạn...</div>';

    const res = await callApi('/contracts/renewal-packages');
    if (!res?.ok || !res.data?.packages?.length) {
        listEl.innerHTML = '<div class="empty-state">Không có gói gia hạn khả dụng.</div>';
        return;
    }

    listEl.innerHTML = res.data.packages.map(pkg => `
        <div class="card renewal-card">
            <h4>${pkg.name}</h4>
            <p>${pkg.durationMonths} tháng</p>
            <p>Đến: <strong>${formatDate(pkg.newEndDate)}</strong></p>
            <p>Ước tính: <strong>${formatCurrency(pkg.estimatedPrice)}</strong></p>
            <button type="button" class="btn-primary btn-sm" data-pkg-id="${pkg.id}">Chọn gói này</button>
        </div>`).join('');

    listEl.querySelectorAll('[data-pkg-id]').forEach(btn => {
        btn.addEventListener('click', () => submitRenewal(Number(btn.dataset.pkgId)));
    });
}

async function submitRenewal(renewalPackageId) {
    if (!confirm('Xác nhận gửi yêu cầu gia hạn hợp đồng?')) return;
    const errEl = document.getElementById('renewal-error');
    if (errEl) errEl.textContent = '';

    const res = await callApi('/contracts/renew', {
        method: 'POST',
        body: JSON.stringify({ renewalPackageId })
    });

    if (res?.ok) {
        showToast('Gửi yêu cầu gia hạn thành công! Chờ Admin duyệt.');
        document.getElementById('renewal-section').style.display = 'none';
    } else {
        if (errEl) errEl.textContent = res?.data?.message || 'Gửi yêu cầu thất bại.';
    }
}

// ======================================================================
// 10. HÓA ĐƠN – GET /api/invoices/my
// ======================================================================
async function loadMyInvoices() {
    setLoading('invoice-content');
    const res = await callApi('/invoices/my');
    const el = document.getElementById('invoice-content');

    if (!res?.ok || !Array.isArray(res.data) || res.data.length === 0) {
        el.innerHTML = `<div class="empty-state">💳 Chưa có hóa đơn nào.</div>`;
        return;
    }

    const rows = res.data.map(inv => `
        <tr>
            <td>${inv.period || '—'}</td>
            <td>${inv.roomCode || '—'}</td>
            <td>${formatCurrency(inv.roomFee)}</td>
            <td>${formatCurrency(inv.electricFee)}</td>
            <td>${formatCurrency(inv.waterFee)}</td>
            <td><strong>${formatCurrency(inv.totalAmount)}</strong></td>
            <td>${statusBadge(inv.status)}</td>
            <td>${formatDate(inv.issuedAt)}</td>
            <td>
                ${inv.status === 'Unpaid'
                    ? `<button type="button" class="btn-pay btn-sm" data-inv-id="${inv.id}">💳 Thanh toán</button>`
                    : `<span class="text-muted">—</span>`}
            </td>
        </tr>`).join('');

    el.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Kỳ</th>
                        <th>Phòng</th>
                        <th>Tiền phòng</th>
                        <th>Tiền điện</th>
                        <th>Tiền nước</th>
                        <th>Tổng cộng</th>
                        <th>Trạng thái</th>
                        <th>Ngày phát hành</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    el.querySelectorAll('.btn-pay').forEach(btn => {
        btn.addEventListener('click', () => payInvoice(Number(btn.dataset.invId)));
    });
}

async function payInvoice(invoiceId) {
    if (!confirm('Bạn muốn thanh toán hóa đơn này qua VNPAY?')) return;
    const returnPage = window.location.href.split('#')[0];
    const res = await callApi(`/payments/create-payment-url/${invoiceId}?returnPage=${encodeURIComponent(returnPage)}`, { method: 'POST' });
    if (res?.ok && res.data?.url) {
        window.location.href = res.data.url;
    } else {
        showToast(res?.data?.message || 'Không thể tạo link thanh toán.', true);
    }
}

// ======================================================================
// 11. YÊU CẦU – POST /api/studentrequests & GET /api/studentrequests/my
// ======================================================================
const reqTitleMap = {
    'Checkout':     { title: 'Yêu cầu trả phòng',   desc: 'Gửi yêu cầu trả phòng khi muốn chấm dứt hợp đồng sớm.' },
    'Maintenance':  { title: 'Yêu cầu sửa chữa',   desc: 'Báo cáo sự cố, yêu cầu sửa chữa trang thiết bị trong phòng.' },
    'RoomTransfer': { title: 'Yêu cầu chuyển phòng', desc: 'Chọn phòng muốn chuyển đến và gửi yêu cầu. Admin sẽ xét duyệt.' },
    'Other':        { title: 'Yêu cầu khác',         desc: 'Gửi các yêu cầu khác tới ban quản lý ký túc xá.' },
};

function loadRequestSection(reqType) {
    currentReqType = reqType || 'Other';
    const info = reqTitleMap[currentReqType] || reqTitleMap['Other'];

    const titleEl       = document.getElementById('request-section-title');
    const descEl        = document.getElementById('request-section-desc');
    const formCard      = document.getElementById('request-form-card');
    const transferTmpl  = document.getElementById('transfer-form-template');
    const sectionEl     = document.getElementById('section-request');

    if (titleEl) titleEl.textContent = info.title;
    if (descEl)  descEl.textContent  = info.desc;

    if (currentReqType === 'RoomTransfer') {
        // Ẩn form yêu cầu thông thường
        if (formCard) formCard.style.display = 'none';

        // Nhúng form chuyển phòng vào section (nếu chưa có)
        if (!document.getElementById('transfer-form-injected')) {
            const clone = transferTmpl?.cloneNode(true);
            if (clone) {
                clone.id = 'transfer-form-injected';
                clone.style.display = 'block';
                sectionEl.appendChild(clone);
            }
        } else {
            document.getElementById('transfer-form-injected').style.display = 'block';
        }

        // Ẩn danh sách yêu cầu thông thường, hiện lịch sử chuyển phòng
        document.getElementById('my-requests-list')?.closest('.card')?.style.setProperty('display', 'none');
        loadTransferHistory();
        loadTransferRooms();
    } else {
        // Hiện form yêu cầu thông thường
        if (formCard) formCard.style.display = '';
        // Ẩn form chuyển phòng nếu đang hiện
        const injected = document.getElementById('transfer-form-injected');
        if (injected) injected.style.display = 'none';
        // Hiện lại danh sách yêu cầu
        const listCard = document.getElementById('my-requests-list')?.closest('.card');
        if (listCard) listCard.style.removeProperty('display');

        // Bind nút submit (chỉ 1 lần)
        bindRequestSubmit();
        // Load danh sách yêu cầu
        loadMyRequests();
    }
}

function bindRequestSubmit() {
    const btn = document.getElementById('req-submit-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl = document.getElementById('req-error');
        errEl.textContent = '';
        const title = document.getElementById('req-title').value.trim();
        const desc  = document.getElementById('req-desc').value.trim();

        if (!title) { errEl.textContent = 'Vui lòng nhập tiêu đề yêu cầu.'; return; }
        if (!desc)  { errEl.textContent = 'Vui lòng nhập nội dung yêu cầu.'; return; }

        btn.disabled = true;
        const res = await callApi('/studentrequests', {
            method: 'POST',
            body: JSON.stringify({ requestType: currentReqType, title, description: desc })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Gửi yêu cầu thành công!');
            document.getElementById('req-title').value = '';
            document.getElementById('req-desc').value  = '';
            loadMyRequests();
        } else {
            errEl.textContent = res?.data?.message || 'Gửi yêu cầu thất bại.';
        }
    });
}

async function loadMyRequests() {
    const listEl = document.getElementById('my-requests-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-state">Đang tải...</div>';

    const res = await callApi('/studentrequests/my');
    if (!res?.ok || !Array.isArray(res.data) || res.data.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Chưa có yêu cầu nào.</div>';
        return;
    }

    // Lọc theo loại đang xem
    const filtered = res.data.filter(r => r.requestType === currentReqType);
    if (!filtered.length) {
        listEl.innerHTML = `<div class="empty-state">Chưa có yêu cầu "${reqTitleMap[currentReqType]?.title}" nào.</div>`;
        return;
    }

    listEl.innerHTML = filtered.map(r => `
        <div class="request-item card">
            <div class="request-item-head">
                <strong>${r.title}</strong>
                ${statusBadge(r.status)}
            </div>
            <p class="request-item-desc">${r.description}</p>
            <div class="request-item-meta">
                <span>${formatDate(r.createdAt)}</span>
                ${r.resolutionNote ? `<span class="resolution-note">💬 ${r.resolutionNote}</span>` : ''}
                ${r.status === 'Pending'
                    ? `<button type="button" class="btn-danger btn-sm" data-req-id="${r.id}">❌ Hủy</button>`
                    : ''}
            </div>
        </div>`).join('');

    listEl.querySelectorAll('[data-req-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Xác nhận hủy yêu cầu này?')) return;
            const res2 = await callApi(`/studentrequests/${btn.dataset.reqId}/cancel`, { method: 'PUT' });
            if (res2?.ok) { showToast('Đã hủy yêu cầu.'); loadMyRequests(); }
            else showToast(res2?.data?.message || 'Không thể hủy.', true);
        });
    });
}

// ======================================================================
// 12. CHUYỂN PHÒNG – GET /api/roomtransfers/available & POST
// ======================================================================
async function loadTransferRooms() {
    const listEl = document.getElementById('transfer-room-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-state">Đang tải danh sách phòng khả dụng...</div>';

    const res = await callApi('/roomtransfers/available');
    if (!res?.ok || !res.data?.rooms?.length) {
        listEl.innerHTML = `<div class="empty-state">Không có phòng nào khả dụng để chuyển.</div>`;
        return;
    }

    transferRooms = res.data.rooms;
    renderTransferRooms(transferRooms);

    // Search
    document.getElementById('transfer-search')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = transferRooms.filter(r =>
            (r.roomCode || '').toLowerCase().includes(q) ||
            (r.buildingName || '').toLowerCase().includes(q) ||
            (r.buildingCode || '').toLowerCase().includes(q)
        );
        renderTransferRooms(filtered);
    });

    // Submit
    bindTransferSubmit();
}

function renderTransferRooms(rooms) {
    const listEl = document.getElementById('transfer-room-list');
    if (!listEl) return;

    if (!rooms.length) {
        listEl.innerHTML = '<div class="empty-state">Không tìm thấy phòng phù hợp.</div>';
        return;
    }

    listEl.innerHTML = rooms.map(r => `
        <div class="room-item" data-room-id="${r.id}" data-room-code="${r.roomCode}">
            <div class="room-item-head">
                <strong>${r.roomCode}</strong>
                <span class="room-badge">${r.availableSlots} chỗ trống</span>
            </div>
            <div class="room-item-meta">
                <span>${r.buildingName} (${r.buildingCode})</span>
                <span>${r.roomType}</span>
                <span>${r.genderAllowed}</span>
                <span>${r.currentOccupancy}/${r.capacity} người</span>
            </div>
        </div>`).join('');

    let selectedId   = null;
    let selectedCode = null;

    listEl.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => {
            listEl.querySelectorAll('.room-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedId   = item.dataset.roomId;
            selectedCode = item.dataset.roomCode;

            const selInfo = document.getElementById('transfer-selected-info');
            const selDisp = document.getElementById('transfer-selected-display');
            const selId   = document.getElementById('transfer-selected-id');
            if (selInfo) selInfo.style.display = 'block';
            if (selDisp) selDisp.value = selectedCode;
            if (selId)   selId.value   = selectedId;
        });
    });
}

function bindTransferSubmit() {
    const btn = document.getElementById('transfer-submit-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;

    btn.addEventListener('click', async () => {
        const errEl    = document.getElementById('transfer-error');
        errEl.textContent = '';
        const toRoomId = Number(document.getElementById('transfer-selected-id')?.value);
        const reason   = document.getElementById('transfer-reason')?.value.trim();

        if (!toRoomId)  { errEl.textContent = 'Vui lòng chọn phòng muốn chuyển đến.'; return; }
        if (!reason)    { errEl.textContent = 'Vui lòng nhập lý do chuyển phòng.'; return; }
        if (reason.length < 15) { errEl.textContent = 'Ly do can it nhat 15 ky tu.'; return; }

        btn.disabled = true;
        // Buoc 1: Hold truoc 10 phut de tranh race condition
        const holdRes = await callApi('/roomtransfers/hold', {
            method: 'POST',
            body: JSON.stringify({ toRoomId })
        });
        if (!holdRes?.ok) {
            errEl.textContent = holdRes?.data?.message || 'Giu cho phong that bai, vui long thu lai.';
            btn.disabled = false;
            return;
        }

        // Buoc 2: Gui yeu cau chinh thuc
        const res = await callApi('/roomtransfers', {
            method: 'POST',
            body: JSON.stringify({ toRoomId, reason })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Gửi yêu cầu chuyển phòng thành công! Chờ Admin duyệt.');
            document.getElementById('transfer-reason').value = '';
            document.getElementById('transfer-selected-info').style.display = 'none';
            document.getElementById('transfer-selected-id').value = '';
            document.getElementById('transfer-selected-display').value = '';
            document.querySelectorAll('.room-item').forEach(i => i.classList.remove('selected'));
            loadTransferHistory();
        } else {
            errEl.textContent = res?.data?.message || 'Gửi yêu cầu thất bại.';
        }
    });
}

// ======================================================================
// 12b. LỊCH SỬ YÊu CẦU CHUYỂN PHÒNG
// ======================================================================
async function loadTransferHistory() {
    // Tìm container trong form được nhúng vào
    let histEl = document.getElementById('transfer-history-list');
    if (!histEl) {
        // Tạo card lịch sử nếu chưa có
        const injected = document.getElementById('transfer-form-injected');
        if (!injected) return;
        const histCard = document.createElement('div');
        histCard.className = 'card';
        histCard.style.marginTop = '16px';
        histCard.innerHTML = `<h3>Lịch sử yêu cầu chuyển phòng</h3><div id="transfer-history-list"><div class="loading-state">Đang tải...</div></div>`;
        injected.appendChild(histCard);
        histEl = document.getElementById('transfer-history-list');
    }
    if (!histEl) return;
    histEl.innerHTML = '<div class="loading-state">Đang tải...</div>';

    const res = await callApi('/roomtransfers/my');
    if (!res?.ok || !Array.isArray(res.data) || !res.data.length) {
        histEl.innerHTML = '<div class="empty-state">Chưa có yêu cầu chuyển phòng nào.</div>';
        return;
    }

    histEl.innerHTML = res.data.map(t => `
        <div class="request-item card">
            <div class="request-item-head">
                <strong>⇒ ${t.toRoomCode || t.toRoomId}</strong>
                ${statusBadge(t.status)}
            </div>
            <p class="request-item-desc">${t.reason || '—'}</p>
            <div class="request-item-meta">
                <span>Ngày gửi: ${formatDate(t.requestedAt || t.createdAt)}</span>
                ${t.resolvedAt ? `<span>Ngày duyệt: ${formatDate(t.resolvedAt)}</span>` : ''}
                ${t.rejectionReason ? `<span class="resolution-note">💬 ${t.rejectionReason}</span>` : ''}
            </div>
        </div>`).join('');
}

// ======================================================================
// 13. THÔNG BÁO – GET /api/notifications/my & PUT /api/notifications/{id}/read
// ======================================================================
async function loadNotificationCount() {
    const res = await callApi('/notifications/my');
    if (!res?.ok || !Array.isArray(res.data)) return;
    const unread = res.data.filter(n => !n.isRead).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function loadNotifications() {
    const el = document.getElementById('notify-content');
    if (!el) return;
    el.innerHTML = '<div class="loading-state">Đang tải thông báo...</div>';

    const res = await callApi('/notifications/my');
    if (!res?.ok || !Array.isArray(res.data) || !res.data.length) {
        el.innerHTML = '<div class="empty-state">🔔 Chưa có thông báo nào.</div>';
        return;
    }

    el.innerHTML = `<div class="notification-list">
        ${res.data.map(n => `
            <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-notif-id="${n.id}">
                <div class="notif-head">
                    <strong>${n.title}</strong>
                    ${!n.isRead ? '<span class="unread-dot"></span>' : ''}
                    <span class="notif-date">${formatDate(n.createdAt)}</span>
                </div>
                <p class="notif-body">${n.message}</p>
            </div>`).join('')}
    </div>`;

    // Đánh dấu đã đọc khi click
    el.querySelectorAll('.notification-item.unread').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.notifId;
            await callApi(`/notifications/${id}/read`, { method: 'PUT' });
            item.classList.remove('unread');
            item.classList.add('read');
            item.querySelector('.unread-dot')?.remove();
            loadNotificationCount();
        });
    });
}




