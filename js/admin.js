function adminToast(message, isError = false) {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? '#991b1b' : '#1f2937';
    toast.classList.add('show');
    window.clearTimeout(adminToast._timer);
    adminToast._timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function adminBadge(status) {
    const value = String(status || '').toLowerCase();
    const labels = {
        pending: 'Chờ duyệt',
        approved: 'Đã duyệt',
        rejected: 'Từ chối',
        active: 'Đang hiệu lực',
        completed: 'Hoàn thành',
        cancelled: 'Đã hủy',
        draft: 'Nháp',
        expired: 'Hết hạn',
        paid: 'Đã thanh toán',
        unpaid: 'Chưa thanh toán'
    };
    return `<span class="status-badge ${value}">${labels[value] || status || 'Không rõ'}</span>`;
}

function setStackLoading(id, message) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="empty-state">${message}</div>`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function promptNote(message) {
    const value = window.prompt(message);
    return value == null ? null : value.trim();
}

async function withAction(button, task) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Đang xử lý...';
    try {
        await task();
    } finally {
        button.disabled = false;
        button.textContent = original;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindAdminHeader();
    bindNavigation();
    bindReloadButtons();
    bindNotificationForm();
    loadOverview();
    loadRegistrations();
    loadRequests();
    loadTransfers();
    loadRenewals();
    loadRooms();
    loadNotifications();
});

function bindAdminHeader() {
    const fullName = localStorage.getItem('fullName') || sessionStorage.getItem('fullName') || 'Quản trị viên';
    document.getElementById('admin-name').textContent = fullName;
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    initWelcomeMenu();
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

function bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.target)?.classList.add('active');
        });
    });
}

function bindReloadButtons() {
    document.getElementById('refresh-dashboard-btn')?.addEventListener('click', loadOverview);
    document.getElementById('reload-registrations-btn')?.addEventListener('click', loadRegistrations);
    document.getElementById('reload-requests-btn')?.addEventListener('click', loadRequests);
    document.getElementById('reload-transfers-btn')?.addEventListener('click', loadTransfers);
    document.getElementById('reload-renewals-btn')?.addEventListener('click', loadRenewals);
    document.getElementById('reload-rooms-btn')?.addEventListener('click', loadRooms);
    document.getElementById('reload-notifications-btn')?.addEventListener('click', loadNotifications);
}

async function loadOverview() {
    setStackLoading('overview-pending-feed', 'Đang tải dữ liệu chờ xử lý...');
    setStackLoading('overview-room-feed', 'Đang tải tình trạng phòng...');

    const [registrations, requests, transfers, renewals, rooms] = await Promise.all([
        callApi('/registrations/pending'),
        callApi('/studentrequests?status=Pending'),
        callApi('/roomtransfers/pending'),
        callApi('/contracts/renewals/pending'),
        callApi('/room')
    ]);

    const regList = Array.isArray(registrations?.data) ? registrations.data : [];
    const reqList = Array.isArray(requests?.data) ? requests.data : [];
    const transferList = Array.isArray(transfers?.data) ? transfers.data : [];
    const renewalList = Array.isArray(renewals?.data) ? renewals.data : [];
    const roomList = Array.isArray(rooms?.data) ? rooms.data : [];

    document.getElementById('stat-registrations').textContent = regList.length;
    document.getElementById('stat-requests').textContent = reqList.length;
    document.getElementById('stat-transfers').textContent = transferList.length;
    document.getElementById('stat-renewals').textContent = renewalList.length;

    const pendingFeed = [
        ...regList.slice(0, 3).map(item => ({
            title: item.fullName,
            meta: `${item.registrationCode} · ${item.roomCode || 'Chưa có phòng'}`,
            type: 'Đăng ký mới'
        })),
        ...reqList.slice(0, 3).map(item => ({
            title: item.title,
            meta: `${item.studentName} · ${item.requestType}`,
            type: 'Yêu cầu sinh viên'
        })),
        ...transferList.slice(0, 3).map(item => ({
            title: `${item.fromRoomCode} -> ${item.toRoomCode}`,
            meta: item.reason || 'Không có lý do',
            type: 'Chuyển phòng'
        })),
        ...renewalList.slice(0, 3).map(item => ({
            title: item.contractCode,
            meta: item.packageName,
            type: 'Gia hạn'
        }))
    ];

    document.getElementById('overview-pending-feed').innerHTML = pendingFeed.length
        ? pendingFeed.map(item => `
            <div class="queue-item">
                <div class="queue-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill">${escapeHtml(item.type)}</span>
                </div>
                <p class="queue-body">${escapeHtml(item.meta)}</p>
            </div>
        `).join('')
        : '<div class="empty-state">Hiện không có mục nào đang chờ xử lý.</div>';

    const roomSummary = summarizeRooms(roomList);
    document.getElementById('overview-room-feed').innerHTML = roomSummary.length
        ? roomSummary.map(item => `
            <div class="queue-item">
                <div class="queue-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill neutral">${escapeHtml(item.value)}</span>
                </div>
                <p class="queue-body">${escapeHtml(item.description)}</p>
            </div>
        `).join('')
        : '<div class="empty-state">Chưa lấy được dữ liệu phòng.</div>';
}

function summarizeRooms(rooms) {
    if (!rooms.length) return [];
    const available = rooms.filter(room => room.availableSlots > 0).length;
    const full = rooms.filter(room => (room.availableSlots ?? 0) <= 0).length;
    const male = rooms.filter(room => room.genderAllowed === 'Nam').length;
    const female = rooms.filter(room => room.genderAllowed === 'Nữ').length;

    return [
        { title: 'Phòng còn chỗ', value: `${available}`, description: 'Các phòng còn thể nhận thêm sinh viên.' },
        { title: 'Phòng đã đầy', value: `${full}`, description: 'Cần theo dõi để cân đối khi có yêu cầu chuyển.' },
        { title: 'Phòng nam', value: `${male}`, description: 'Tổng số phòng đang dành cho sinh viên nam.' },
        { title: 'Phòng nữ', value: `${female}`, description: 'Tổng số phòng đang dành cho sinh viên nữ.' }
    ];
}

async function loadRegistrations() {
    setStackLoading('registrations-list', 'Đang tải danh sách đăng ký...');
    const res = await callApi('/registrations/pending');
    const list = Array.isArray(res?.data) ? res.data : [];
    const container = document.getElementById('registrations-list');

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Không có đơn đăng ký nào đang chờ duyệt.</div>';
        return;
    }

    container.innerHTML = list.map(item => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fullName)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Mã đơn: ${escapeHtml(item.registrationCode)}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || '—')}</span>
                <span>${formatDate(item.startDate)} - ${formatDate(item.endDate)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-reg-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-reg-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `).join('');

    container.querySelectorAll('[data-reg-approve]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const resApprove = await callApi(`/registrations/${button.dataset.regApprove}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: true, rejectionReason: 'Hồ sơ hợp lệ' })
            });
            if (resApprove?.ok) {
                adminToast('Đã duyệt đơn đăng ký.');
                loadRegistrations();
                loadOverview();
            } else {
                adminToast(resApprove?.data?.message || 'Không thể duyệt đơn đăng ký.', true);
            }
        }));
    });

    container.querySelectorAll('[data-reg-reject]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const reason = promptNote('Nhập lý do từ chối đơn đăng ký:');
            if (reason == null) return;
            const resReject = await callApi(`/registrations/${button.dataset.regReject}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: false, rejectionReason: reason || 'Hồ sơ chưa đáp ứng yêu cầu' })
            });
            if (resReject?.ok) {
                adminToast('Đã từ chối đơn đăng ký.');
                loadRegistrations();
                loadOverview();
            } else {
                adminToast(resReject?.data?.message || 'Không thể từ chối đơn đăng ký.', true);
            }
        }));
    });
}

async function loadRequests() {
    setStackLoading('requests-list', 'Đang tải yêu cầu sinh viên...');
    const res = await callApi('/studentrequests?status=Pending');
    const list = Array.isArray(res?.data) ? res.data : [];
    const container = document.getElementById('requests-list');

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Không có yêu cầu sinh viên nào đang chờ.</div>';
        return;
    }

    container.innerHTML = list.map(item => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>${escapeHtml(item.studentName)}</span>
                <span>Loại: ${escapeHtml(item.requestType)}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || '—')}</span>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.description)}</p>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-req-approve="${item.id}">Duyệt</button>
                <button type="button" class="secondary-btn" data-req-complete="${item.id}">Hoàn thành</button>
                <button type="button" class="danger-btn" data-req-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `).join('');

    bindRequestStatusAction(container, '[data-req-approve]', 'reqApprove', 'Approved', 'Nhập ghi chú duyệt yêu cầu:');
    bindRequestStatusAction(container, '[data-req-complete]', 'reqComplete', 'Completed', 'Nhập ghi chú hoàn thành yêu cầu:');
    bindRequestStatusAction(container, '[data-req-reject]', 'reqReject', 'Rejected', 'Nhập lý do từ chối yêu cầu:');
}

function bindRequestStatusAction(container, selector, datasetKey, status, promptMessage) {
    container.querySelectorAll(selector).forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const note = promptNote(promptMessage);
            if (note == null) return;
            const requestId = button.dataset[datasetKey];
            const res = await callApi(`/studentrequests/${requestId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status, resolutionNote: note || null })
            });
            if (res?.ok) {
                adminToast('Đã cập nhật trạng thái yêu cầu.');
                loadRequests();
                loadOverview();
            } else {
                adminToast(res?.data?.message || 'Không thể cập nhật yêu cầu.', true);
            }
        }));
    });
}

async function loadTransfers() {
    setStackLoading('transfers-list', 'Đang tải yêu cầu chuyển phòng...');
    const res = await callApi('/roomtransfers/pending');
    const list = Array.isArray(res?.data) ? res.data : [];
    const container = document.getElementById('transfers-list');

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Không có yêu cầu chuyển phòng đang chờ.</div>';
        return;
    }

    container.innerHTML = list.map(item => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fromRoomCode)} -> ${escapeHtml(item.toRoomCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Ngày gửi: ${formatDate(item.requestedAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.reason || 'Không có lý do')}</p>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-transfer-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-transfer-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `).join('');

    container.querySelectorAll('[data-transfer-approve]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const resApprove = await callApi(`/roomtransfers/${button.dataset.transferApprove}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: true, rejectionReason: null })
            });
            if (resApprove?.ok) {
                adminToast('Đã duyệt yêu cầu chuyển phòng.');
                loadTransfers();
                loadOverview();
            } else {
                adminToast(resApprove?.data?.message || 'Không thể duyệt yêu cầu chuyển phòng.', true);
            }
        }));
    });

    container.querySelectorAll('[data-transfer-reject]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const reason = promptNote('Nhập lý do từ chối yêu cầu chuyển phòng:');
            if (reason == null) return;
            const resReject = await callApi(`/roomtransfers/${button.dataset.transferReject}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: false, rejectionReason: reason || 'Không phù hợp điều kiện chuyển phòng' })
            });
            if (resReject?.ok) {
                adminToast('Đã từ chối yêu cầu chuyển phòng.');
                loadTransfers();
                loadOverview();
            } else {
                adminToast(resReject?.data?.message || 'Không thể từ chối yêu cầu chuyển phòng.', true);
            }
        }));
    });
}

async function loadRenewals() {
    setStackLoading('renewals-list', 'Đang tải yêu cầu gia hạn...');
    const res = await callApi('/contracts/renewals/pending');
    const list = Array.isArray(res?.data) ? res.data : [];
    const container = document.getElementById('renewals-list');

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Không có yêu cầu gia hạn nào đang chờ.</div>';
        return;
    }

    container.innerHTML = list.map(item => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.contractCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Gói: ${escapeHtml(item.packageName)}</span>
                <span>Ngày gửi: ${formatDate(item.requestedAt)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-renewal-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-renewal-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `).join('');

    container.querySelectorAll('[data-renewal-approve]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const resApprove = await callApi(`/contracts/renewals/${button.dataset.renewalApprove}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: true, rejectionReason: null })
            });
            if (resApprove?.ok) {
                adminToast('Đã duyệt yêu cầu gia hạn.');
                loadRenewals();
                loadOverview();
            } else {
                adminToast(resApprove?.data?.message || 'Không thể duyệt yêu cầu gia hạn.', true);
            }
        }));
    });

    container.querySelectorAll('[data-renewal-reject]').forEach(button => {
        button.addEventListener('click', () => withAction(button, async () => {
            const reason = promptNote('Nhập lý do từ chối gia hạn hợp đồng:');
            if (reason == null) return;
            const resReject = await callApi(`/contracts/renewals/${button.dataset.renewalReject}/approve`, {
                method: 'PUT',
                body: JSON.stringify({ isApproved: false, rejectionReason: reason || 'Chưa đủ điều kiện gia hạn' })
            });
            if (resReject?.ok) {
                adminToast('Đã từ chối yêu cầu gia hạn.');
                loadRenewals();
                loadOverview();
            } else {
                adminToast(resReject?.data?.message || 'Không thể từ chối yêu cầu gia hạn.', true);
            }
        }));
    });
}

async function loadRooms() {
    const tbody = document.getElementById('rooms-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Đang tải danh sách phòng...</td></tr>';

    const res = await callApi('/room');
    const list = Array.isArray(res?.data) ? res.data : [];

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Không có dữ liệu phòng.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(room => `
        <tr>
            <td><strong>${escapeHtml(room.roomCode)}</strong></td>
            <td>${escapeHtml(room.buildingName)} (${escapeHtml(room.buildingCode)})</td>
            <td>${escapeHtml(room.roomType)}</td>
            <td>${escapeHtml(room.genderAllowed || '—')}</td>
            <td>${escapeHtml(room.currentOccupancy)}/${escapeHtml(room.capacity)} (${escapeHtml(room.availableSlots)} chỗ trống)</td>
            <td>${adminBadge(room.status)}</td>
        </tr>
    `).join('');
}

function bindNotificationForm() {
    document.getElementById('notification-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const errorEl = document.getElementById('notif-form-error');
        errorEl.textContent = '';

        const userId = Number(document.getElementById('notif-user-id').value);
        const title = document.getElementById('notif-title').value.trim();
        const message = document.getElementById('notif-message').value.trim();

        if (!userId) {
            errorEl.textContent = 'Vui lòng nhập User ID hợp lệ.';
            return;
        }
        if (!title || !message) {
            errorEl.textContent = 'Vui lòng nhập đủ tiêu đề và nội dung.';
            return;
        }

        const res = await callApi('/notifications', {
            method: 'POST',
            body: JSON.stringify({ userId, title, message })
        });

        if (res?.ok) {
            adminToast('Đã gửi thông báo.');
            event.target.reset();
            loadNotifications();
        } else {
            errorEl.textContent = res?.data?.message || 'Không thể gửi thông báo.';
        }
    });
}

async function loadNotifications() {
    setStackLoading('notifications-list', 'Đang tải thông báo...');
    const res = await callApi('/notifications');
    const list = Array.isArray(res?.data) ? res.data : [];
    const container = document.getElementById('notifications-list');

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Chưa có thông báo nào.</div>';
        return;
    }

    container.innerHTML = list.slice(0, 12).map(item => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="pill neutral">User #${escapeHtml(item.userId)}</span>
            </div>
            <div class="queue-meta">
                <span>${formatDate(item.createdAt)}</span>
                <span>${item.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.message)}</p>
        </article>
    `).join('');
}
