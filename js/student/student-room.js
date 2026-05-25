// 8. PHÒNG Ở – GET /api/room/my-room
// ======================================================================
let residenceHistoryExpanded = false;

function getRoomStatusMeta(status) {
    const normalized = String(status || '').trim();
    const map = {
        Available: { label: 'Available', cls: 'is-available', contractLabel: 'Đang hiệu lực' },
        Full: { label: 'Full', cls: 'is-full', contractLabel: 'Đã đủ chỗ' },
        Locked: { label: 'Locked', cls: 'is-locked', contractLabel: 'Tạm khóa' },
        Active: { label: 'Đang hiệu lực', cls: 'is-available', contractLabel: 'Đang hiệu lực' },
        Inactive: { label: 'Vô hiệu', cls: 'is-locked', contractLabel: 'Vô hiệu' },
        Expired: { label: 'Hết hạn', cls: 'is-locked', contractLabel: 'Hết hạn' },
        Terminated: { label: 'Đã chấm dứt', cls: 'is-locked', contractLabel: 'Đã chấm dứt' }
    };
    return map[normalized] || { label: normalized || '—', cls: 'is-muted', contractLabel: normalized || '—' };
}

function roomSummaryCard(icon, tone, label, value, valueHtml = null) {
    return `
        <article class="residence-summary-card">
            <span class="residence-summary-icon ${icon} ${tone}"></span>
            <span class="residence-summary-label">${escapeText(label)}</span>
            <strong class="residence-summary-value">${valueHtml ?? escapeText(value || '—')}</strong>
        </article>`;
}

function contractDetailRow(icon, label, valueHtml) {
    return `
        <div class="contract-detail-row">
            <span class="contract-detail-icon ${icon}"></span>
            <span>${escapeText(label)}</span>
            <strong>${valueHtml}</strong>
        </div>`;
}

function renderRegisterAgainCard(message, detail) {
    return `
        <div class="empty-state residence-empty residence-register-again">
            <strong>${escapeText(message)}</strong>
            <p>${escapeText(detail)}</p>
            <button type="button" class="btn-primary residence-register-again-btn" data-register-again>
                Đăng ký ở lại
            </button>
        </div>`;
}

function bindRegisterAgainButtons(root = document) {
    root.querySelectorAll('[data-register-again]').forEach(button => {
        if (button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => {
            window.location.href = 'register.html?returning=1';
        });
    });
}

function getDaysRemainingLabel(contract) {
    const rawDays = Number(contract?.daysRemaining);
    if (Number.isFinite(rawDays)) {
        return `${Math.max(0, rawDays)} ngày`;
    }

    const end = new Date(contract?.endDate);
    if (isNaN(end)) return '—';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const days = Math.ceil((end - today) / 86400000);
    return `${Math.max(0, days)} ngày`;
}

function renderResidenceHistory(contract) {
    return `
        <article class="content-card residence-history-card residence-history-modern">
            <div class="residence-panel-head">
                <div class="residence-history-title-block">
                    <h3>Lịch sử lưu trú</h3>
                    <p>Các hoạt động và thay đổi trong quá trình lưu trú</p>
                </div>
            </div>
            <div class="residence-history-body">
                <div class="stay-history-timeline" id="stay-history-events">
                    ${renderResidenceHistoryTimeline(contract)}
                </div>
                <button type="button" class="stay-history-more-btn" id="view-stay-history-btn">
                    <span></span>
                    Xem tất cả lịch sử
                    <i></i>
                </button>
            </div>
        </article>`;
}

function renderResidenceHistoryTimeline(contract, renewals = [], transfers = [], showAll = false) {
    return getResidenceHistoryEvents(contract, renewals, transfers, showAll)
        .map(renderResidenceHistoryEvent)
        .join('');
}

function getResidenceHistoryEvents(contract, renewals = [], transfers = [], showAll = false) {
    const latestTransfer = getLatestApprovedTransfer(transfers);
    const allApprovedTransfers = getApprovedTransfers(transfers);
    const initialRoom = allApprovedTransfers[0]?.fromRoomCode || contract?.roomCode || '—';
    const middleEvents = [];
    const latestRenewal = getLatestApprovedRenewal(renewals);
    const approvedRenewals = showAll
        ? getApprovedRenewals(renewals)
        : latestRenewal ? [latestRenewal] : [];
    const approvedTransfers = showAll
        ? allApprovedTransfers
        : latestTransfer ? [latestTransfer] : [];

    approvedRenewals.forEach(renewal => {
        const months = Number(renewal.durationMonths);
        const renewalName = getResidenceRenewalName(renewal);
        middleEvents.push({
            tone: 'renewal',
            date: renewal.requestedAt || renewal.contractEndDateBeforeRenewal,
            title: 'Gia hạn hợp đồng',
            desc: `Gia hạn thêm ${renewalName}`,
            badge: Number.isFinite(months) && months > 0 ? `${months} tháng` : 'Đã duyệt'
        });
    });

    approvedTransfers.forEach(transfer => {
        const fromRoom = transfer.fromRoomCode || 'Phòng cũ';
        const toRoom = transfer.toRoomCode || 'Phòng mới';
        middleEvents.push({
            tone: 'transfer',
            date: transfer.requestedAt || transfer.createdAt,
            title: 'Chuyển phòng',
            desc: `Chuyển từ ${fromRoom} sang ${toRoom}`,
            badge: `${fromRoom} → ${toRoom}`
        });
    });

    middleEvents.sort((a, b) => getResidenceEventTime(a.date) - getResidenceEventTime(b.date));

    return [
        {
            tone: 'start',
            date: contract?.startDate,
            title: 'Nhận phòng',
            desc: `Nhận phòng ${formatResidenceRoomLine(initialRoom)}`,
            badge: 'Bắt đầu'
        },
        ...middleEvents,
        {
            tone: 'end',
            date: contract?.endDate,
            title: 'Kết thúc hợp đồng dự kiến',
            desc: 'Hợp đồng kết thúc theo thời hạn',
            badge: 'Dự kiến'
        }
    ];
}
function renderResidenceHistoryEvent(event) {
    return `
        <div class="stay-history-item stay-tone-${escapeText(event.tone)}">
            <span class="stay-history-marker"></span>
            <time>${escapeText(formatDate(event.date))}</time>
            <div class="stay-history-copy">
                <strong>${escapeText(event.title)}</strong>
                <p>${escapeText(event.desc)}</p>
            </div>
            <span class="stay-history-badge">${escapeText(event.badge)}</span>
        </div>`;
}

function getApprovedRenewals(renewals = []) {
    return renewals
        .filter(item => String(item.status || '').toLowerCase() === 'approved')
        .sort((a, b) => {
            const dateA = getResidenceEventTime(a.requestedAt || a.contractEndDateAfterRenewal);
            const dateB = getResidenceEventTime(b.requestedAt || b.contractEndDateAfterRenewal);
            if (dateA !== dateB) return dateA - dateB;
            return Number(a.id || 0) - Number(b.id || 0);
        });
}

function getLatestApprovedRenewal(renewals = []) {
    return getApprovedRenewals(renewals)
        .sort((a, b) => {
            const dateA = getResidenceEventTime(a.requestedAt || a.contractEndDateAfterRenewal);
            const dateB = getResidenceEventTime(b.requestedAt || b.contractEndDateAfterRenewal);
            if (dateB !== dateA) return dateB - dateA;
            return Number(b.id || 0) - Number(a.id || 0);
        })[0] || null;
}

function getApprovedTransfers(transfers = []) {
    return transfers
        .filter(item => {
            const status = String(item.status || '').toLowerCase();
            return status === 'approved' || status === 'completed';
        })
        .sort((a, b) => {
            const dateA = getResidenceEventTime(a.requestedAt || a.createdAt);
            const dateB = getResidenceEventTime(b.requestedAt || b.createdAt);
            if (dateA !== dateB) return dateA - dateB;
            return Number(a.id || 0) - Number(b.id || 0);
        });
}

function getLatestApprovedTransfer(transfers = []) {
    return getApprovedTransfers(transfers)
        .sort((a, b) => {
            const dateA = getResidenceEventTime(a.requestedAt || a.createdAt);
            const dateB = getResidenceEventTime(b.requestedAt || b.createdAt);
            if (dateB !== dateA) return dateB - dateA;
            return Number(b.id || 0) - Number(a.id || 0);
        })[0] || null;
}

function getResidenceRenewalName(item) {
    const name = item?.packageName || 'kỳ gia hạn';
    const months = Number(item?.durationMonths);
    if (!Number.isFinite(months) || months <= 0 || String(name).includes(`${months}`)) return name;
    return `${name} (${months} tháng)`;
}

function formatResidenceRoomLine(roomCode) {
    if (!roomCode || roomCode === '—') return '—';
    const building = String(roomCode).trim().match(/^[A-Za-zÀ-Ỵ]/)?.[0]?.toUpperCase();
    return building ? `${roomCode}, Tòa ${building}` : roomCode;
}

function getResidenceEventTime(value) {
    const date = typeof parseDateValue === 'function' ? parseDateValue(value) : new Date(value);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function bindResidenceHistoryViewAll() {
    const btn = document.getElementById('view-stay-history-btn');
    if (!btn || btn.dataset.bound === 'true') return;

    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
        residenceHistoryExpanded = true;
        const timelineEl = document.getElementById('stay-history-events');
        if (timelineEl) {
            timelineEl.innerHTML = renderResidenceHistoryTimeline(
                currentResidenceContract,
                currentRenewalHistory,
                currentResidenceTransfers,
                true
            );
        }
        btn.hidden = true;
    });
}

function bindResidenceRecordDownload(contract) {
    const btn = document.getElementById('download-stay-record-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const fileBase = (contract.contractCode || 'bien-ban-luu-tru')
            .toString()
            .replace(/[^\w-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const content = [
            'BIÊN BẢN THÔNG TIN LƯU TRÚ',
            '',
            `Mã hợp đồng: ${contract.contractCode || '—'}`,
            `Phòng: ${contract.roomCode || '—'}`,
            `Loại phòng: ${contract.roomType || '—'}`,
            `Ngày bắt đầu: ${formatDate(contract.startDate)}`,
            `Ngày kết thúc: ${formatDate(contract.endDate)}`,
            `Giá thuê: ${formatCurrency(contract.price)} / tháng`,
            `Trạng thái: ${getRoomStatusMeta(contract.status).contractLabel}`,
            `Còn lại: ${getDaysRemainingLabel(contract)}`
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileBase || 'bien-ban-luu-tru'}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('Đã tải biên bản lưu trú.');
    });
}

async function loadMyRoom() {
    setLoading('room-content');
    const res = await callApi('/room/my-room');
    const el = document.getElementById('room-content');
    if (!res || !res.ok || !res.data) {
        el.innerHTML = renderRegisterAgainCard(
            'Bạn hiện chưa có phòng đang hoạt động.',
            'Nếu muốn tiếp tục ở ký túc xá, hãy gửi đơn đăng ký ở lại theo luồng đăng ký bình thường.'
        );
        bindRegisterAgainButtons(el);
        return;
    }

    const r = res.data; // RoomDto
    const roomStatus = getRoomStatusMeta(r.status);
    el.innerHTML = `
        <div class="residence-overview">
            <div class="residence-head">
                <div class="residence-title-block">
                    <span class="residence-title-icon icon-building"></span>
                    <div>
                        <h2>Thông tin lưu trú hiện tại</h2>
                        <p>Quản lý thông tin phòng ở và tình trạng lưu trú</p>
                    </div>
                </div>
                <span class="residence-valid-pill ${roomStatus.cls}">
                    <span></span>
                    ${escapeText(roomStatus.contractLabel)}
                </span>
            </div>
            <div class="residence-summary-grid">
                ${roomSummaryCard('icon-door', 'tone-blue', 'Mã phòng', r.roomCode)}
                ${roomSummaryCard('icon-people', 'tone-purple', 'Loại phòng', r.roomType)}
                ${roomSummaryCard('icon-home', 'tone-green', 'Tòa nhà', `${r.buildingName || '—'} (${r.buildingCode || '—'})`)}
                ${roomSummaryCard('icon-user', 'tone-orange', 'Sức chứa', `${r.currentOccupancy ?? '—'}/${r.capacity ?? '—'} người`)}
                ${roomSummaryCard('icon-gender', 'tone-pink', 'Giới tính', r.genderAllowed)}
                ${roomSummaryCard('icon-status', 'tone-cyan', 'Trạng thái', '', `<span class="residence-status-pill ${roomStatus.cls}">${escapeText(roomStatus.label)}</span>`)}
            </div>
        </div>`;
}

