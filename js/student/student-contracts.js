// 9. HỢP ĐỒNG – GET /api/contracts/my
// ======================================================================
let selectedRenewalPackageId = null;
let currentRenewalHistory = [];
let currentResidenceContract = null;
let currentResidenceTransfers = [];

async function loadMyContract() {
    setLoading('contract-content');
    setLoading('residence-history-content', 'Đang tải lịch sử lưu trú...');
    const res = await callApi('/contracts/my');
    const el = document.getElementById('contract-content');
    const historyEl = document.getElementById('residence-history-content');
    const renewSec = document.getElementById('renewal-section');
    const renewalHistorySec = document.getElementById('renewal-history-section');
    const renewalChoiceArea = document.getElementById('renewal-choice-area');
    bindRenewalHistoryRefresh();

    if (!res?.ok || !res.data?.data) {
        el.innerHTML = renderRegisterAgainCard(
            'Không tìm thấy hợp đồng lưu trú đang hoạt động.',
            'Tài khoản của bạn vẫn còn. Bạn có thể đăng ký ở lại bằng luồng đăng ký bình thường.'
        );
        bindRegisterAgainButtons(el);
        if (historyEl) historyEl.innerHTML = `<div class="empty-state residence-empty">Chưa có dữ liệu lịch sử lưu trú.</div>`;
        if (renewSec) renewSec.style.display = 'none';
        if (renewalHistorySec) renewalHistorySec.style.display = 'none';
        return;
    }

    const c = res.data.data; // ContractResponseDto
    currentResidenceContract = c;
    currentResidenceTransfers = [];
    residenceHistoryExpanded = false;
    const contractStatus = getRoomStatusMeta(c.status);
    const daysRemaining = getDaysRemainingLabel(c);
    if (renewalChoiceArea) renewalChoiceArea.style.display = c.canRenew ? 'grid' : 'none';

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
        bindResidenceHistoryViewAll();
    }

    loadRenewalHistory();
    loadResidenceTransferHistory();

    if (c.canRenew) {
        document.getElementById('show-renewal-btn')?.addEventListener('click', () => {
            if (renewSec) renewSec.style.display = 'block';
            if (renewalChoiceArea) renewalChoiceArea.style.display = 'grid';
            loadRenewalPackages();
            loadRenewalHistory(true);
        });
    }

    if (renewSec) renewSec.style.display = 'none';
}

async function loadRenewalPackages() {
    const listEl = document.getElementById('renewal-packages-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-state">Đang tải kỳ gia hạn...</div>';

    const res = await callApi('/contracts/renewal-packages');
    if (!res?.ok) {
        const message = res?.data?.message || 'Không thể tải kỳ gia hạn.';
        listEl.innerHTML = `<div class="empty-state">${escapeText(message)}</div>`;
        if (String(message).toLowerCase().includes('chờ duyệt')) {
            syncRenewalPendingWarning(true);
        }
        return;
    }

    if (!res.data?.packages?.length) {
        listEl.innerHTML = '<div class="empty-state">Không có kỳ gia hạn khả dụng.</div>';
        return;
    }

    const packages = res.data.packages;
    if (!packages.some(pkg => String(pkg.id) === String(selectedRenewalPackageId))) {
        selectedRenewalPackageId = packages[0].id;
    }

    listEl.innerHTML = packages.map((pkg, index) => renderRenewalTermCard(pkg, index)).join('');
    setSelectedRenewalPackage(selectedRenewalPackageId);

    listEl.querySelectorAll('.renewal-term-card').forEach(card => {
        card.addEventListener('click', () => setSelectedRenewalPackage(card.dataset.pkgId));
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setSelectedRenewalPackage(card.dataset.pkgId);
        });
    });

    listEl.querySelectorAll('.renewal-term-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            setSelectedRenewalPackage(btn.dataset.pkgId);
            submitRenewal(Number(btn.dataset.pkgId));
        });
    });
}

function setSelectedRenewalPackage(packageId) {
    selectedRenewalPackageId = packageId;
    document.querySelectorAll('.renewal-term-card').forEach(card => {
        const isSelected = String(card.dataset.pkgId) === String(packageId);
        card.classList.toggle('is-selected', isSelected);
        card.setAttribute('aria-pressed', String(isSelected));
    });
}

function getRenewalTermTone(pkg, index) {
    if (Number(pkg.durationMonths) === 4) return 'blue';
    if (Number(pkg.durationMonths) === 8) return 'purple';
    if (Number(pkg.durationMonths) === 12) return 'green';
    return ['blue', 'purple', 'green'][index % 3];
}

function renderRenewalTermCard(pkg, index) {
    const tone = getRenewalTermTone(pkg, index);
    const isRecommended = Number(pkg.durationMonths) === 4 || index === 0;
    const recommendedBadge = isRecommended ? '<span class="renewal-recommended">Khuyến dùng</span>' : '';
    const endDate = escapeText(formatDate(pkg.newEndDate));

    return `
        <article class="renewal-term-card tone-${tone}${isRecommended ? ' is-recommended' : ''}" data-pkg-id="${escapeText(pkg.id)}" role="button" tabindex="0" aria-pressed="false">
            <span class="renewal-selected-mark"></span>
            <div class="renewal-term-head">
                <span class="renewal-term-icon" data-months="${escapeText(pkg.durationMonths)}"></span>
                <div>
                    <div class="renewal-term-title-row">
                        <h4>${escapeText(pkg.name)}</h4>
                        ${recommendedBadge}
                    </div>
                    <p>Gia hạn ${escapeText(pkg.durationMonths)} tháng</p>
                </div>
            </div>
            <div class="renewal-term-date">
                <span>Đến ngày</span>
                <strong>${endDate}</strong>
            </div>
            <div class="renewal-term-rules">
                <span><i class="rule-room"></i>Thanh toán tiền phòng theo tháng</span>
                <span><i class="rule-utility"></i>Điện, nước tính theo chỉ số thực tế</span>
            </div>
            <button type="button" class="renewal-term-btn" data-pkg-id="${escapeText(pkg.id)}">Chọn kỳ này</button>
        </article>`;
}

async function submitRenewal(renewalPackageId) {
    const confirmed = await confirmRenewalSubmission(renewalPackageId);
    if (!confirmed) return;

    const errEl = document.getElementById('renewal-error');
    if (errEl) errEl.textContent = '';

    const res = await callApi('/contracts/renew', {
        method: 'POST',
        body: JSON.stringify({ renewalPackageId })
    });

    if (res?.ok) {
        showToast('Gửi yêu cầu gia hạn thành công! Chờ Admin duyệt.');
        const renewSec = document.getElementById('renewal-section');
        if (renewSec) renewSec.style.display = 'block';
        await loadRenewalHistory(true);
        await loadRenewalPackages();
    } else {
        if (errEl) errEl.textContent = res?.data?.message || 'Gửi yêu cầu thất bại.';
    }
}

function confirmRenewalSubmission(renewalPackageId) {
    const card = Array.from(document.querySelectorAll('.renewal-term-card'))
        .find(item => String(item.dataset.pkgId) === String(renewalPackageId));
    const title = card?.querySelector('h4')?.textContent?.trim() || 'kỳ gia hạn đã chọn';
    const newEndDate = card?.querySelector('.renewal-term-date strong')?.textContent?.trim() || 'ngày kết thúc mới';
    const modal = ensureRenewalConfirmModal();

    modal.querySelector('[data-renewal-confirm-package]').textContent = title;
    modal.querySelector('[data-renewal-confirm-date]').textContent = newEndDate;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    modal.querySelector('[data-renewal-confirm-submit]')?.focus();

    return new Promise(resolve => {
        const cleanup = result => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            modal.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };

        const onClick = event => {
            if (event.target === modal || event.target.closest('[data-renewal-confirm-cancel]')) cleanup(false);
            if (event.target.closest('[data-renewal-confirm-submit]')) cleanup(true);
        };

        const onKeydown = event => {
            if (event.key === 'Escape') cleanup(false);
        };

        modal.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeydown);
    });
}

function ensureRenewalConfirmModal() {
    let modal = document.getElementById('renewal-confirm-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'renewal-confirm-modal';
    modal.className = 'renewal-detail-overlay renewal-confirm-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'renewal-confirm-title');
    modal.innerHTML = `
        <div class="renewal-confirm-dialog">
            <button type="button" class="renewal-detail-close" data-renewal-confirm-cancel aria-label="Đóng">×</button>
            <div class="renewal-confirm-content">
                <div class="renewal-detail-head renewal-confirm-head">
                    <span class="renewal-detail-head-icon"></span>
                    <div>
                        <h3 id="renewal-confirm-title">Xác nhận gia hạn hợp đồng</h3>
                        <p>Vui lòng kiểm tra kỳ gia hạn trước khi gửi yêu cầu đến quản trị viên.</p>
                    </div>
                </div>
                <div class="renewal-confirm-summary">
                    <div>
                        <span>Kỳ gia hạn</span>
                        <strong data-renewal-confirm-package>—</strong>
                    </div>
                    <div>
                        <span>Ngày kết thúc mới</span>
                        <strong data-renewal-confirm-date>—</strong>
                    </div>
                </div>
                <p class="renewal-confirm-note">Sau khi gửi, yêu cầu sẽ ở trạng thái chờ duyệt.</p>
            </div>
            <div class="renewal-confirm-actions">
                <button type="button" class="renewal-detail-secondary" data-renewal-confirm-cancel>Hủy</button>
                <button type="button" class="renewal-detail-print renewal-confirm-submit" data-renewal-confirm-submit>Gửi yêu cầu</button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    return modal;
}

function getRenewalStatusMeta(status) {
    const normalized = String(status || '').trim();
    const key = normalized.toLowerCase();
    const map = {
        pending: { key: 'pending', label: 'Chờ duyệt', cls: 'is-pending' },
        approved: { key: 'approved', label: 'Đã duyệt', cls: 'is-approved' },
        rejected: { key: 'rejected', label: 'Từ chối', cls: 'is-rejected' },
        cancelled: { key: 'cancelled', label: 'Đã hủy', cls: 'is-cancelled' }
    };
    return map[key] || { key: 'unknown', label: normalized || '—', cls: 'is-cancelled' };
}

function bindRenewalHistoryRefresh() {
    const refreshBtn = document.getElementById('renewal-history-refresh-btn');
    if (!refreshBtn || refreshBtn.dataset.bound === 'true') return;

    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadRenewalHistory(true);
        refreshBtn.disabled = false;
    });
}

async function loadRenewalHistory(keepSectionVisible = false) {
    const listEl = document.getElementById('renewal-history-list');
    const historySection = document.getElementById('renewal-history-section');
    if (!listEl) return [];

    if (historySection) historySection.style.display = 'grid';
    listEl.innerHTML = '<div class="loading-state">Đang tải lịch sử gia hạn...</div>';
    const res = await callApi('/contracts/renewals/my');
    const items = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];

    if (!res?.ok) {
        currentRenewalHistory = [];
        listEl.innerHTML = `<div class="empty-state">${escapeText(res?.data?.message || 'Không thể tải lịch sử gia hạn.')}</div>`;
        syncResidenceHistoryTimeline();
        return [];
    }

    if (!items.length) {
        currentRenewalHistory = [];
        listEl.innerHTML = '<div class="empty-state">Chưa có yêu cầu gia hạn nào.</div>';
        syncRenewalPendingWarning(false);
        syncResidenceHistoryTimeline();
        if (!keepSectionVisible && historySection) historySection.style.display = 'grid';
        return [];
    }

    currentRenewalHistory = items;
    syncRenewalPendingWarning(items.some(item => getRenewalStatusMeta(item.status).key === 'pending'));
    syncResidenceHistoryTimeline();
    listEl.innerHTML = renderRenewalHistoryTable(items);
    bindRenewalHistoryActions(listEl);

    if (historySection) historySection.style.display = 'grid';

    return items;
}

async function loadResidenceTransferHistory() {
    const res = await callApi('/roomtransfers/my');
    currentResidenceTransfers = res?.ok && Array.isArray(res.data) ? res.data : [];
    syncResidenceHistoryTimeline();
    return currentResidenceTransfers;
}

function syncResidenceHistoryTimeline() {
    const timelineEl = document.getElementById('stay-history-events');
    if (!timelineEl || !currentResidenceContract) return;

    timelineEl.innerHTML = renderResidenceHistoryTimeline(
        currentResidenceContract,
        currentRenewalHistory,
        currentResidenceTransfers,
        residenceHistoryExpanded
    );
    const viewAllBtn = document.getElementById('view-stay-history-btn');
    if (viewAllBtn) viewAllBtn.hidden = residenceHistoryExpanded;
}

function syncRenewalPendingWarning(hasPending) {
    const errEl = document.getElementById('renewal-error');
    if (!errEl) return;

    const pendingMessage = 'Bạn có yêu cầu gia hạn đang chờ duyệt.';
    if (hasPending) {
        errEl.textContent = pendingMessage;
        return;
    }

    if (errEl.textContent.trim() === pendingMessage) {
        errEl.textContent = '';
    }
}

function renderRenewalHistoryTable(items) {
    return `
        <div class="renewal-history-table-wrap">
            <table class="renewal-history-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Kỳ gia hạn</th>
                        <th>Thời gian yêu cầu</th>
                        <th>Thời gian gia hạn</th>
                        <th>Ngày kết thúc mới</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => renderRenewalHistoryRow(item, index)).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderRenewalHistoryRow(item, index) {
    const status = getRenewalStatusMeta(item.status);
    const canCancel = status.key === 'pending';
    const note = item.rejectionReason ? escapeText(item.rejectionReason) : '—';
    const period = `${escapeText(formatDate(item.contractEndDateBeforeRenewal))} <span>→</span> ${escapeText(formatDate(item.contractEndDateAfterRenewal))}`;
    const action = canCancel
        ? `<button type="button" class="renewal-cancel-btn renewal-table-action is-danger" data-renewal-cancel="${escapeText(item.id)}"><span></span>Hủy yêu cầu</button>`
        : `<button type="button" class="renewal-detail-btn renewal-table-action" data-renewal-detail="${escapeText(item.id)}"><span></span>Xem chi tiết</button>`;

    return `
        <tr class="renewal-history-row status-${escapeText(status.key)}">
            <td>${index + 1}</td>
            <td><strong>${escapeText(formatRenewalPackageName(item))}</strong></td>
            <td>${escapeText(formatRenewalDateTime(item.requestedAt))}</td>
            <td class="renewal-period-cell">${period}</td>
            <td><strong>${escapeText(formatDate(item.contractEndDateAfterRenewal))}</strong></td>
            <td><span class="renewal-status ${status.cls}">${escapeText(status.label)}</span></td>
            <td>${note}</td>
            <td class="renewal-history-action-cell">${action}</td>
        </tr>`;
}

function bindRenewalHistoryActions(rootEl) {
    rootEl.querySelectorAll('[data-renewal-cancel]').forEach(button => {
        button.addEventListener('click', () => cancelRenewalRequest(Number(button.dataset.renewalCancel)));
    });

    rootEl.querySelectorAll('[data-renewal-detail]').forEach(button => {
        button.addEventListener('click', () => showRenewalDetail(Number(button.dataset.renewalDetail)));
    });
}

function formatRenewalPackageName(item) {
    const name = item.packageName || 'Kỳ gia hạn';
    const months = Number(item.durationMonths);
    if (!Number.isFinite(months) || months <= 0) return name;
    if (String(name).includes(`${months}`)) return name;
    return `${name} (${months} tháng)`;
}

function formatRenewalDateTime(value) {
    const d = typeof parseDateValue === 'function' ? parseDateValue(value) : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
    const date = d.toLocaleDateString('vi-VN');
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}

function showRenewalDetail(requestId) {
    const item = currentRenewalHistory.find(row => Number(row.id) === Number(requestId));
    if (!item) return;

    const status = getRenewalStatusMeta(item.status);
    const lines = [
        `Kỳ gia hạn: ${formatRenewalPackageName(item)}`,
        `Thời gian yêu cầu: ${formatRenewalDateTime(item.requestedAt)}`,
        `Thời gian gia hạn: ${formatDate(item.contractEndDateBeforeRenewal)} → ${formatDate(item.contractEndDateAfterRenewal)}`,
        `Ngày kết thúc mới: ${formatDate(item.contractEndDateAfterRenewal)}`,
        `Trạng thái: ${status.label}`,
        `Ghi chú: ${item.rejectionReason || '—'}`
    ];
    showRenewalDetailModal(item, status);
}

function showRenewalDetailModal(item, status) {
    const note = item.rejectionReason || item.note || item.adminNote || 'Không có ghi chú';
    const modal = ensureRenewalDetailModal();
    const statusEl = modal.querySelector('[data-renewal-modal-status]');

    statusEl.className = `renewal-detail-status ${status.cls}`;
    statusEl.innerHTML = `<span></span>${escapeText(status.label)}`;
    modal.querySelector('[data-renewal-modal-body]').innerHTML = `
        <div class="renewal-detail-grid">
            ${renderRenewalDetailCard('period', 'Kỳ gia hạn', formatRenewalPackageName(item))}
            ${renderRenewalDetailCard('clock', 'Thời gian yêu cầu', formatRenewalDateTime(item.requestedAt))}
            ${renderRenewalDetailCard('calendar', 'Thời gian gia hạn', `${formatDate(item.contractEndDateBeforeRenewal)} → ${formatDate(item.contractEndDateAfterRenewal)}`)}
            ${renderRenewalDetailCard('check', 'Ngày kết thúc mới', formatDate(item.contractEndDateAfterRenewal))}
        </div>
        <div class="renewal-detail-note">
            <span class="renewal-detail-icon icon-note"></span>
            <div>
                <span>Ghi chú</span>
                <strong>${escapeText(note)}</strong>
            </div>
        </div>
        <div class="renewal-detail-info">
            <span>i</span>
            <p>Thông tin trên được cập nhật theo trạng thái xử lý mới nhất của yêu cầu gia hạn.</p>
        </div>`;

    modal.dataset.printPayload = JSON.stringify({
        packageName: formatRenewalPackageName(item),
        requestedAt: formatRenewalDateTime(item.requestedAt),
        period: `${formatDate(item.contractEndDateBeforeRenewal)} → ${formatDate(item.contractEndDateAfterRenewal)}`,
        newEndDate: formatDate(item.contractEndDateAfterRenewal),
        status: status.label,
        note
    });
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function renderRenewalDetailCard(icon, label, value) {
    return `
        <article class="renewal-detail-card">
            <span class="renewal-detail-icon icon-${escapeText(icon)}"></span>
            <div>
                <span>${escapeText(label)}</span>
                <strong>${escapeText(value || '—')}</strong>
            </div>
        </article>`;
}

function ensureRenewalDetailModal() {
    let modal = document.getElementById('renewal-detail-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'renewal-detail-modal';
    modal.className = 'renewal-detail-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
        <div class="renewal-detail-dialog">
            <button type="button" class="renewal-detail-close" data-renewal-modal-close aria-label="Đóng">×</button>
            <div class="renewal-detail-content">
                <div class="renewal-detail-head">
                    <span class="renewal-detail-head-icon"></span>
                    <div>
                        <h3>Chi tiết yêu cầu gia hạn</h3>
                        <p>Xem thông tin chi tiết yêu cầu gia hạn hợp đồng</p>
                    </div>
                    <span class="renewal-detail-status" data-renewal-modal-status></span>
                </div>
                <div class="renewal-detail-separator"></div>
                <div data-renewal-modal-body></div>
            </div>
            <div class="renewal-detail-footer">
                <button type="button" class="renewal-detail-secondary" data-renewal-modal-close>Đóng</button>
                <button type="button" class="renewal-detail-print" data-renewal-modal-print><span></span>In phiếu</button>
            </div>
        </div>`;

    const close = () => {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    };

    modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-renewal-modal-close]')) close();
    });
    modal.querySelector('[data-renewal-modal-print]')?.addEventListener('click', () => printRenewalDetail(modal));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.style.display === 'flex') close();
    });

    document.body.appendChild(modal);
    return modal;
}

function printRenewalDetail(modal) {
    let data = {};
    try {
        data = JSON.parse(modal.dataset.printPayload || '{}');
    } catch {
        data = {};
    }

    const printWindow = window.open('', '_blank', 'width=820,height=720');
    if (!printWindow) {
        showToast('Trình duyệt đang chặn cửa sổ in.', true);
        return;
    }

    printWindow.document.write(`
        <!doctype html>
        <html lang="vi">
        <head>
            <meta charset="utf-8">
            <title>Phiếu gia hạn hợp đồng</title>
            <style>
                body { font-family: Arial, sans-serif; color: #10284a; padding: 32px; }
                h1 { margin: 0 0 24px; font-size: 24px; }
                .row { display: grid; grid-template-columns: 220px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #dce6f2; }
                .label { color: #5f6f8a; }
                .value { font-weight: 700; }
            </style>
        </head>
        <body>
            <h1>Phiếu chi tiết yêu cầu gia hạn</h1>
            <div class="row"><span class="label">Kỳ gia hạn</span><span class="value">${escapeText(data.packageName || '—')}</span></div>
            <div class="row"><span class="label">Thời gian yêu cầu</span><span class="value">${escapeText(data.requestedAt || '—')}</span></div>
            <div class="row"><span class="label">Thời gian gia hạn</span><span class="value">${escapeText(data.period || '—')}</span></div>
            <div class="row"><span class="label">Ngày kết thúc mới</span><span class="value">${escapeText(data.newEndDate || '—')}</span></div>
            <div class="row"><span class="label">Trạng thái</span><span class="value">${escapeText(data.status || '—')}</span></div>
            <div class="row"><span class="label">Ghi chú</span><span class="value">${escapeText(data.note || '—')}</span></div>
        </body>
        </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

async function cancelRenewalRequest(requestId) {
    if (!confirm('Hủy yêu cầu gia hạn đang chờ duyệt?')) return;

    const res = await callApi(`/contracts/renewals/${requestId}/cancel`, { method: 'PUT' });
    if (res?.ok) {
        showToast('Đã hủy yêu cầu gia hạn.');
        await loadRenewalHistory(true);
        await loadRenewalPackages();
    } else {
        showToast(res?.data?.message || 'Không thể hủy yêu cầu gia hạn.', true);
    }
}

// ======================================================================
