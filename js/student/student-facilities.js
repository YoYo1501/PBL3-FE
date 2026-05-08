// ======================================================================
// FACILITIES - GET /api/facilities/room/* and repair requests
// ======================================================================

function getFacilityCategory(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('máy lạnh') || normalized.includes('điều hòa')) return 'Điện lạnh';
    if (normalized.includes('quạt')) return 'Điện gia dụng';
    if (normalized.includes('đèn')) return 'Điện chiếu sáng';
    if (normalized.includes('ổ cắm') || normalized.includes('điện')) return 'Điện';
    if (normalized.includes('bàn') || normalized.includes('tủ') || normalized.includes('giường') || normalized.includes('ghế')) return 'Nội thất';
    return 'Thiết bị';
}

function getFacilityIconClass(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('máy lạnh') || normalized.includes('điều hòa')) return 'item-air';
    if (normalized.includes('quạt')) return 'item-fan';
    if (normalized.includes('đèn')) return 'item-light';
    if (normalized.includes('ổ cắm') || normalized.includes('điện')) return 'item-plug';
    if (normalized.includes('bàn')) return 'item-desk';
    if (normalized.includes('tủ')) return 'item-wardrobe';
    if (normalized.includes('giường')) return 'item-bed';
    return 'item-box';
}

function getFacilityStatusMeta(status) {
    const normalized = String(status || '').trim();
    const map = {
        Good: { label: 'Hoạt động tốt', cls: 'is-good', note: 'Bình thường' },
        Damaged: { label: 'Cần sửa chữa', cls: 'is-repair', note: 'Cần kiểm tra' },
        UnderMaintenance: { label: 'Đang bảo trì', cls: 'is-maintenance', note: 'Đang xử lý' }
    };
    return map[normalized] || { label: normalized || 'Chưa rõ', cls: 'is-muted', note: 'Chưa cập nhật' };
}

function setFacilityStats(facilities = [], repairHistory = []) {
    const repairCount = facilities.filter(item => item.status !== 'Good').length;
    const goodCount = facilities.filter(item => item.status === 'Good').length;
    const pairs = [
        ['facility-total-count', facilities.length],
        ['facility-good-count', goodCount],
        ['facility-repair-count', repairCount],
        ['facility-history-count', repairHistory.length]
    ];

    pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function renderFacilityDeviceOptions(facilities = []) {
    const select = document.getElementById('facility-report-device');
    if (!select) return;
    select.innerHTML = `
        <option value="">Chọn thiết bị cần báo hỏng</option>
        ${facilities.map(item => `<option value="${item.id}">${escapeText(item.name || 'Thiết bị')} ${item.quantity > 1 ? `(x${item.quantity})` : ''}</option>`).join('')}`;
}

function renderFacilitiesTable(facilities = currentFacilities) {
    const el = document.getElementById('my-room-facilities');
    if (!el) return;

    if (!facilities.length) {
        el.innerHTML = '<div class="empty-state facilities-empty">Phòng hiện chưa có thiết bị nào được ghi nhận.</div>';
        return;
    }

    const q = (document.getElementById('facility-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('facility-status-filter')?.value || '';
    const filtered = facilities.filter(item => {
        const matchesSearch = !q || [item.name, getFacilityCategory(item.name), item.status]
            .some(value => String(value || '').toLowerCase().includes(q));
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });

    if (!filtered.length) {
        el.innerHTML = '<div class="empty-state facilities-empty">Không tìm thấy thiết bị phù hợp.</div>';
        return;
    }

    const rows = filtered.map(item => {
        const meta = getFacilityStatusMeta(item.status);
        const quantity = Number(item.quantity) > 1 ? `<span class="facility-quantity">x${escapeText(item.quantity)}</span>` : '';
        return `
            <tr>
                <td>
                    <div class="facility-name-cell">
                        <span class="facility-item-icon ${getFacilityIconClass(item.name)}"></span>
                        <strong>${escapeText(item.name || '—')}</strong>
                        ${quantity}
                    </div>
                </td>
                <td>${escapeText(getFacilityCategory(item.name))}</td>
                <td><span class="facility-status-badge ${meta.cls}"><span></span>${escapeText(meta.label)}</span></td>
                <td>${formatDate(item.createdAt)}</td>
                <td>${escapeText(meta.note)}</td>
            </tr>`;
    }).join('');

    el.innerHTML = `
        <div class="facility-table-wrapper">
            <table class="data-table facilities-table">
                <thead>
                    <tr>
                        <th>Tên thiết bị</th>
                        <th>Loại thiết bị</th>
                        <th>Tình trạng</th>
                        <th>Ngày kiểm tra</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="facility-pagination">
            <div>
                <button type="button" disabled>‹</button>
                <button type="button" class="active">1</button>
                <button type="button" disabled>›</button>
            </div>
            <span>Hiển thị ${filtered.length} trên ${facilities.length} thiết bị</span>
        </div>`;
}

function formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getRepairRequestCode(request) {
    const d = new Date(request.createdAt);
    const stamp = isNaN(d)
        ? '000000'
        : `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `#REQ-${stamp}-${String(request.id || 0).padStart(3, '0')}`;
}

function getRepairRequestStatusMeta(status) {
    const normalized = String(status || '').trim();
    const map = {
        Pending: { label: 'Đã gửi', cls: 'is-pending' },
        Approved: { label: 'Đã duyệt', cls: 'is-approved' },
        Completed: { label: 'Đã hoàn thành', cls: 'is-completed' },
        Rejected: { label: 'Đã từ chối', cls: 'is-rejected' },
        Cancelled: { label: 'Đã hủy', cls: 'is-cancelled' }
    };
    return map[normalized] || { label: normalized || 'Chưa rõ', cls: 'is-muted' };
}

function renderRepairProgress(status) {
    const normalized = String(status || '').trim();
    const terminalMeta = {
        Rejected: { label: 'Đã từ chối', state: 'rejected' },
        Cancelled: { label: 'Đã hủy', state: 'cancelled' }
    };
    const steps = [
        { key: 'sent', label: 'Đã gửi' },
        { key: 'approved', label: terminalMeta[normalized]?.label || 'Đã duyệt' },
        { key: 'repairing', label: 'Đang sửa' },
        { key: 'done', label: 'Hoàn thành' }
    ];
    const doneMap = {
        Pending: ['sent'],
        Approved: ['sent', 'approved'],
        Completed: ['sent', 'approved', 'repairing', 'done'],
        Rejected: ['sent'],
        Cancelled: ['sent']
    };
    const activeMap = {
        Pending: 'sent',
        Approved: 'approved',
        Completed: 'done',
        Rejected: 'approved',
        Cancelled: 'approved'
    };
    const done = doneMap[normalized] || ['sent'];
    const active = activeMap[normalized] || 'sent';

    return `
        <div class="repair-progress">
            ${steps.map(step => {
                const state = terminalMeta[normalized] && step.key === 'approved'
                    ? terminalMeta[normalized].state
                    : done.includes(step.key)
                        ? 'done'
                        : step.key === active
                            ? 'active'
                            : 'muted';
                return `
                    <span class="repair-step ${state}">
                        <i></i>
                        <em>${step.label}</em>
                    </span>`;
            }).join('')}
        </div>`;
}

function renderRepairThumb(request) {
    const text = `${request.title || ''} ${request.description || ''}`;
    return `
        <div class="repair-thumb">
            <span class="facility-item-icon ${getFacilityIconClass(text)}"></span>
        </div>`;
}

function renderFacilityRepairHistory(requests = currentFacilityRepairHistory) {
    const el = document.getElementById('facilities-repair-history');
    if (!el) return;
    const source = requests.filter(item => item.requestType === 'Maintenance');
    const q = (document.getElementById('facility-history-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('facility-history-status')?.value || '';
    const maintenanceRequests = source.filter(item => {
        const matchesSearch = !q || [item.title, item.description, item.status, getRepairRequestCode(item)]
            .some(value => String(value || '').toLowerCase().includes(q));
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });

    if (!maintenanceRequests.length) {
        el.innerHTML = '<div class="empty-state facilities-empty">Chưa có lịch sử báo hỏng hoặc sửa chữa.</div>';
        return;
    }

    el.innerHTML = maintenanceRequests.map(item => `
        <article class="facility-repair-item ${getRepairRequestStatusMeta(item.status).cls}">
            <span class="repair-timeline-dot"></span>
            ${renderRepairThumb(item)}
            <div class="repair-content">
                <div class="repair-main">
                    <strong>${escapeText(item.title || 'Yêu cầu sửa chữa')}</strong>
                    <p>${escapeText(item.description || '')}</p>
                    <div class="repair-meta-line">
                        <span>${formatDate(item.createdAt)}</span>
                        <span>${formatTime(item.createdAt)}</span>
                        <span>${getRepairRequestCode(item)}</span>
                    </div>
                    ${item.resolutionNote ? `<span class="resolution-note">${escapeText(item.resolutionNote)}</span>` : ''}
                </div>
                <div class="repair-state">
                    <span class="repair-status ${getRepairRequestStatusMeta(item.status).cls}">${escapeText(getRepairRequestStatusMeta(item.status).label)}</span>
                    ${renderRepairProgress(item.status)}
                    ${item.status === 'Pending'
                        ? `<button type="button" class="repair-cancel-btn" data-cancel-repair-id="${item.id}">Hủy báo cáo</button>`
                        : ''}
                </div>
            </div>
        </article>`).join('');

    el.querySelectorAll('[data-cancel-repair-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = typeof showAppConfirm === 'function'
                ? await showAppConfirm({
                    title: 'Hủy báo cáo hỏng',
                    message: 'Báo cáo này sẽ chuyển sang trạng thái Đã hủy. Bạn chỉ nên hủy khi đã báo nhầm.',
                    confirmText: 'Hủy báo cáo',
                    cancelText: 'Giữ lại'
                })
                : confirm('Hủy báo cáo hỏng này?');

            if (!confirmed) return;

            btn.disabled = true;
            const res = await callApi(`/studentrequests/${btn.dataset.cancelRepairId}/cancel`, { method: 'PUT' });
            if (res?.ok) {
                showToast('Đã hủy báo cáo hỏng.');
                loadFacilitiesSection();
            } else {
                btn.disabled = false;
                showToast(res?.data?.message || 'Không thể hủy báo cáo.', true);
            }
        });
    });
}

function bindFacilityFilters() {
    const search = document.getElementById('facility-search');
    const status = document.getElementById('facility-status-filter');
    if (search) search.oninput = () => renderFacilitiesTable();
    if (status) status.onchange = () => renderFacilitiesTable();
}

function bindFacilityHistoryFilters() {
    const search = document.getElementById('facility-history-search');
    const status = document.getElementById('facility-history-status');
    if (search) search.oninput = () => renderFacilityRepairHistory();
    if (status) status.onchange = () => renderFacilityRepairHistory();
}

function bindFacilityUploadInput() {
    const input = document.getElementById('facility-report-image');
    const hint = document.getElementById('facility-upload-hint');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!hint) return;
        if (!file) {
            hint.textContent = 'Hỗ trợ: JPG, PNG (tối đa 5MB)';
            hint.classList.remove('is-error');
            return;
        }
        const sizeMb = file.size / (1024 * 1024);
        hint.textContent = `${file.name} (${sizeMb.toFixed(1)}MB)`;
        hint.classList.toggle('is-error', sizeMb > 5);
    });
}

function bindFacilityReportSubmit() {
    const btn = document.getElementById('facility-report-submit');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl = document.getElementById('facility-report-error');
        if (errEl) errEl.textContent = '';

        const deviceId = document.getElementById('facility-report-device')?.value;
        const title = document.getElementById('facility-report-title')?.value.trim();
        const desc = document.getElementById('facility-report-desc')?.value.trim();
        const image = document.getElementById('facility-report-image')?.files?.[0];
        const device = currentFacilities.find(item => String(item.id) === String(deviceId));

        if (!deviceId) { if (errEl) errEl.textContent = 'Vui lòng chọn thiết bị cần báo hỏng.'; return; }
        if (!title) { if (errEl) errEl.textContent = 'Vui lòng nhập tiêu đề báo hỏng.'; return; }
        if (!desc) { if (errEl) errEl.textContent = 'Vui lòng mô tả tình trạng thiết bị.'; return; }
        if (image && image.size > 5 * 1024 * 1024) {
            if (errEl) errEl.textContent = 'Ảnh minh họa không được vượt quá 5MB.';
            return;
        }

        btn.disabled = true;
        const res = await callApi('/studentrequests', {
            method: 'POST',
            body: JSON.stringify({
                requestType: 'Maintenance',
                title: `${device?.name ? `${device.name}: ` : ''}${title}`,
                description: desc
            })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Đã gửi báo hỏng thiết bị.');
            document.getElementById('facility-report-title').value = '';
            document.getElementById('facility-report-desc').value = '';
            const imageInput = document.getElementById('facility-report-image');
            if (imageInput) imageInput.value = '';
            const hint = document.getElementById('facility-upload-hint');
            if (hint) {
                hint.textContent = 'Hỗ trợ: JPG, PNG (tối đa 5MB)';
                hint.classList.remove('is-error');
            }
            document.querySelector('.facility-tab-btn[data-facility-panel="facility-history-panel"]')?.click();
            loadFacilitiesSection();
        } else if (errEl) {
            errEl.textContent = res?.data?.message || 'Gửi báo hỏng thất bại.';
        }
    });
}

async function loadFacilitiesSection() {
    setLoading('my-room-facilities', 'Đang tải danh sách thiết bị...');
    setLoading('facilities-repair-history', 'Đang tải lịch sử sửa chữa...');
    setFacilityStats([], []);

    const roomRes = await callApi('/room/my-room');
    currentFacilityRoom = roomRes?.ok ? roomRes.data : null;
    const subtitle = document.getElementById('facility-room-subtitle');

    if (!currentFacilityRoom?.id) {
        currentFacilities = [];
        currentFacilityRepairHistory = [];
        if (subtitle) subtitle.textContent = 'Bạn hiện chưa có phòng đang hoạt động.';
        setEmpty('my-room-facilities', 'Chưa có phòng đang hoạt động để xem cơ sở vật chất.');
        setEmpty('facilities-repair-history', 'Chưa có dữ liệu lịch sử sửa chữa.');
        renderFacilityDeviceOptions([]);
        return;
    }

    if (subtitle) subtitle.textContent = `Phòng ${currentFacilityRoom.roomCode || '—'} - ${currentFacilityRoom.buildingName || '—'}`;

    const [facilityRes, requestRes] = await Promise.all([
        callApi(`/facilities/room/${currentFacilityRoom.id}`),
        callApi('/studentrequests/my')
    ]);

    currentFacilities = Array.isArray(facilityRes?.data) ? facilityRes.data : [];
    currentFacilityRepairHistory = Array.isArray(requestRes?.data)
        ? requestRes.data.filter(item => item.requestType === 'Maintenance')
        : [];

    setFacilityStats(currentFacilities, currentFacilityRepairHistory);
    renderFacilityDeviceOptions(currentFacilities);
    renderFacilitiesTable(currentFacilities);
    renderFacilityRepairHistory(currentFacilityRepairHistory);
    bindFacilityFilters();
    bindFacilityHistoryFilters();
    bindFacilityUploadInput();
    bindFacilityReportSubmit();
}

// ======================================================================
