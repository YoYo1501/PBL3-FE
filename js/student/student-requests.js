// 11. YÊU CẦU – POST /api/studentrequests & GET /api/studentrequests/my
// ======================================================================
const reqTitleMap = {
    'Checkout':     { title: 'Yêu cầu trả phòng',    desc: 'Gửi yêu cầu trả phòng khi bạn muốn chấm dứt hợp đồng và rời khỏi ký túc xá.' },
    'RoomTransfer': { title: 'Yêu cầu chuyển phòng', desc: 'Chọn phòng muốn chuyển đến và gửi yêu cầu. Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.' },
    'Other':        { title: 'Yêu cầu khác',          desc: 'Gửi các yêu cầu khác tới ban quản lý ký túc xá.' },
};

function loadRequestSection(reqType) {
    currentReqType = reqType || 'Other';
    requestStatusFilter = '';
    transferStatusFilter = '';
    const info = reqTitleMap[currentReqType] || reqTitleMap['Other'];

    const titleEl       = document.getElementById('request-section-title');
    const descEl        = document.getElementById('request-section-desc');
    const formCard      = document.getElementById('request-form-card');
    const requestWorkspace = document.getElementById('request-workspace');
    const transferTmpl  = document.getElementById('transfer-form-template');
    const sectionEl     = document.getElementById('section-request');
    if (sectionEl) sectionEl.classList.toggle('is-transfer-mode', currentReqType === 'RoomTransfer');
    if (sectionEl) sectionEl.classList.toggle('is-checkout-mode', currentReqType === 'Checkout');
    if (sectionEl) sectionEl.classList.toggle('is-other-mode', currentReqType === 'Other');
    document.body?.classList.toggle('is-transfer-request-page', currentReqType === 'RoomTransfer');

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
        bindTransferFileInput();
        bindTransferFilters();
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
    const descLabel = document.getElementById('req-desc-label');
    const uploadTitle = document.getElementById('request-upload-title');
    const fileName = document.getElementById('checkout-file-name');
    const fileInput = document.getElementById('checkout-file');

    if (formTitle) formTitle.textContent = isCheckout ? 'TẠO YÊU CẦU TRẢ PHÒNG' : 'TẠO YÊU CẦU MỚI';
    if (historyTitle) historyTitle.textContent = isCheckout ? 'LỊCH SỬ YÊU CẦU TRẢ PHÒNG' : 'LỊCH SỬ YÊU CẦU';
    if (submitText) submitText.textContent = isCheckout ? 'Gửi yêu cầu trả phòng' : 'Gửi yêu cầu';
    if (titleInput) {
        titleInput.maxLength = 100;
        titleInput.placeholder = isCheckout ? 'Yêu cầu trả phòng' : 'Nhập tiêu đề yêu cầu ngắn gọn, rõ ràng...';
        if (isCheckout) titleInput.value = 'Yêu cầu trả phòng';
        else if (titleInput.value === 'Yêu cầu trả phòng') titleInput.value = '';
    }
    if (descInput) {
        descInput.maxLength = isCheckout ? 500 : 1000;
        descInput.placeholder = isCheckout ? 'Nhập nội dung chi tiết...' : 'Nhập nội dung chi tiết yêu cầu của bạn...';
    }
    if (descLabel) {
        descLabel.innerHTML = isCheckout
            ? 'Nội dung chi tiết <em class="checkout-optional">(nếu có)</em>'
            : 'Nội dung chi tiết <span>*</span>';
    }
    if (uploadTitle) {
        uploadTitle.innerHTML = isCheckout
            ? 'Đính kèm minh chứng <em>(nếu có)</em>'
            : 'Đính kèm tệp (nếu có)';
    }
    if (fileName && !fileInput?.files?.length) {
        fileName.textContent = getRequestFileHint(isCheckout);
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
            if (titleCounter) titleCounter.textContent = `${titleInput.value.length}/${titleInput.maxLength || 100}`;
        });
    }
    if (descInput && !descInput._counterBound) {
        descInput._counterBound = true;
        descInput.addEventListener('input', () => {
            if (descCounter) descCounter.textContent = `${descInput.value.length}/${descInput.maxLength || 1000}`;
        });
    }

    if (titleCounter && titleInput) titleCounter.textContent = `${titleInput.value.length}/${titleInput.maxLength || 100}`;
    if (descCounter && descInput) descCounter.textContent = `${descInput.value.length}/${descInput.maxLength || 1000}`;
}

function getRequestFileHint(isCheckout = currentReqType === 'Checkout') {
    return isCheckout
        ? 'Định dạng: JPG, PNG, PDF (Tối đa 5MB)'
        : 'Định dạng: PDF, JPG, PNG (Tối đa 5MB)';
}

function bindCheckoutFileInput() {
    const input = document.getElementById('checkout-file');
    const nameEl = document.getElementById('checkout-file-name');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (nameEl) nameEl.textContent = file ? file.name : getRequestFileHint();
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
        const requestFile = document.getElementById('checkout-file')?.files?.[0];

        if (isCheckout) {
            const checkoutDate = document.getElementById('checkout-date')?.value || '';
            const checkoutReason = document.getElementById('checkout-reason')?.value || '';

            if (!checkoutDate) { errEl.textContent = 'Vui lòng chọn ngày dự kiến trả phòng.'; return; }
            if (!checkoutReason) { errEl.textContent = 'Vui lòng chọn lý do trả phòng.'; return; }
            if (requestFile && requestFile.size > 5 * 1024 * 1024) {
                errEl.textContent = 'Tệp đính kèm không được vượt quá 5MB.';
                return;
            }

            title = `Yêu cầu trả phòng ngày ${formatDate(checkoutDate)}`;
            desc = [
                `Ngày dự kiến trả phòng: ${formatDate(checkoutDate)}`,
                `Lý do trả phòng: ${checkoutReason}`,
                desc ? `Nội dung chi tiết: ${desc}` : '',
                requestFile ? `Đính kèm minh chứng: ${requestFile.name}` : ''
            ].filter(Boolean).join('\n');
        } else {
            if (!title) { errEl.textContent = 'Vui lòng nhập tiêu đề yêu cầu.'; return; }
            if (!desc)  { errEl.textContent = 'Vui lòng nhập nội dung yêu cầu.'; return; }
            if (requestFile && requestFile.size > 5 * 1024 * 1024) {
                errEl.textContent = 'Tệp đính kèm không được vượt quá 5MB.';
                return;
            }
            if (requestFile) {
                desc = `${desc}\nĐính kèm tệp: ${requestFile.name}`;
            }
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
            if (fileName) fileName.textContent = getRequestFileHint(isCheckout);
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
    if (currentReqType === 'Checkout') return renderCheckoutHistoryItem(r);
    if (currentReqType === 'Other') return renderOtherHistoryItem(r);

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

function renderCheckoutHistoryItem(r) {
    const status = String(r.status || '');
    const time = formatRequestTime(r.createdAt);
    const checkoutDate = extractCheckoutDate(r.description) || '—';
    const code = getCheckoutRequestCode(r);

    return `
        <article class="request-timeline-item checkout-history-item status-${status.toLowerCase()}">
            <span class="request-timeline-dot"></span>
            <span class="request-row-icon"></span>
            <div class="request-row-body">
                <div class="request-row-main">
                    <strong>${escapeText(code)}</strong>
                    <p>Ngày dự kiến: ${escapeText(checkoutDate)}</p>
                    <span>Gửi ngày: ${escapeText(formatDate(r.createdAt))}${time ? ` <b>•</b> ${escapeText(time)}` : ''}</span>
                </div>
                <div class="request-row-actions">
                    ${renderRequestStatusPill(status)}
                    <button type="button" class="request-detail-btn" data-request-detail="${r.id}">Xem chi tiết</button>
                </div>
            </div>
        </article>`;
}

function renderOtherHistoryItem(r) {
    const status = String(r.status || '');
    const time = formatRequestTime(r.createdAt);
    const safeTitle = escapeText(r.title || 'Yêu cầu');
    const safeNote = r.resolutionNote ? escapeText(r.resolutionNote) : '';

    return `
        <article class="other-request-card status-${status.toLowerCase()}">
            <span class="other-request-icon"></span>
            <div class="other-request-main">
                <strong>${safeTitle}</strong>
                <p>Mã yêu cầu: <b>${escapeText(getOtherRequestCode(r))}</b></p>
                <span>Gửi ngày: ${escapeText(formatDate(r.createdAt))}${time ? ` <b>•</b> ${escapeText(time)}` : ''}</span>
                ${safeNote ? `<em class="resolution-note">${safeNote}</em>` : ''}
            </div>
            <div class="other-request-actions">
                ${renderOtherStatusPill(status)}
                <button type="button" class="other-request-detail-btn" data-request-detail="${r.id}" aria-label="Xem chi tiết yêu cầu">›</button>
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

function renderOtherStatusPill(status) {
    const cls = {
        Pending: 'request-pill-processing',
        Approved: 'request-pill-done',
        Completed: 'request-pill-done',
        Rejected: 'request-pill-closed',
        Cancelled: 'request-pill-closed'
    }[status] || 'request-pill-closed';
    return `<span class="request-status-pill ${cls}">${getOtherRequestStatusLabel(status)}</span>`;
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

function getOtherRequestStatusLabel(status) {
    return {
        Pending: 'Đang xử lý',
        Approved: 'Đã hoàn thành',
        Completed: 'Đã hoàn thành',
        Rejected: 'Đã đóng',
        Cancelled: 'Đã đóng'
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

function getCheckoutRequestCode(item) {
    const id = Number(item?.id || 0);
    const created = new Date(item?.createdAt);
    const year = isNaN(created) ? new Date().getFullYear() : created.getFullYear();
    return `#CHECKOUT-${year}-${String(id).padStart(4, '0')}`;
}

function getOtherRequestCode(item) {
    const id = Number(item?.id || 0);
    const created = new Date(item?.createdAt);
    const year = isNaN(created) ? new Date().getFullYear() : created.getFullYear();
    return `#REQ-${year}-${String(id).padStart(4, '0')}`;
}

// ======================================================================
// 12. CHUYỂN PHÒNG – GET /api/roomtransfers/available & POST
// ======================================================================
async function loadTransferRooms() {
    const listEl = document.getElementById('transfer-room-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-state">Đang tải danh sách phòng khả dụng...</div>';

    const res = await callApi('/roomtransfers/available');
    if (!res?.ok) {
        updateTransferRoomCount(0);
        listEl.innerHTML = `<div class="empty-state">${escapeText(res?.data?.message || 'Không thể tải danh sách phòng khả dụng.')}</div>`;
        bindTransferReasonCounter();
        return;
    }

    const rooms = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.rooms) ? res.data.rooms : []);
    if (!rooms.length) {
        updateTransferRoomCount(0);
        listEl.innerHTML = `<div class="empty-state">Không có phòng nào khả dụng để chuyển.</div>`;
        bindTransferReasonCounter();
        return;
    }

    transferRooms = rooms;
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

function bindTransferFileInput() {
    const input = document.getElementById('transfer-file');
    const nameEl = document.getElementById('transfer-file-name');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (nameEl) nameEl.textContent = file ? file.name : 'Định dạng: JPG, PNG, PDF (Tối đa 5MB)';
    });
}

function bindTransferFilters() {
    const filter = document.getElementById('transfer-status-filter');
    if (!filter) return;
    filter.value = transferStatusFilter || '';
    if (filter._bound) return;
    filter._bound = true;
    filter.addEventListener('change', () => {
        transferStatusFilter = filter.value || '';
        loadTransferHistory();
    });
}

function renderTransferRooms(rooms) {
    const listEl = document.getElementById('transfer-room-list');
    if (!listEl) return;
    updateTransferRoomCount(rooms.length);

    if (!rooms.length) {
        listEl.innerHTML = '<div class="empty-state">Không tìm thấy phòng phù hợp.</div>';
        return;
    }

    listEl.innerHTML = rooms.map(r => {
        const availableSlots = Number(r.availableSlots ?? Math.max(Number(r.capacity || 0) - Number(r.currentOccupancy || 0), 0));
        const genderLabel = normalizeTransferGender(r.genderAllowed);
        return `
        <article class="room-item transfer-room-item" data-room-id="${r.id}" data-room-code="${escapeText(r.roomCode || '')}">
            <div class="transfer-room-top">
                <span class="transfer-room-icon"></span>
                <div>
                    <strong>${escapeText(r.roomCode || '—')}</strong>
                    <span>${escapeText(formatTransferRoomLocation(r))}</span>
                    <span>${escapeText(r.capacity ?? '0')} người • Còn ${escapeText(availableSlots)} chỗ</span>
                </div>
            </div>
            <div class="transfer-room-meta">
                <span class="transfer-gender-badge ${genderLabel.cls}">${escapeText(genderLabel.label)}</span>
                <span class="transfer-room-radio"></span>
            </div>
        </article>`;
    }).join('');

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

function formatTransferRoomLocation(room) {
    const building = room.buildingCode || room.buildingName || 'Tòa nhà';
    const floor = room.floor ? `Tầng ${room.floor}` : '';
    return [building, floor].filter(Boolean).join(' • ');
}

function normalizeTransferGender(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('female') || raw.includes('nữ') || raw.includes('nu')) {
        return { label: 'Nữ', cls: 'is-female' };
    }
    if (raw.includes('male') || raw.includes('nam')) {
        return { label: 'Nam', cls: 'is-male' };
    }
    return { label: 'Chung', cls: 'is-any' };
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
        const proofFile = document.getElementById('transfer-file')?.files?.[0];

        if (!toRoomId)  { errEl.textContent = 'Vui lòng chọn phòng muốn chuyển đến.'; return; }
        if (!reason)    { errEl.textContent = 'Vui lòng nhập lý do chuyển phòng.'; return; }
        if (reason.length < 15) { errEl.textContent = 'Lý do cần ít nhất 15 ký tự.'; return; }
        if (proofFile && proofFile.size > 5 * 1024 * 1024) {
            errEl.textContent = 'Tệp minh chứng không được vượt quá 5MB.';
            return;
        }

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
            if (document.getElementById('transfer-file')) document.getElementById('transfer-file').value = '';
            const fileName = document.getElementById('transfer-file-name');
            if (fileName) fileName.textContent = 'Định dạng: JPG, PNG, PDF (Tối đa 5MB)';
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
        updateTransferHistoryFooter(0, 0);
        return;
    }

    const allItems = [...res.data].sort((a, b) =>
        new Date(b.requestedAt || b.createdAt || 0) - new Date(a.requestedAt || a.createdAt || 0)
    );
    updateTransferHistoryStats(allItems);

    const filtered = transferStatusFilter
        ? allItems.filter(t => String(t.status || '') === transferStatusFilter)
        : allItems;

    if (!filtered.length) {
        histEl.innerHTML = '<div class="empty-state">Không có yêu cầu phù hợp với bộ lọc.</div>';
        updateTransferHistoryFooter(0, allItems.length);
        return;
    }

    const visibleItems = filtered.slice(0, 4);
    histEl.innerHTML = visibleItems.map(renderTransferHistoryItem).join('');
    updateTransferHistoryFooter(visibleItems.length, filtered.length);

    histEl.querySelectorAll('[data-transfer-detail]').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = filtered.find(t => String(t.id) === String(btn.dataset.transferDetail));
            if (!item) return;
            const detail = [
                getTransferRequestCode(item),
                `Trạng thái: ${getRequestStatusLabel(item.status)}`,
                `Từ: ${item.fromRoomCode || 'Phòng hiện tại'} -> Đến: ${item.toRoomCode || item.toRoomId || 'Phòng mới'}`,
                `Gửi ngày: ${formatDate(item.requestedAt || item.createdAt)}${formatRequestTime(item.requestedAt || item.createdAt) ? ` - ${formatRequestTime(item.requestedAt || item.createdAt)}` : ''}`,
                '',
                item.reason || '',
                item.rejectionReason ? `\nLý do từ chối: ${item.rejectionReason}` : ''
            ].join('\n');
            alert(detail);
        });
    });
}

function updateTransferHistoryStats(items) {
    setRequestStat('transfer-stat-total', items.length);
    const pending = items.filter(item => item.status === 'Pending').length;
    const approved = items.filter(item => item.status === 'Approved' || item.status === 'Completed').length;
    const rejected = items.filter(item => item.status === 'Rejected').length;
    setRequestStat('transfer-stat-pending', pending);
    setRequestStat('transfer-stat-approved', approved);
    setRequestStat('transfer-stat-rejected', rejected);
}

function renderTransferHistoryItem(t) {
    const status = String(t.status || '');
    const sentDate = t.requestedAt || t.createdAt;
    const time = formatRequestTime(sentDate);
    const fromRoom = t.fromRoomCode || 'A101';
    const toRoom = t.toRoomCode || t.toRoomId || 'Phòng mới';

    return `
        <article class="transfer-history-item status-${status.toLowerCase()}">
            <span class="transfer-timeline-dot"></span>
            <span class="transfer-history-icon"></span>
            <div class="transfer-history-body">
                <div class="transfer-history-main">
                    <strong>${escapeText(getTransferRequestCode(t))}</strong>
                    <p><b>Từ:</b> ${escapeText(fromRoom)} <span class="transfer-arrow">→</span> <b>Đến:</b> ${escapeText(toRoom)}</p>
                    <span>Gửi ngày: ${escapeText(formatDate(sentDate))}${time ? ` <b>•</b> ${escapeText(time)}` : ''}</span>
                </div>
                <div class="transfer-history-actions">
                    ${renderRequestStatusPill(status)}
                    <button type="button" class="request-detail-btn" data-transfer-detail="${t.id}">Xem chi tiết</button>
                </div>
            </div>
        </article>`;
}

function updateTransferHistoryFooter(shown, total) {
    const footer = document.getElementById('transfer-history-footer');
    const label = document.getElementById('transfer-history-count');
    if (!footer || !label) return;
    footer.style.display = total ? 'flex' : 'none';
    label.textContent = shown
        ? `Hiển thị 1 đến ${shown} trong tổng số ${total} yêu cầu`
        : `Không có yêu cầu phù hợp trong tổng số ${total} yêu cầu`;
}

function getTransferRequestCode(item) {
    const id = Number(item?.id || 0);
    const created = new Date(item?.requestedAt || item?.createdAt);
    const year = isNaN(created) ? new Date().getFullYear() : created.getFullYear();
    return `#REQ-${year}-${String(id).padStart(4, '0')}`;
}

// ======================================================================
