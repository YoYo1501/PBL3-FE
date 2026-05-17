// ======================================================================
// STUDENT NOTIFICATIONS - GET /api/notifications/my & PUT /api/notifications/{id}/read
// ======================================================================

const NOTIF_PAGE_SIZE = typeof NOTIFICATION_PAGE_SIZE !== 'undefined' ? NOTIFICATION_PAGE_SIZE : 5;

function truncateText(text, maxLen = 120) {
    if (!text) return '';
    const value = String(text);
    if (value.length <= maxLen) return value;
    return value.slice(0, maxLen).trimEnd() + '...';
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)   return 'Vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    return Math.floor(diff / 86400) + ' ngày trước';
}

/* Gán màu icon theo tiêu đề / từ khoá */
function getNotifIconClass(notification) {
    const title = (notification.title || '').toLowerCase();
    const msg   = (notification.message || '').toLowerCase();
    if (title.includes('thanh toán') || title.includes('hóa đơn') || msg.includes('thanh toán'))
        return 'nicon-invoice';
    if (title.includes('chuyển phòng') || title.includes('phòng mới'))
        return 'nicon-room';
    if (title.includes('yêu cầu') || msg.includes('yêu cầu'))
        return 'nicon-request';
    if (title.includes('hệ thống') || title.includes('bảo trì'))
        return 'nicon-system';
    if (title.includes('hợp đồng'))
        return 'nicon-contract';
    return 'nicon-bell';
}

/* Badge trạng thái đọc/chưa đọc */
function getNotifBadge(notification) {
    return notification.isRead
        ? '<span class="notif-state-badge notif-state-read">Đã đọc</span>'
        : '<span class="notif-state-badge notif-state-unread">Chưa đọc</span>';
}

function normalizeNotificationText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function parseNotificationDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const raw = String(value).trim();

    const vnMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (vnMatch) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = vnMatch;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const normalizedIso = raw.replace(/(\.\d{3})\d+/, '$1');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedIso);
    const isoWithoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalizedIso) && !hasTimezone;
    const parsed = new Date(isoWithoutTimezone ? `${normalizedIso}Z` : normalizedIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNotificationCreatedAt(notification) {
    return notification.createdAt || notification.CreatedAt || notification.createdDate || notification.date || notification.sentAt;
}

function timeAgo(dateStr) {
    const date = parseNotificationDate(dateStr);
    if (!date) return '';

    const diff = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    return Math.floor(diff / 86400) + ' ngày trước';
}

function formatNotificationDateTime(value) {
    const date = parseNotificationDate(value);
    if (!date) return '';
    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getNotifIconClass(notification) {
    const text = `${normalizeNotificationText(notification.title)} ${normalizeNotificationText(notification.message)}`;

    if (text.includes('han thanh toan') || text.includes('qua han') || text.includes('tre han'))
        return 'nicon-clock';
    if (text.includes('nhac no') || text.includes('hoa don') || text.includes('thanh toan'))
        return 'nicon-document';
    if (text.includes('yeu cau') || text.includes('ho tro'))
        return 'nicon-request';
    if (text.includes('he thong') || text.includes('bao tri'))
        return 'nicon-megaphone';
    if (text.includes('chuyen phong') || text.includes('phong moi') || text.includes('hop dong'))
        return 'nicon-document';
    return 'nicon-bell';
}

function getNotifBadge(notification) {
    return notification.isRead
        ? '<span class="notif-state-badge notif-state-read">Đã đọc</span>'
        : '<span class="notif-state-badge notif-state-unread">Chưa đọc</span>';
}

function showNotifModal({ title, date, message }) {
    const overlay = document.getElementById('notif-detail-modal');
    if (!overlay) return;

    document.getElementById('notif-modal-title').textContent = title || '';
    document.getElementById('notif-modal-date').textContent  = date || '';
    document.getElementById('notif-modal-body').textContent  = message || '';
    overlay.style.display = 'flex';

    const close = () => {
        overlay.style.display = 'none';
        document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (event) => { if (event.key === 'Escape') close(); };

    document.getElementById('notif-modal-close-btn').onclick = close;
    overlay.onclick = (event) => { if (event.target === overlay) close(); };
    document.addEventListener('keydown', onKeydown);
}

function renderNotificationBadges(notifications = currentNotifications) {
    const unread = notifications.filter(item => !item.isRead).length;
    const badges = [
        document.getElementById('notif-badge'),
        document.getElementById('top-notif-badge')
    ].filter(Boolean);

    badges.forEach(badge => {
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

function renderNotifSidebar(notifications) {
    const total     = notifications.length;
    const unread    = notifications.filter(n => !n.isRead).length;
    const read      = total - unread;

    const elTotal = document.getElementById('notify-total-count');
    const elUnread = document.getElementById('notify-unread-summary');
    const elRead = document.getElementById('notify-read-summary');
    const elUnreadCount = document.getElementById('notify-unread-count');
    const elReadCount = document.getElementById('notify-read-count');

    if (elTotal) elTotal.textContent = total;
    if (elUnread) elUnread.textContent = unread;
    if (elRead) elRead.textContent = read;
    if (elUnreadCount) elUnreadCount.textContent = unread;
    if (elReadCount) elReadCount.textContent = read;
}

function normalizeNotificationsResponse(responseData) {
    if (Array.isArray(responseData)) return responseData;
    if (Array.isArray(responseData?.items)) return responseData.items;
    if (Array.isArray(responseData?.data)) return responseData.data;
    if (Array.isArray(responseData?.data?.items)) return responseData.data.items;
    return [];
}

function getFilteredNotifications(filter) {
    const all = currentNotifications;
    if (filter === 'unread') return all.filter(n => !n.isRead);
    if (filter === 'read') return all.filter(n => n.isRead);
    return all;
}

function renderNotifSidebar(notifications) {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.isRead).length;
    const read = total - unread;

    const elTotal = document.getElementById('notify-total-count');
    const elUnread = document.getElementById('notify-unread-summary');
    const elRead = document.getElementById('notify-read-summary');
    const elUnreadCount = document.getElementById('notify-unread-count');
    const elReadCount = document.getElementById('notify-read-count');

    if (elTotal) elTotal.textContent = total;
    if (elUnread) elUnread.textContent = unread;
    if (elRead) elRead.textContent = read;
    if (elUnreadCount) elUnreadCount.textContent = unread;
    if (elReadCount) elReadCount.textContent = read;
}

function getFilteredNotifications(filter) {
    const all = currentNotifications;
    if (filter === 'unread') return all.filter(n => !n.isRead);
    if (filter === 'read') return all.filter(n => n.isRead);
    return all;
}

function renderNotificationsList(notifications) {
    const el = document.getElementById('notify-content');
    if (!el) return;

    // Update filter tabs active state
    document.querySelectorAll('.notify-tab[data-notify-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.notifyFilter === notificationFilter);
    });

    // Sidebar stats always use ALL notifications
    renderNotifSidebar(currentNotifications);

    const filtered = getFilteredNotifications(notificationFilter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / NOTIF_PAGE_SIZE));
    if (notificationPage > totalPages) notificationPage = totalPages;
    const paged = filtered.slice((notificationPage - 1) * NOTIF_PAGE_SIZE, notificationPage * NOTIF_PAGE_SIZE);

    // Pagination UI
    const pagination = document.getElementById('notify-pagination');
    const pageInfo   = document.getElementById('notify-page-info');
    const prevBtn    = document.getElementById('notify-prev-btn');
    const nextBtn    = document.getElementById('notify-next-btn');
    if (pagination) {
        pagination.style.display = filtered.length > NOTIF_PAGE_SIZE ? 'flex' : 'none';
        if (pageInfo) pageInfo.textContent = `${notificationPage} / ${totalPages}`;
        if (prevBtn)  prevBtn.disabled = notificationPage <= 1;
        if (nextBtn)  nextBtn.disabled = notificationPage >= totalPages;
    }

    if (!paged.length) {
        el.innerHTML = '<div class="empty-state">Không có thông báo nào.</div>';
        return;
    }

    el.innerHTML = paged.map(item => `
        <article class="notif-row ${item.isRead ? 'notif-read' : 'notif-unread'}" data-notif-id="${item.id}" tabindex="0">
            <div class="notif-row-left">
                ${!item.isRead ? '<span class="notif-unread-dot"></span>' : '<span class="notif-unread-dot invisible"></span>'}
                <span class="notif-row-icon ${getNotifIconClass(item)}"></span>
            </div>
            <div class="notif-row-body">
                <div class="notif-row-head">
                    <span class="notif-row-title">${escapeText(item.title)}</span>
                    ${getNotifBadge(item)}
                    <span class="notif-row-time" title="${escapeText(formatNotificationDateTime(getNotificationCreatedAt(item)))}">${timeAgo(getNotificationCreatedAt(item))}</span>
                    <span class="notif-row-chevron">›</span>
                </div>
                <p class="notif-row-preview">${escapeText(truncateText(item.message, 140))}</p>
                <button type="button" class="notif-expand-hint" data-notify-open="${item.id}">Xem chi tiết →</button>
            </div>
        </article>`).join('');

    const openNotification = async (notificationId) => {
        const notification = currentNotifications.find(item => String(item.id) === String(notificationId));
        if (!notification) return;

        showNotifModal({
            title:   notification.title,
            date:    formatNotificationDateTime(getNotificationCreatedAt(notification)),
            message: notification.message
        });

        if (notification.isRead) return;

        const markRes = await callApi(`/notifications/${notification.id}/read`, { method: 'PUT' });
        if (markRes?.ok) {
            notification.isRead = true;
            renderNotificationBadges(currentNotifications);
            renderNotifSidebar(currentNotifications);
            // Update only the dot of that row
            const row = el.querySelector(`[data-notif-id="${notification.id}"]`);
            if (row) {
                row.classList.remove('notif-unread');
                row.classList.add('notif-read');
                const dot = row.querySelector('.notif-unread-dot');
                if (dot) dot.classList.add('invisible');
                const stateBadge = row.querySelector('.notif-state-badge');
                if (stateBadge) {
                    stateBadge.textContent = 'Đã đọc';
                    stateBadge.classList.remove('notif-state-unread');
                    stateBadge.classList.add('notif-state-read');
                }
            }
            // Update unread count in tab
            const unread = currentNotifications.filter(n => !n.isRead).length;
            const read = currentNotifications.length - unread;
            const el2 = document.getElementById('notify-unread-count');
            if (el2) el2.textContent = unread;
            const el3 = document.getElementById('notify-read-count');
            if (el3) el3.textContent = read;
            if (notificationFilter !== 'all') renderNotificationsList(currentNotifications);
        }
    };

    el.querySelectorAll('.notif-row').forEach(row => {
        row.addEventListener('click', () => openNotification(row.dataset.notifId));
        row.addEventListener('keydown', e => { if (e.key === 'Enter') openNotification(row.dataset.notifId); });
    });

    el.querySelectorAll('[data-notify-open]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            openNotification(button.dataset.notifyOpen);
        });
    });
}

async function loadNotificationCount(notifications = null) {
    let data = notifications;
    if (!Array.isArray(data)) {
        const res = await callApi('/notifications/my');
        if (!res?.ok) return;
        data = normalizeNotificationsResponse(res.data);
    }
    renderNotificationBadges(data);
}

async function loadNotifications() {
    const el = document.getElementById('notify-content');
    if (!el) return;

    el.innerHTML = '<div class="loading-state">Đang tải thông báo...</div>';

    const res = await callApi('/notifications/my');
    if (!res?.ok) {
        currentNotifications = [];
        renderNotificationBadges([]);
        renderNotifSidebar([]);
        el.innerHTML = '<div class="empty-state error-state">Không thể tải thông báo. Vui lòng thử lại sau.</div>';
        return;
    }

    currentNotifications = normalizeNotificationsResponse(res.data)
        .slice()
        .sort((a, b) => {
            const dateA = parseNotificationDate(getNotificationCreatedAt(a))?.getTime() || 0;
            const dateB = parseNotificationDate(getNotificationCreatedAt(b))?.getTime() || 0;
            return dateB - dateA;
        });

    renderNotificationBadges(currentNotifications);
    renderNotificationsList(currentNotifications);

    // Bind pagination buttons (once)
    const prevBtn = document.getElementById('notify-prev-btn');
    const nextBtn = document.getElementById('notify-next-btn');
    if (prevBtn && !prevBtn._bound) {
        prevBtn._bound = true;
        prevBtn.addEventListener('click', () => { notificationPage--; renderNotificationsList(currentNotifications); });
    }
    if (nextBtn && !nextBtn._bound) {
        nextBtn._bound = true;
        nextBtn.addEventListener('click', () => { notificationPage++; renderNotificationsList(currentNotifications); });
    }
}
