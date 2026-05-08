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

    if (titleEl) titleEl.textContent = info.title;
    if (descEl)  descEl.textContent  = info.desc;

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

        // Bind nút submit (chỉ 1 lần)
        bindRequestSubmit();
        // Load danh sách yêu cầu
        loadMyRequests();
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
            if (descCounter) descCounter.textContent = `${descInput.value.length}/1000`;
        });
    }

    if (titleCounter && titleInput) titleCounter.textContent = `${titleInput.value.length}/100`;
    if (descCounter && descInput) descCounter.textContent = `${descInput.value.length}/1000`;
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
    let filtered = res.data.filter(r => r.requestType === currentReqType);
    if (requestStatusFilter) {
        filtered = filtered.filter(r => String(r.status || '') === requestStatusFilter);
    }
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
                <span>Gửi ngày: ${formatDate(r.createdAt)}</span>
                ${r.resolutionNote ? `<span class="resolution-note">💬 ${r.resolutionNote}</span>` : ''}
                ${r.status === 'Pending'
                    ? `<button type="button" class="btn-danger btn-sm" data-req-id="${r.id}">Hủy</button>`
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
        bindTransferReasonCounter();
        return;
    }

    transferRooms = res.data.rooms;
    renderTransferRooms(transferRooms);
    bindTransferReasonCounter();

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
            bindTransferReasonCounter();
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
    const histEl = document.getElementById('transfer-history-list');
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
                ${t.status === 'Pending'
                    ? `<button type="button" class="btn-danger btn-sm" data-cancel-transfer-id="${t.id}">Hủy yêu cầu</button>`
                    : ''}
            </div>
        </div>`).join('');

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

// ======================================================================
