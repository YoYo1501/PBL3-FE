// 10. HÓA ĐƠN – GET /api/invoices/my
// ======================================================================
function normalizeInvoiceStatus(status) {
    return String(status || '').trim();
}

function getInvoiceRecordId(item) {
    return Number(item?.invoiceId ?? item?.id);
}

function isInvoicePaid(inv) {
    return normalizeInvoiceStatus(inv?.status) === 'Paid';
}

function isInvoiceUnpaid(inv) {
    return normalizeInvoiceStatus(inv?.status) === 'Unpaid';
}

function invoiceStatusMeta(status) {
    const normalized = normalizeInvoiceStatus(status);
    const map = {
        Paid: { label: 'Đã thanh toán', cls: 'is-paid' },
        Unpaid: { label: 'Chưa thanh toán', cls: 'is-unpaid' },
        Draft: { label: 'Nháp', cls: 'is-draft' }
    };
    return map[normalized] || { label: normalized || 'Chưa rõ', cls: 'is-muted' };
}

function parseInvoicePeriod(period) {
    const raw = String(period || '').trim();
    let match = raw.match(/^(\d{4})[-/](\d{1,2})$/);
    if (match) return { year: Number(match[1]), month: Number(match[2]) };
    match = raw.match(/^(\d{1,2})[-/](\d{4})$/);
    if (match) return { year: Number(match[2]), month: Number(match[1]) };
    return null;
}

function getInvoiceDueDate(inv) {
    const period = parseInvoicePeriod(inv?.period);
    if (period) return new Date(period.year, period.month - 1, 15);
    const issued = new Date(inv?.issuedAt);
    if (isNaN(issued)) return null;
    return new Date(issued.getFullYear(), issued.getMonth(), 15);
}

function invoiceDueDateText(inv) {
    const dueDate = getInvoiceDueDate(inv);
    return dueDate ? formatDate(dueDate.toISOString()) : '—';
}

function invoiceDueDateSubText(inv) {
    if (!isInvoiceUnpaid(inv)) return '';
    const dueDate = getInvoiceDueDate(inv);
    if (!dueDate) return '';

    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffDays = Math.ceil((startDue - startToday) / 86400000);

    if (diffDays > 0) return `Còn ${diffDays} ngày`;
    if (diffDays === 0) return 'Đến hạn hôm nay';
    return `Quá hạn ${Math.abs(diffDays)} ngày`;
}

function invoiceDueDateHtml(inv) {
    const subText = invoiceDueDateSubText(inv);
    return `
        <span class="invoice-due-cell ${subText.startsWith('Quá hạn') ? 'is-overdue' : ''}">
            <strong>${escapeText(invoiceDueDateText(inv))}</strong>
            ${subText ? `<small>${escapeText(subText)}</small>` : ''}
        </span>`;
}

function getInvoiceSearchText(inv) {
    return [
        inv.period,
        inv.roomCode,
        inv.status,
        inv.receiptCode,
        inv.paymentMethod,
        inv.transactionCode,
        formatCurrency(inv.totalAmount || inv.paidAmount),
        formatDate(inv.issuedAt),
        formatDate(inv.paidAt),
        invoiceDueDateText(inv),
        invoiceDueDateSubText(inv)
    ].join(' ').toLowerCase();
}

function normalizePaymentMethod(value) {
    const raw = String(value || '').trim();
    const uppercase = raw.toUpperCase();
    if (!raw) return 'Khác';
    if (uppercase.includes('MOMO')) return 'MoMo';
    if (uppercase.includes('VNPAY')) return 'VNPAY';
    if (uppercase.includes('VIETCOMBANK') || uppercase === 'VCB') return 'Vietcombank';
    return raw;
}

function getReceiptMethodKey(value) {
    const method = normalizePaymentMethod(value).toLowerCase();
    if (method === 'momo') return 'momo';
    if (method === 'vnpay') return 'vnpay';
    if (method === 'vietcombank') return 'vietcombank';
    return 'other';
}

function getReceiptMethodBadge(receipt) {
    const method = normalizePaymentMethod(receipt?.paymentMethod);
    const cls = getReceiptMethodKey(method);
    return `<span class="receipt-method-badge ${cls}">${escapeText(method)}</span>`;
}

function getActiveInvoiceItems() {
    return invoiceActiveTab === 'receipt' ? currentReceipts : currentInvoices;
}

function getFilteredInvoices() {
    const q = invoiceSearchTerm.trim().toLowerCase();
    const status = invoiceStatusFilter;
    return getActiveInvoiceItems().filter(inv => {
        if (invoiceActiveTab === 'invoice' && status && normalizeInvoiceStatus(inv.status) !== status) return false;
        if (invoiceActiveTab === 'receipt') {
            const method = receiptMethodFilter.trim().toLowerCase();
            const normalizedMethod = normalizePaymentMethod(inv.paymentMethod).toLowerCase();
            if (method && normalizedMethod !== method) return false;

            const paidAt = new Date(inv.paidAt || inv.issuedAt);
            const fromDate = receiptDateFrom ? new Date(receiptDateFrom) : null;
            const toDate = receiptDateTo ? new Date(receiptDateTo) : null;
            if (fromDate && !isNaN(fromDate) && !isNaN(paidAt) && paidAt < fromDate) return false;
            if (toDate && !isNaN(toDate) && !isNaN(paidAt)) {
                const inclusiveTo = new Date(toDate);
                inclusiveTo.setHours(23, 59, 59, 999);
                if (paidAt > inclusiveTo) return false;
            }
        }
        return !q || getInvoiceSearchText(inv).includes(q);
    });
}

function getSelectedInvoice(list = getActiveInvoiceItems()) {
    if (!list.length) return null;
    const selected = list.find(inv => getInvoiceRecordId(inv) === Number(selectedInvoiceId));
    return selected || list[0];
}

function invoiceSummaryCard(icon, tone, label, value, hint = '') {
    return `
        <article class="invoice-summary-card ${tone}">
            <span class="invoice-summary-icon ${icon}"></span>
            <div>
                <span>${escapeText(label)}</span>
                <strong>${escapeText(value)}</strong>
                ${hint ? `<em>${escapeText(hint)}</em>` : ''}
            </div>
        </article>`;
}

function invoiceStatusPill(status) {
    const meta = invoiceStatusMeta(status);
    return `<span class="invoice-status ${meta.cls}">${escapeText(meta.label)}</span>`;
}

function invoiceActionButtons(inv) {
    const id = getInvoiceRecordId(inv);
    if (invoiceActiveTab === 'receipt') {
        return `
            <button type="button" class="invoice-icon-btn" data-receipt-download="${id}" title="Tải biên lai">Tải</button>
            <button type="button" class="invoice-icon-btn" data-invoice-select="${id}" title="Xem chi tiết">Xem</button>`;
    }

    return `
        <button type="button" class="invoice-pay-btn" data-inv-id="${id}"><span class="inv-pay-icon"></span>Thanh toán ngay</button>
        <button type="button" class="invoice-dl-btn" data-invoice-download="${id}" title="Tải hóa đơn"><span class="inv-dl-icon"></span>Tải hóa đơn</button>`;
}

function downloadInvoice(inv) {
    if (!inv) return;
    const content = [
        'HOA DON KY TUC XA',
        `Ky thanh toan: ${inv.period || ''}`,
        `Phong: ${inv.roomCode || ''}`,
        `Ngay phat hanh: ${formatDate(inv.issuedAt)}`,
        `Han thanh toan: ${invoiceDueDateText(inv)}`,
        `Tien phong: ${formatCurrency(inv.roomFee)}`,
        `Tien dien: ${formatCurrency(inv.electricFee)}`,
        `Tien nuoc: ${formatCurrency(inv.waterFee)}`,
        `Tong cong: ${formatCurrency(inv.totalAmount)}`,
        `Trang thai: ${invoiceStatusMeta(inv.status).label}`
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveBlob(blob, `hoa-don-${inv.period || inv.id}.txt`);
}

function saveBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function downloadReceipt(receipt) {
    if (!receipt) return;
    const invoiceId = getInvoiceRecordId(receipt);
    const res = await callApiBlob(`/receipts/my/${invoiceId}/download`);
    if (!res?.ok || !res.blob) {
        showToast('Không thể tải biên lai.', true);
        return;
    }

    const safeCode = String(receipt.receiptCode || invoiceId).replace(/[^\w-]+/g, '-');
    saveBlob(res.blob, `bien-lai-${safeCode}.xlsx`);
}

function renderInvoiceDetail(inv) {
    const isReceiptTab = invoiceActiveTab === 'receipt';
    if (!inv) {
        return `
            <aside class="invoice-detail-card">
                <div class="invoice-detail-empty">${isReceiptTab ? 'Chưa có biên lai để xem chi tiết.' : 'Chọn một hóa đơn để xem chi tiết.'}</div>
            </aside>`;
    }

    const id = getInvoiceRecordId(inv);
    const title = isReceiptTab ? 'CHI TIẾT BIÊN LAI' : 'CHI TIẾT HÓA ĐƠN';
    const amount = inv.paidAmount ?? inv.totalAmount;
    const receiptStatusPill = '<span class="invoice-status is-paid">Thành công</span>';

    const receiptMeta = `
        <div class="inv-detail-row"><span>Mã biên lai</span><strong>${escapeText(inv.receiptCode || `BR-${id}`)}</strong></div>
        <div class="inv-detail-row"><span>Ngày thanh toán</span><strong>${escapeText(formatDate(inv.paidAt))}</strong></div>
        <div class="inv-detail-row"><span>Phương thức</span><strong>${escapeText(inv.paymentMethod || '—')}</strong></div>
        <div class="inv-detail-row"><span>Mã giao dịch</span><strong>${escapeText(inv.transactionCode || '—')}</strong></div>`;

    const invoiceMeta = `
        <div class="inv-detail-row"><span>Ngày phát hành</span><strong>${escapeText(formatDate(inv.issuedAt))}</strong></div>
        <div class="inv-detail-row"><span>Hạn thanh toán</span><strong class="${isInvoiceUnpaid(inv) ? 'is-danger' : ''}">${escapeText(invoiceDueDateText(inv))}</strong></div>
        <div class="inv-detail-row"><span>Trạng thái</span><strong>${invoiceStatusPill(inv.status)}</strong></div>`;

    return `
        <aside class="invoice-detail-card">
            <div class="invoice-detail-head">
                <h3>${title}</h3>
                ${isReceiptTab ? receiptStatusPill : invoiceStatusPill(inv.status)}
            </div>
            <div class="invoice-detail-period">
                <span>Kỳ thanh toán</span>
                <strong>${escapeText(inv.period || '—')}</strong>
            </div>
            <div class="invoice-detail-list">
                <div class="inv-detail-row"><span>Phòng</span><strong>${escapeText(inv.roomCode || '—')}</strong></div>
                ${isReceiptTab ? receiptMeta : invoiceMeta}
            </div>
            <div class="invoice-payment-detail">
                <h4>CHI TIẾT THANH TOÁN</h4>
                <div class="inv-detail-row"><span>Tiền phòng</span><strong>${escapeText(formatCurrency(inv.roomFee))}</strong></div>
                <div class="inv-detail-row"><span>Tiền điện</span><strong>${escapeText(formatCurrency(inv.electricFee))}</strong></div>
                <div class="inv-detail-row"><span>Tiền nước</span><strong>${escapeText(formatCurrency(inv.waterFee))}</strong></div>
            </div>
            <div class="invoice-total-line">
                <span>Tổng cộng</span>
                <strong>${escapeText(formatCurrency(amount))}</strong>
            </div>
            <div class="invoice-detail-actions">
                ${isReceiptTab
                    ? `<button type="button" class="invoice-detail-download" data-receipt-download="${id}"><span class="inv-dl-icon"></span>Tải biên lai</button>`
                    : `<button type="button" class="invoice-detail-pay" data-inv-id="${id}"><span class="inv-pay-icon"></span>Thanh toán ngay</button>
                       <button type="button" class="invoice-detail-download" data-invoice-download="${id}"><span class="inv-dl-icon"></span>Tải hóa đơn</button>`}
            </div>
        </aside>`;
}

function renderInvoiceRows(filtered) {
    if (invoiceActiveTab === 'receipt') {
        return filtered.map(receipt => {
            const id = getInvoiceRecordId(receipt);
            const selected = id === Number(selectedInvoiceId);
            return `
                <tr class="${selected ? 'is-selected' : ''}" data-invoice-row="${id}">
                    <td>
                        <div class="receipt-period-cell">
                            <span class="receipt-doc-icon"></span>
                            <div>
                                <strong>${escapeText(receipt.period || '—')}</strong>
                                <small>Biên lai điện tử</small>
                            </div>
                        </div>
                    </td>
                    <td><strong>${escapeText(receipt.receiptCode || `BR-${id}`)}</strong></td>
                    <td>${escapeText(formatDate(receipt.paidAt))}</td>
                    <td>${getReceiptMethodBadge(receipt)}</td>
                    <td><strong>${escapeText(formatCurrency(receipt.paidAmount ?? receipt.totalAmount))}</strong></td>
                    <td>${escapeText(receipt.transactionCode || '—')}</td>
                    <td>
                        <div class="receipt-actions">
                            <button type="button" class="invoice-icon-btn" data-invoice-select="${id}" title="Xem chi tiết">Xem</button>
                            <button type="button" class="invoice-dl-btn" data-receipt-download="${id}" title="Tải PDF"><span class="inv-dl-icon"></span>Tải PDF</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    return filtered.map(inv => {
        const id = getInvoiceRecordId(inv);
        const selected = id === Number(selectedInvoiceId);
        return `
            <tr class="${selected ? 'is-selected' : ''}" data-invoice-row="${id}">
                <td>${escapeText(inv.period || '—')}</td>
                <td>${escapeText(inv.roomCode || '—')}</td>
                <td>${escapeText(formatDate(inv.issuedAt))}</td>
                <td>${invoiceDueDateHtml(inv)}</td>
                <td><strong>${escapeText(formatCurrency(inv.totalAmount))}</strong></td>
                <td>${invoiceStatusPill(inv.status)}</td>
                <td><div class="invoice-row-actions">${invoiceActionButtons(inv)}<button type="button" class="invoice-more-btn" data-invoice-select="${id}">⋮</button></div></td>
            </tr>`;
    }).join('');
}


function renderInvoiceTableHead() {
    if (invoiceActiveTab === 'receipt') {
        return `
            <tr>
                <th>Kỳ thanh toán</th>
                <th>Mã biên lai</th>
                <th>Ngày thanh toán</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th>Mã giao dịch</th>
                <th>Thao tác</th>
            </tr>`;
    }

    return `
        <tr>
            <th>Kỳ thanh toán</th>
            <th>Phòng</th>
            <th>Ngày phát hành</th>
            <th>Hạn thanh toán</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
        </tr>`;
}

function renderInvoiceDashboard() {
    const el = document.getElementById('invoice-content');
    if (!el) return;

    const paidTotal = currentReceipts.reduce((sum, inv) => sum + Number(inv.paidAmount ?? inv.totalAmount ?? 0), 0);
    const unpaidTotal = currentInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const allTotal = paidTotal + unpaidTotal;
    const totalRecords = currentInvoices.length + currentReceipts.length;
    const activeItems = getActiveInvoiceItems();
    const filtered = getFilteredInvoices();
    const selectedInvoice = getSelectedInvoice(filtered);
    selectedInvoiceId = selectedInvoice ? getInvoiceRecordId(selectedInvoice) : null;

    const rows = renderInvoiceRows(filtered);
    const emptyLabel = invoiceActiveTab === 'receipt' ? 'Chưa có biên lai nào.' : 'Không có hóa đơn chưa thanh toán.';
    const activeLabel = invoiceActiveTab === 'receipt' ? 'biên lai' : 'hóa đơn';
    const alertMessage = invoiceActiveTab === 'receipt'
        ? 'Các khoản đã thanh toán sẽ được lưu tại biên lai để bạn tra cứu và tải lại khi cần.'
        : 'Các hóa đơn chưa thanh toán. Vui lòng thanh toán trước hạn để tránh phát sinh phí trễ hạn.';

    el.innerHTML = `
        <div class="invoice-dashboard">
            <div class="invoice-main-column">
                <section class="invoice-overview-card">
                    <div class="invoice-summary-grid">
                        ${invoiceSummaryCard('invoice-icon-total', 'tone-blue', 'Tổng phải thanh toán', formatCurrency(allTotal), `${totalRecords} khoản`)}
                        ${invoiceSummaryCard('invoice-icon-paid', 'tone-green', 'Đã thanh toán', formatCurrency(paidTotal), `${currentReceipts.length} biên lai`)}
                        ${invoiceSummaryCard('invoice-icon-debt', 'tone-orange', 'Còn nợ', formatCurrency(unpaidTotal), `${currentInvoices.length} hóa đơn`)}
                        ${invoiceSummaryCard('invoice-icon-count', 'tone-purple', 'Tổng hóa đơn', String(totalRecords), `${Math.max(totalRecords, 0)} kỳ`)}
                    </div>
                </section>

                <section class="invoice-list-card">
                    <div class="invoice-tabs">
                        <button type="button" class="${invoiceActiveTab === 'invoice' ? 'active' : ''}" data-invoice-tab="invoice">Hóa đơn</button>
                        <button type="button" class="${invoiceActiveTab === 'receipt' ? 'active' : ''}" data-invoice-tab="receipt">Biên lai</button>
                    </div>
                    <div class="invoice-alert ${invoiceActiveTab === 'receipt' ? 'is-receipt' : ''}">
                        <strong>i</strong>
                        <span>${escapeText(alertMessage)}</span>
                    </div>
                    <div class="invoice-toolbar">
                        ${invoiceActiveTab === 'invoice'
                            ? `<select id="invoice-status-filter">
                                <option value="">Tất cả trạng thái</option>
                                <option value="Unpaid">Chưa thanh toán</option>
                            </select>`
                            : `<div class="receipt-toolbar-group">
                                <div class="receipt-date-range">
                                    <input id="receipt-date-from" type="date" value="${escapeText(receiptDateFrom)}" aria-label="Từ ngày">
                                    <span> - </span>
                                    <input id="receipt-date-to" type="date" value="${escapeText(receiptDateTo)}" aria-label="Đến ngày">
                                </div>
                                <select id="receipt-method-filter" aria-label="Lọc phương thức thanh toán">
                                    <option value="">Tất cả phương thức</option>
                                    <option value="momo">MoMo</option>
                                    <option value="vnpay">VNPAY</option>
                                    <option value="vietcombank">Vietcombank</option>
                                </select>
                            </div>`}
                        <label class="invoice-search">
                            <input id="invoice-search" type="search" placeholder="${invoiceActiveTab === 'receipt' ? 'Tìm kiếm biên lai, mã giao dịch...' : 'Tìm kiếm hóa đơn...'}" value="${escapeText(invoiceSearchTerm)}">
                            <span></span>
                        </label>
                    </div>
                    <div class="invoice-table-wrap">
                        <table class="invoice-table">
                            <thead>${renderInvoiceTableHead()}</thead>
                            <tbody>${rows || `<tr><td colspan="7" class="invoice-empty-cell">${emptyLabel}</td></tr>`}</tbody>
                        </table>
                    </div>
                    <div class="invoice-footer">
                        <span>Hiển thị ${filtered.length} trên ${activeItems.length} ${activeLabel}</span>
                        <div class="invoice-pager"><button type="button" disabled>‹</button><strong>1</strong><button type="button" disabled>›</button></div>
                    </div>
                </section>
            </div>
            ${renderInvoiceDetail(selectedInvoice)}
        </div>`;

    const statusFilter = document.getElementById('invoice-status-filter');
    if (statusFilter) statusFilter.value = invoiceStatusFilter;
    const methodFilter = document.getElementById('receipt-method-filter');
    if (methodFilter) methodFilter.value = receiptMethodFilter;
    document.getElementById('invoice-search')?.addEventListener('input', event => {
        invoiceSearchTerm = event.target.value || '';
        renderInvoiceDashboard();
    });
    statusFilter?.addEventListener('change', event => {
        invoiceStatusFilter = event.target.value || '';
        renderInvoiceDashboard();
    });
    methodFilter?.addEventListener('change', event => {
        receiptMethodFilter = event.target.value || '';
        renderInvoiceDashboard();
    });
    document.getElementById('receipt-date-from')?.addEventListener('change', event => {
        receiptDateFrom = event.target.value || '';
        renderInvoiceDashboard();
    });
    document.getElementById('receipt-date-to')?.addEventListener('change', event => {
        receiptDateTo = event.target.value || '';
        renderInvoiceDashboard();
    });
    el.querySelectorAll('[data-invoice-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            invoiceActiveTab = btn.dataset.invoiceTab || 'invoice';
            invoiceStatusFilter = '';
            invoiceSearchTerm = '';
            if (invoiceActiveTab === 'invoice') {
                receiptMethodFilter = '';
                receiptDateFrom = '';
                receiptDateTo = '';
            }
            selectedInvoiceId = getActiveInvoiceItems()[0] ? getInvoiceRecordId(getActiveInvoiceItems()[0]) : null;
            renderInvoiceDashboard();
        });
    });
    el.querySelectorAll('[data-invoice-row], [data-invoice-select]').forEach(node => {
        node.addEventListener('click', event => {
            const id = node.dataset.invoiceRow || node.dataset.invoiceSelect;
            if (!id) return;
            event.stopPropagation();
            selectedInvoiceId = Number(id);
            renderInvoiceDashboard();
        });
    });
    el.querySelectorAll('.invoice-pay-btn, .invoice-detail-pay').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            payInvoice(Number(btn.dataset.invId));
        });
    });
    el.querySelectorAll('[data-invoice-download]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const inv = currentInvoices.find(item => getInvoiceRecordId(item) === Number(btn.dataset.invoiceDownload));
            downloadInvoice(inv);
        });
    });
    el.querySelectorAll('[data-receipt-download]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const receipt = currentReceipts.find(item => getInvoiceRecordId(item) === Number(btn.dataset.receiptDownload));
            downloadReceipt(receipt);
        });
    });
}

function sortInvoicesByPeriodDesc(items) {
    return [...items].sort((a, b) => {
        const periodCompare = String(b.period || '').localeCompare(String(a.period || ''));
        if (periodCompare !== 0) return periodCompare;
        return getInvoiceRecordId(b) - getInvoiceRecordId(a);
    });
}

function sortReceiptsDesc(items) {
    return [...items].sort((a, b) => {
        const paidA = new Date(a.paidAt || a.issuedAt || 0).getTime();
        const paidB = new Date(b.paidAt || b.issuedAt || 0).getTime();
        if (paidB !== paidA) return paidB - paidA;
        return getInvoiceRecordId(b) - getInvoiceRecordId(a);
    });
}

async function loadMyInvoices(options = {}) {
    setLoading('invoice-content');
    const [invoiceRes, receiptRes] = await Promise.all([
        callApi('/invoices/my'),
        callApi('/receipts/my')
    ]);
    const el = document.getElementById('invoice-content');
    if (!el) return;

    const invoiceData = Array.isArray(invoiceRes?.data) ? invoiceRes.data : [];
    const receiptData = Array.isArray(receiptRes?.data) ? receiptRes.data : [];

    if (!invoiceRes?.ok && !receiptRes?.ok) {
        el.innerHTML = `<div class="empty-state error-state">Không thể tải hóa đơn và biên lai.</div>`;
        return;
    }

    currentInvoices = sortInvoicesByPeriodDesc(invoiceData.filter(isInvoiceUnpaid));
    currentReceipts = sortReceiptsDesc(receiptRes?.ok ? receiptData : invoiceData.filter(isInvoicePaid));

    invoiceActiveTab = options.initialTab || 'invoice';
    invoiceStatusFilter = '';
    invoiceSearchTerm = '';
    receiptMethodFilter = '';
    receiptDateFrom = '';
    receiptDateTo = '';

    const selectedId = Number(options.selectedId);
    if (selectedId) {
        selectedInvoiceId = selectedId;
    } else {
        const initialItems = getActiveInvoiceItems();
        selectedInvoiceId = initialItems[0] ? getInvoiceRecordId(initialItems[0]) : null;
    }

    renderInvoiceDashboard();
}

async function payInvoice(invoiceId) {
    if (!confirm('Bạn muốn thanh toán hóa đơn này qua VNPAY?')) return;
    const returnPage = window.location.href.split('#')[0];
    const res = await callApi(`/payments/create-payment-url/${invoiceId}?returnPage=${encodeURIComponent(returnPage)}`, { method: 'POST' });
    if (res?.ok && res.data?.url) {
        window.location.href = res.data.url;
    } else {
        showToast(res?.data?.message || 'Không thể tạo link thanh toán.', true);
    }
}
// ======================================================================
