// 8. PHÒNG Ở – GET /api/room/my-room
// ======================================================================
function getRoomStatusMeta(status) {
    const normalized = String(status || '').trim();
    const map = {
        Available: { label: 'Available', cls: 'is-available', contractLabel: 'Đang hiệu lực' },
        Full: { label: 'Full', cls: 'is-full', contractLabel: 'Đã đủ chỗ' },
        Locked: { label: 'Locked', cls: 'is-locked', contractLabel: 'Tạm khóa' },
        Active: { label: 'Đang hiệu lực', cls: 'is-available', contractLabel: 'Đang hiệu lực' },
        Inactive: { label: 'Vô hiệu', cls: 'is-locked', contractLabel: 'Vô hiệu' },
        Expired: { label: 'Hết hạn', cls: 'is-locked', contractLabel: 'Hết hạn' },
        Terminated: { label: 'Đã thanh lý', cls: 'is-locked', contractLabel: 'Đã thanh lý' }
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
    const latestRenewal = contract?.latestRenewalDate || contract?.renewedAt || contract?.renewalDate;
    return `
        <article class="content-card residence-history-card">
            <div class="residence-panel-head">
                <div class="residence-panel-title">
                    <span class="residence-panel-icon icon-calendar"></span>
                    <h3>Lịch sử lưu trú</h3>
                </div>
                <button type="button" class="residence-download-btn" id="download-stay-record-btn">
                    <span></span>
                    Tải biên bản
                </button>
            </div>
            <div class="residence-history-body">
                <div class="residence-timeline">
                    <div class="timeline-item">
                        <span class="timeline-check"></span>
                        <strong>Nhận phòng</strong>
                        <time>${formatDate(contract.startDate)}</time>
                    </div>
                    <div class="timeline-item">
                        <span class="timeline-check"></span>
                        <strong>Gia hạn gần nhất</strong>
                        <time>${latestRenewal ? formatDate(latestRenewal) : '—'}</time>
                    </div>
                    <div class="timeline-item">
                        <span class="timeline-check"></span>
                        <strong>Dự kiến kết thúc</strong>
                        <time>${formatDate(contract.endDate)}</time>
                    </div>
                </div>
                <div class="residence-illustration" aria-hidden="true">
                    <span class="illustration-shadow"></span>
                    <span class="illustration-building"></span>
                    <span class="illustration-pin"></span>
                    <span class="illustration-calendar"></span>
                    <span class="illustration-tree tree-one"></span>
                    <span class="illustration-tree tree-two"></span>
                </div>
            </div>
        </article>`;
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
        el.innerHTML = `<div class="empty-state residence-empty">Bạn hiện không có phòng đang hoạt động.<br><small>Điều này có nghĩa chưa có hợp đồng Active.</small></div>`;
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

