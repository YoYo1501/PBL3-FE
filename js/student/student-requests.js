// 11. YÊU CẦU – POST /api/studentrequests & GET /api/studentrequests/my
// ======================================================================
const reqTitleMap = {
    'Checkout':     { title: 'Yêu cầu trả phòng',    desc: 'Gửi yêu cầu trả phòng khi muốn chấm dứt hợp đồng sớm.' },
    'RoomTransfer': { title: 'Yêu cầu chuyển phòng', desc: 'Chọn phòng muốn chuyển đến và gửi yêu cầu. Admin sẽ xét duyệt.' },
    'Other':        { title: 'Yêu cầu khác',          desc: 'Gửi các yêu cầu khác tới ban quản lý ký túc xá.' },
};

function loadRequestSection(reqType) {
    currentReqType = reqType || 'Other';
    requestStatusFilter = '';
    const info = reqTitleMap[currentReqType] || reqTitleMap['Other'];

    const titleEl       = document.getElementById('request-section-title');
    const descEl        = document.getElementById('request-section-desc');
    const formCard      = document.getElementById('request-form-card');
    const requestWorkspace = document.getElementById('request-workspace');
    const transferTmpl  = document.getElementById('transfer-form-template');
    const sectionEl     = document.getElementById('section-request');
    if (sectionEl) sectionEl.classList.toggle('is-transfer-mode', currentReqType === 'RoomTransfer');
    if (sectionEl) sectionEl.classList.toggle('is-checkout-mode', currentReqType === 'Checkout');

    if (titleEl) titleEl.textContent = info.title;
    if (descEl)  descEl.textContent  = info.desc;
    updateRequestCopy();

    if (currentReqType === 'RoomTransfer') {
        // Ẩn form yêu cầu thông thường
        if (formCard) formCard.style.display = 'none';
        if (requestWorkspace) requestWorkspace.style.display = 'none';

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
        document.getElementById('my-requests-list')?.closest('.content-card')?.style.setProperty('display', 'none');
        bindTransferReasonCounter();
        loadTransferHistory();
        loadTransferRooms();
    } else {
        // Hiện form yêu cầu thông thường
        if (formCard) formCard.style.display = '';
        if (requestWorkspace) requestWorkspace.style.display = '';
        // Ẩn form chuyển phòng nếu đang hiện
        const injected = document.getElementById('transfer-form-injected');
        if (injected) injected.style.display = 'none';
        // Hiện lại danh sách yêu cầu
        const listCard = document.getElementById('my-requests-list')?.closest('.content-card');
        if (listCard) listCard.style.removeProperty('display');
        const statusFilter = document.getElementById('request-status-filter');
        if (statusFilter) statusFilter.value = '';
        document.getElementById('request-status-filter')?.closest('.request-history-head')?.style.removeProperty('display');
        bindRequestCounters();
        bindRequestFilters();
        bindCheckoutFileInput();

        // Bind nút submit (chỉ 1 lần)
        bindRequestSubmit();
        // Load danh sách yêu cầu
        loadMyRequests();
    }
}

function updateRequestCopy() {
    const isCheckout = currentReqType === 'Checkout';
    const formTitle = document.getElementById('request-form-title');
    const historyTitle = document.getElementById('request-history-title');
    const submitText = document.querySelector('#req-submit-btn span:last-child');
    const titleInput = document.getElementById('req-title');
    const descInput = document.getElementById('req-desc');

    if (formTitle) formTitle.textContent = isCheckout ? 'TẠO YÊU CẦU TRẢ PHÒNG' : 'TẠO YÊU CẦU MỚI';
    if (historyTitle) historyTitle.textContent = isCheckout ? 'LỊCH SỬ YÊU CẦU TRẢ PHÒNG' : 'LỊCH SỬ YÊU CẦU';
    if (submitText) submitText.textContent = isCheckout ? 'Gửi yêu cầu trả phòng' : 'Gửi yêu cầu';
    if (titleInput && isCheckout) titleInput.value = 'Yêu cầu trả phòng';
    if (descInput) {
        descInput.placeholder = isCheckout ? 'Nhập nội dung chi tiết...' : 'Nhập nội dung yêu cầu...';
    }
}

function bindRequestCounters() {
    const titleInput = document.getElementById('req-title');
    const descInput = document.getElementById('req-desc');
    const titleCounter = document.getElementById('req-title-counter');
    const descCounter = document.getElementById('req-desc-counter');

    if (titleInput && !titleInput._counterBound) {
        titleInput._counterBound = true;
        titleInput.addEventListener('input', () => {
            if (titleCounter) titleCounter.textContent = `${titleInput.value.length}/100`;
        });
    }
    if (descInput && !descInput._counterBound) {
        descInput._counterBound = true;
        descInput.addEventListener('input', () => {
            if (descCounter) descCounter.textContent = `${descInput.value.length}/500`;
        });
    }

    if (titleCounter && titleInput) titleCounter.textContent = `${titleInput.value.length}/100`;
    if (descCounter && descInput) descCounter.textContent = `${descInput.value.length}/500`;
}

function bindCheckoutFileInput() {
    const input = document.getElementById('checkout-file');
    const nameEl = document.getElementById('checkout-file-name');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (nameEl) nameEl.textContent = file ? file.name : 'Định dạng: JPG, PNG, PDF (Tối đa 5MB)';
    });
}

function bindRequestFilters() {
    const statusFilter = document.getElementById('request-status-filter');
    if (!statusFilter || statusFilter._bound) return;
    statusFilter._bound = true;
    statusFilter.addEventListener('change', () => {
        requestStatusFilter = statusFilter.value || '';
        loadMyRequests();
    });
}

function bindRequestSubmit() {
    const btn = document.getElementById('req-submit-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl = document.getElementById('req-error');
        errEl.textContent = '';
        const isCheckout = currentReqType === 'Checkout';
        let title = document.getElementById('req-title')?.value.trim() || '';
        let desc  = document.getElementById('req-desc')?.value.trim() || '';

        if (isCheckout) {
            const checkoutDate = document.getElementById('checkout-date')?.value || '';
            const checkoutReason = document.getElementById('checkout-reason')?.value || '';
            const checkoutFile = document.getElementById('checkout-file')?.files?.[0];

            if (!checkoutDate) { errEl.textContent = 'Vui lòng chọn ngày dự kiến trả phòng.'; return; }
            if (!checkoutReason) { errEl.textContent = 'Vui lòng chọn lý do trả phòng.'; return; }
            if (checkoutFile && checkoutFile.size > 5 * 1024 * 1024) {
                errEl.textContent = 'Tệp đính kèm không được vượt quá 5MB.';
                return;
            }

            title = `Yêu cầu trả phòng ngày ${formatDate(checkoutDate)}`;
            desc = [
                `Ngày dự kiến trả phòng: ${formatDate(checkoutDate)}`,
                `Lý do trả phòng: ${checkoutReason}`,
                desc ? `Nội dung chi tiết: ${desc}` : '',
                checkoutFile ? `Đính kèm minh chứng: ${checkoutFile.name}` : ''
            ].filter(Boolean).join('\n');
        } else {
            if (!title) { errEl.textContent = 'Vui lòng nhập tiêu đề yêu cầu.'; return; }
            if (!desc)  { errEl.textContent = 'Vui lòng nhập nội dung yêu cầu.'; return; }
        }

        btn.disabled = true;
        const res = await callApi('/studentrequests', {
            method: 'POST',
            body: JSON.stringify({ requestType: currentReqType, title, description: desc })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Gửi yêu cầu thành công!');
            if (document.getElementById('req-title')) document.getElementById('req-title').value = isCheckout ? 'Yêu cầu trả phòng' : '';
            if (document.getElementById('req-desc')) document.getElementById('req-desc').value = '';
            if (document.getElementById('checkout-date')) document.getElementById('checkout-date').value = '';
            if (document.getElementById('checkout-reason')) document.getElementById('checkout-reason').value = '';
            if (document.getElementById('checkout-file')) document.getElementById('checkout-file').value = '';
            const fileName = document.getElementById('checkout-file-name');
            if (fileName) fileName.textContent = 'Định dạng: JPG, PNG, PDF (Tối đa 5MB)';
            bindRequestCounters();
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
        updateRequestStats([]);
        updateRequestHistoryFooter(0, 0);
        listEl.innerHTML = '<div class="empty-state">Chưa có yêu cầu nào.</div>';
        return;
    }

    // Lọc theo loại đang xem
    const typeFiltered = res.data.filter(r => r.requestType === currentReqType);
    updateRequestStats(typeFiltered);

    let filtered = typeFiltered;
    if (requestStatusFilter) {
        filtered = filtered.filter(r => String(r.status || '') === requestStatusFilter);
    }
    if (!filtered.length) {
        updateRequestHistoryFooter(0, typeFiltered.length);
        listEl.innerHTML = `<div class="empty-state">Chưa có yêu cầu "${reqTitleMap[currentReqType]?.title}" nào.</div>`;
        return;
    }

    updateRequestHistoryFooter(filtered.length, typeFiltered.length);
    listEl.innerHTML = filtered.map(renderRequestHistoryItem).join('');

    listEl.querySelectorAll('[data-req-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Xác nhận hủy yêu cầu này?')) return;
            const res2 = await callApi(`/studentrequests/${btn.dataset.reqId}/cancel`, { method: 'PUT' });
            if (res2?.ok) { showToast('Đã hủy yêu cầu.'); loadMyRequests(); }
            else showToast(res2?.data?.message || 'Không thể hủy.', true);
        });
    });

    listEl.querySelectorAll('[data-request-detail]').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = filtered.find(r => String(r.id) === String(btn.dataset.requestDetail));
            if (!item) return;
            const detail = [
                item.title || 'Yêu cầu',
                `Trạng thái: ${getRequestStatusLabel(item.status)}`,
                `Ngày gửi: ${formatDate(item.createdAt)}${formatRequestTime(item.createdAt) ? ` - ${formatRequestTime(item.createdAt)}` : ''}`,
                '',
                item.description || '',
                item.resolutionNote ? `\nPhản hồi: ${item.resolutionNote}` : ''
            ].join('\n');
            alert(detail);
        });
    });
}

function renderRequestHistoryItem(r) {
    const status = String(r.status || '');
    const safeTitle = escapeText(r.title || 'Yêu cầu');
    const safeDesc = escapeText(r.description || '').replace(/\n/g, '<br>');
    const safeNote = r.resolutionNote ? escapeText(r.resolutionNote) : '';
    const time = formatRequestTime(r.createdAt);

    return `
        <article class="request-timeline-item status-${status.toLowerCase()}">
            <span class="request-timeline-dot"></span>
            <span class="request-row-icon"></span>
            <div class="request-row-body">
                <div class="request-row-main">
                    <strong>${safeTitle}</strong>
                    <p>Ngày dự kiến: ${extractCheckoutDate(r.description) || '—'}</p>
                    <span>Gửi ngày: ${formatDate(r.createdAt)}${time ? ` • ${time}` : ''}</span>
                    ${safeDesc ? `<p class="request-item-desc">${safeDesc}</p>` : ''}
                    ${safeNote ? `<span class="resolution-note">${safeNote}</span>` : ''}
                </div>
                <div class="request-row-actions">
                    ${renderRequestStatusPill(status)}
                    <button type="button" class="request-detail-btn" data-request-detail="${r.id}">Xem chi tiết</button>
                    ${status === 'Pending'
                        ? `<button type="button" class="request-cancel-btn" data-req-id="${r.id}">Hủy</button>`
                        : ''}
                </div>
            </div>
        </article>`;
}

function updateRequestStats(items) {
    const counts = items.reduce((acc, item) => {
        const status = String(item.status || '');
        acc.total += 1;
        if (status === 'Pending') acc.pending += 1;
        if (status === 'Approved' || status === 'Completed') acc.approved += 1;
        if (status === 'Rejected') acc.rejected += 1;
        return acc;
    }, { total: 0, pending: 0, approved: 0, rejected: 0 });

    setRequestStat('request-stat-total', counts.total);
    setRequestStat('request-stat-pending', counts.pending);
    setRequestStat('request-stat-approved', counts.approved);
    setRequestStat('request-stat-rejected', counts.rejected);
}

function setRequestStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value).padStart(2, '0');
}

function updateRequestHistoryFooter(shown, total) {
    const footer = document.getElementById('request-history-footer');
    const label = document.getElementById('request-history-count');
    if (!footer || !label) return;
    footer.style.display = total ? 'flex' : 'none';
    label.textContent = shown
        ? `Hiển thị 1 đến ${shown} trong tổng số ${total} yêu cầu`
        : `Không có yêu cầu phù hợp trong tổng số ${total} yêu cầu`;
}

function renderRequestStatusPill(status) {
    const label = getRequestStatusLabel(status);
    const cls = {
        Pending: 'request-pill-pending',
        Approved: 'request-pill-approved',
        Completed: 'request-pill-approved',
        Rejected: 'request-pill-rejected',
        Cancelled: 'request-pill-cancelled'
    }[status] || 'request-pill-cancelled';
    return `<span class="request-status-pill ${cls}">${label}</span>`;
}

function getRequestStatusLabel(status) {
    return {
        Pending: 'Đang chờ duyệt',
        Approved: 'Đã duyệt',
        Completed: 'Đã duyệt',
        Rejected: 'Đã từ chối',
        Cancelled: 'Đã hủy'
    }[status] || status || 'Không rõ';
}

function formatRequestTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function extractCheckoutDate(description) {
    const match = String(description || '').match(/Ngày dự kiến trả phòng:\s*([^\n]+)/i);
    return match?.[1] || '';
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
        updateTransferRoomStats([]);
        updateTransferRoomCount(0);
        listEl.innerHTML = `<div class="empty-state">Không có phòng nào khả dụng để chuyển.</div>`;
        bindTransferReasonCounter();
        return;
    }

    transferRooms = res.data.rooms;
    updateTransferRoomStats(transferRooms);
    renderTransferRooms(transferRooms);
    bindTransferReasonCounter();

    // Search
    const searchInput = document.getElementById('transfer-search');
    if (searchInput && !searchInput._bound) searchInput.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = transferRooms.filter(r =>
            (r.roomCode || '').toLowerCase().includes(q) ||
            (r.buildingName || '').toLowerCase().includes(q) ||
            (r.buildingCode || '').toLowerCase().includes(q)
        );
        renderTransferRooms(filtered);
        updateTransferRoomCount(filtered.length);
    });
    if (searchInput) searchInput._bound = true;

    // Submit
    bindTransferSubmit();
}

function updateTransferRoomStats(rooms) {
    const totalSlots = rooms.reduce((sum, room) => sum + Number(room.availableSlots || 0), 0);
    setRequestStat('transfer-stat-available', rooms.length);
    setRequestStat('transfer-stat-slots', totalSlots);
}

function updateTransferRoomCount(count) {
    const el = document.getElementById('transfer-room-count');
    if (el) el.textContent = `${count} phòng phù hợp`;
}

function bindTransferReasonCounter() {
    const reasonEl = document.getElementById('transfer-reason');
    const counterEl = document.getElementById('transfer-reason-counter');
    if (!reasonEl || !counterEl) return;
    if (!reasonEl._counterBound) {
        reasonEl._counterBound = true;
        reasonEl.addEventListener('input', () => {
            counterEl.textContent = `${reasonEl.value.length}/500`;
        });
    }
    counterEl.textContent = `${reasonEl.value.length}/500`;
}

function renderTransferRooms(rooms) {
    const listEl = document.getElementById('transfer-room-list');
    if (!listEl) return;
    updateTransferRoomCount(rooms.length);

    if (!rooms.length) {
        listEl.innerHTML = '<div class="empty-state">Không tìm thấy phòng phù hợp.</div>';
        return;
    }

    listEl.innerHTML = rooms.map(r => `
        <article class="room-item transfer-room-item" data-room-id="${r.id}" data-room-code="${escapeText(r.roomCode || '')}">
            <div class="transfer-room-top">
                <span class="transfer-room-icon"></span>
                <div>
                    <strong>${escapeText(r.roomCode || '—')}</strong>
                    <span>${escapeText(r.buildingName || r.buildingCode || 'Ký túc xá')}</span>
                </div>
                <em>${escapeText(r.availableSlots ?? '0')} chỗ</em>
            </div>
            <div class="transfer-room-meta">
                <span>${escapeText(r.roomType || '—')}</span>
                <span>${escapeText(r.genderAllowed || '—')}</span>
                <span>${escapeText(r.currentOccupancy ?? '0')}/${escapeText(r.capacity ?? '0')} người</span>
            </div>
        </article>`).join('');

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
            const selText = document.getElementById('transfer-selected-display-text');
            if (selInfo) selInfo.style.display = 'block';
            if (selDisp) selDisp.value = selectedCode;
            if (selId)   selId.value   = selectedId;
            if (selText) selText.textContent = selectedCode;
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
        if (reason.length < 15) { errEl.textContent = 'Lý do cần ít nhất 15 ký tự.'; return; }

        btn.disabled = true;
        // Buoc 1: Hold truoc 10 phut de tranh race condition
        const holdRes = await callApi('/roomtransfers/hold', {
            method: 'POST',
            body: JSON.stringify({ toRoomId })
        });
        if (!holdRes?.ok) {
            errEl.textContent = holdRes?.data?.message || 'Giữ chỗ phòng thất bại, vui lòng thử lại.';
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
            bindTransferReasonCounter();
            document.getElementById('transfer-selected-info').style.display = 'none';
            document.getElementById('transfer-selected-id').value = '';
            document.getElementById('transfer-selected-display').value = '';
            const selectedText = document.getElementById('transfer-selected-display-text');
            if (selectedText) selectedText.textContent = '—';
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
    const histEl = document.getElementById('transfer-history-list');
    if (!histEl) return;
    histEl.innerHTML = '<div class="loading-state">Đang tải...</div>';

    const res = await callApi('/roomtransfers/my');
    if (!res?.ok || !Array.isArray(res.data) || !res.data.length) {
        updateTransferHistoryStats([]);
        histEl.innerHTML = '<div class="empty-state">Chưa có yêu cầu chuyển phòng nào.</div>';
        return;
    }

    updateTransferHistoryStats(res.data);
    histEl.innerHTML = res.data.map(t => `
        <article class="transfer-history-item status-${String(t.status || '').toLowerCase()}">
            <span class="transfer-history-icon"></span>
            <div class="transfer-history-body">
                <div>
                    <strong>${escapeText(t.fromRoomCode || 'Phòng hiện tại')} → ${escapeText(t.toRoomCode || t.toRoomId || 'Phòng mới')}</strong>
                    <p>${escapeText(t.reason || '—')}</p>
                    <span>Ngày gửi: ${formatDate(t.requestedAt || t.createdAt)}${formatRequestTime(t.requestedAt || t.createdAt) ? ` • ${formatRequestTime(t.requestedAt || t.createdAt)}` : ''}</span>
                    ${t.resolvedAt ? `<span>Ngày duyệt: ${formatDate(t.resolvedAt)}</span>` : ''}
                    ${t.rejectionReason ? `<em>${escapeText(t.rejectionReason)}</em>` : ''}
                </div>
                <div class="transfer-history-actions">
                    ${renderRequestStatusPill(t.status)}
                    ${t.status === 'Pending'
                        ? `<button type="button" class="request-cancel-btn" data-cancel-transfer-id="${t.id}">Hủy yêu cầu</button>`
                        : ''}
                </div>
            </div>
        </article>`).join('');

    // Xử lý nút hủy yêu cầu chuyển phòng
    histEl.querySelectorAll('[data-cancel-transfer-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Xác nhận hủy yêu cầu chuyển phòng này?')) return;
            const res2 = await callApi(`/roomtransfers/${btn.dataset.cancelTransferId}/cancel`, { method: 'DELETE' });
            if (res2?.ok) {
                showToast('Đã hủy yêu cầu chuyển phòng.');
                loadTransferHistory();
            } else {
                showToast(res2?.data?.message || 'Không thể hủy yêu cầu.', true);
            }
        });
    });
}

function updateTransferHistoryStats(items) {
    const totalEl = document.getElementById('transfer-history-count');
    if (totalEl) totalEl.textContent = `${items.length} yêu cầu`;
    const pending = items.filter(item => item.status === 'Pending').length;
    const approved = items.filter(item => item.status === 'Approved' || item.status === 'Completed').length;
    setRequestStat('transfer-stat-pending', pending);
    setRequestStat('transfer-stat-approved', approved);
}

// ======================================================================
