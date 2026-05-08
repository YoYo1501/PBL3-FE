// 9. HỢP ĐỒNG – GET /api/contracts/my
// ======================================================================
async function loadMyContract() {
    setLoading('contract-content');
    setLoading('residence-history-content', 'Đang tải lịch sử lưu trú...');
    const res = await callApi('/contracts/my');
    const el = document.getElementById('contract-content');
    const historyEl = document.getElementById('residence-history-content');
    const renewSec = document.getElementById('renewal-section');

    if (!res?.ok || !res.data?.data) {
        el.innerHTML = `<div class="empty-state residence-empty">Không tìm thấy hợp đồng lưu trú đang hoạt động.</div>`;
        if (historyEl) historyEl.innerHTML = `<div class="empty-state residence-empty">Chưa có dữ liệu lịch sử lưu trú.</div>`;
        if (renewSec) renewSec.style.display = 'none';
        return;
    }

    const c = res.data.data; // ContractResponseDto
    const contractStatus = getRoomStatusMeta(c.status);
    const daysRemaining = getDaysRemainingLabel(c);

    el.innerHTML = `
        <article class="content-card residence-detail-card">
            <div class="residence-panel-head">
                <div class="residence-panel-title">
                    <span class="residence-panel-icon icon-contract"></span>
                    <h3>Chi tiết hợp đồng</h3>
                </div>
                <span class="residence-status-pill ${contractStatus.cls}">${escapeText(contractStatus.contractLabel)}</span>
            </div>
            <div class="contract-detail-list">
                ${contractDetailRow('icon-doc', 'Mã hợp đồng', escapeText(c.contractCode || '—'))}
                ${contractDetailRow('icon-calendar', 'Ngày bắt đầu', escapeText(formatDate(c.startDate)))}
                ${contractDetailRow('icon-calendar-check', 'Ngày kết thúc', escapeText(formatDate(c.endDate)))}
                ${contractDetailRow('icon-money', 'Giá thuê', `${escapeText(formatCurrency(c.price))} / tháng`)}
                ${contractDetailRow('icon-clock', 'Còn lại', `<span class="days-pill">${escapeText(daysRemaining)}</span>`)}
            </div>
            ${c.canRenew ? `<div class="residence-actions"><button type="button" class="btn-primary" id="show-renewal-btn">Gia hạn hợp đồng</button></div>` : ''}
        </article>`;

    if (historyEl) {
        historyEl.innerHTML = renderResidenceHistory(c);
        bindResidenceRecordDownload(c);
    }

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
