// 10. HÓA ĐƠN – GET /api/invoices/my
// ======================================================================
function normalizeInvoiceStatus(status) {
    return String(status || '').trim();
}

function getInvoiceRecordId(item) {
    return Number(item?.invoiceId ?? item?.id);
}

function getInvoiceDisplayCode(item) {
    if (item?.invoiceCode) return String(item.invoiceCode);
    const raw = String(item?.period || '').trim();
    let period = '';
    let match = raw.match(/^(\d{4})[-/](\d{1,2})$/);
    if (match) period = `${match[1]}${String(Number(match[2])).padStart(2, '0')}`;
    match = period ? null : raw.match(/^(\d{1,2})[-/](\d{4})$/);
    if (match) period = `${match[2]}${String(Number(match[1])).padStart(2, '0')}`;
    if (!period) period = raw.replace(/[^\d]+/g, '') || '000000';
    const id = getInvoiceRecordId(item);
    return `HD-${period}-${String(id || 0).padStart(6, '0')}`;
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
    const dueFromApi = parseDateValue(inv?.dueDate);
    if (!isNaN(dueFromApi)) return dueFromApi;

    const period = parseInvoicePeriod(inv?.period);
    if (period) return new Date(period.year, period.month - 1, 15);
    const issued = parseDateValue(inv?.issuedAt);
    if (isNaN(issued)) return null;
    return new Date(issued.getFullYear(), issued.getMonth(), 15);
}

function invoiceDueDateText(inv) {
    const dueDate = getInvoiceDueDate(inv);
    return dueDate && !isNaN(dueDate) ? dueDate.toLocaleDateString('vi-VN') : '—';
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

function isInvoiceDueThisCycle(inv) {
    if (!isInvoiceUnpaid(inv)) return false;
    const dueDate = getInvoiceDueDate(inv);
    if (!dueDate) return true;

    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfCurrentMonth.setHours(23, 59, 59, 999);
    return dueDate <= endOfCurrentMonth;
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
        getInvoiceDisplayCode(inv),
        formatReceiptPeriod(inv.period),
        inv.roomCode,
        inv.status,
        inv.receiptCode,
        getReceiptDisplayCode(inv),
        inv.paymentMethod,
        getReceiptPaymentMethod(inv),
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
    if (uppercase.includes('VNPAY')) return 'VNPAY';
    return raw;
}

function getReceiptPaymentMethod() {
    return 'VNPAY';
}

function getReceiptMethodKey(value) {
    const method = normalizePaymentMethod(value).toLowerCase();
    if (method === 'vnpay') return 'vnpay';
    return 'other';
}

function getReceiptMethodBadge(receipt) {
    const method = getReceiptPaymentMethod(receipt);
    const cls = getReceiptMethodKey(method);
    return `
        <span class="receipt-method-display ${cls}">
            <img class="receipt-method-logo ${cls}" src="../assets/images/vn%20pay.png" alt="VNPAY">
            <strong>${escapeText(method)}</strong>
        </span>`;
}

function getReceiptDisplayCode(receipt) {
    const id = getInvoiceRecordId(receipt);
    const fallbackPeriod = String(receipt?.period || '').replace(/[^\d]+/g, '') || id;
    const raw = String(receipt?.receiptCode || `BR-${fallbackPeriod}-${String(id).padStart(3, '0')}`).trim();
    const normalized = raw.replace(/^BL-/i, 'BR-');
    return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

function formatReceiptPeriod(period) {
    const parsed = parseInvoicePeriod(period);
    if (!parsed) return String(period || '—');
    return `${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
}

function getDateTimeParts(value) {
    const d = parseDateValue(value);
    if (isNaN(d)) return { date: '—', time: '—' };
    return {
        date: d.toLocaleDateString('vi-VN'),
        time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
}

function formatReceiptDateTime(value) {
    const parts = getDateTimeParts(value);
    return parts.date === '—' ? '—' : `${parts.date} - ${parts.time}`;
}

function getReceiptMonthKey(receipt) {
    const paidAt = parseDateValue(receipt?.paidAt || receipt?.issuedAt);
    if (isNaN(paidAt)) return '';
    return `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;
}

function getReceiptMonthLabel(key) {
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    return match ? `${match[2]}/${match[1]}` : key;
}

function getReceiptMonthOptions() {
    const keys = new Set(currentReceipts.map(getReceiptMonthKey).filter(Boolean));
    return [...keys].sort((a, b) => b.localeCompare(a));
}

function receiptSuccessBadge() {
    return '<span class="receipt-card-status">Thanh toán thành công</span>';
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
            if (receiptMonthFilter && getReceiptMonthKey(inv) !== receiptMonthFilter) return false;
        }
        return !q || getInvoiceSearchText(inv).includes(q);
    });
}

function renderInvoiceDashboardWithSearchFocus(selectionStart, selectionEnd) {
    renderInvoiceDashboard({
        focusSearch: true,
        searchSelectionStart: selectionStart,
        searchSelectionEnd: selectionEnd
    });
}

function queueInvoiceSearchRender(input) {
    const selectionStart = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const selectionEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : selectionStart;
    const activeTab = invoiceActiveTab;

    if (invoiceSearchDebounceTimer) {
        clearTimeout(invoiceSearchDebounceTimer);
    }

    invoiceSearchDebounceTimer = setTimeout(() => {
        invoiceSearchDebounceTimer = null;
        if (invoiceActiveTab !== activeTab || document.activeElement !== input) {
            renderInvoiceDashboard();
            return;
        }
        renderInvoiceDashboardWithSearchFocus(selectionStart, selectionEnd);
    }, 350);
}

function flushInvoiceSearchRender(input) {
    if (invoiceSearchDebounceTimer) {
        clearTimeout(invoiceSearchDebounceTimer);
        invoiceSearchDebounceTimer = null;
    }
    const position = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    renderInvoiceDashboardWithSearchFocus(position, position);
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

function invoiceFooterText(filteredCount, totalCount, label) {
    if (!filteredCount) return `Hiển thị 0 trong tổng số ${totalCount} ${label}`;
    return `Hiển thị 1 đến ${filteredCount} trong tổng số ${totalCount} ${label}`;
}

function getReceiptPageSize() {
    return typeof RECEIPT_PAGE_SIZE !== 'undefined' ? RECEIPT_PAGE_SIZE : 5;
}

function getReceiptPagedItems(filtered) {
    const pageSize = getReceiptPageSize();
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (receiptPage < 1) receiptPage = 1;
    if (receiptPage > totalPages) receiptPage = totalPages;

    const startIndex = (receiptPage - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
        items,
        page: receiptPage,
        pageSize,
        totalItems,
        totalPages,
        startItem: totalItems ? startIndex + 1 : 0,
        endItem: Math.min(startIndex + items.length, totalItems)
    };
}

function receiptFooterText(pageInfo) {
    if (!pageInfo.totalItems) return 'Hiển thị 0 trong tổng số 0 biên lai';
    return `Hiển thị ${pageInfo.startItem} đến ${pageInfo.endItem} trong tổng số ${pageInfo.totalItems} biên lai`;
}

function renderReceiptPager(pageInfo) {
    if (pageInfo.totalItems <= pageInfo.pageSize) return '';
    return `
        <div class="invoice-pager receipt-pager">
            <button type="button" data-receipt-page="${pageInfo.page - 1}" ${pageInfo.page <= 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>
            <strong>${escapeText(String(pageInfo.page))}</strong>
            <button type="button" data-receipt-page="${pageInfo.page + 1}" ${pageInfo.page >= pageInfo.totalPages ? 'disabled' : ''} aria-label="Trang sau">›</button>
        </div>`;
}

function getInvoicePeriodTotal(invoices, receipts) {
    const items = [...invoices, ...receipts];
    const periods = new Set(items.map(item => String(item?.period || '').trim()).filter(Boolean));
    const withoutPeriod = items.filter(item => !String(item?.period || '').trim()).length;
    return periods.size + withoutPeriod;
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

async function downloadInvoice(inv) {
    if (!inv) return;
    const safeCode = String(getInvoiceDisplayCode(inv) || inv.period || inv.id).replace(/[^\w-]+/g, '-');
    try {
        if (document.fonts?.ready) await document.fonts.ready;
        const blob = await createCanvasPdfBlob(drawInvoicePdfCanvas(inv));
        saveBlob(blob, `hoa-don-${safeCode}.pdf`);
    } catch (error) {
        console.error('downloadInvoice PDF error:', error);
        showToast('Không thể tạo file PDF hóa đơn.', true);
    }
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
    const safeCode = String(receipt.receiptCode || invoiceId).replace(/[^\w-]+/g, '-');
    try {
        if (document.fonts?.ready) await document.fonts.ready;
        const blob = await createCanvasPdfBlob(drawReceiptPdfCanvas(receipt));
        saveBlob(blob, `bien-lai-${safeCode}.pdf`);
    } catch (error) {
        console.error('downloadReceipt PDF error:', error);
        showToast('Không thể tạo file PDF biên lai.', true);
    }
}

function drawReceiptPdfCanvas(receipt) {
    const canvas = createPdfCanvas();
    const ctx = canvas.getContext('2d');
    const amount = receipt.paidAmount ?? receipt.totalAmount;

    preparePdfPage(ctx, canvas);
    drawPdfHeader(ctx, 'CHI TIẾT\nBIÊN LAI', 'Thanh toán thành công');
    drawPdfField(ctx, 155, 'Mã biên lai', `#${getReceiptDisplayCode(receipt)}`, { hero: true, valueColor: '#00a651' });

    let y = 290;
    y = drawPdfField(ctx, y, 'Kỳ thanh toán', formatReceiptPeriod(receipt.period));
    y = drawPdfField(ctx, y, 'Phòng', receipt.roomCode || '—');
    y = drawPdfField(ctx, y, 'Ngày thanh toán', formatReceiptDateTime(receipt.paidAt));
    y = drawPdfField(ctx, y, 'Phương thức', getReceiptPaymentMethod(receipt));
    y = drawPdfField(ctx, y, 'Mã giao dịch', receipt.transactionCode || '—');
    y = drawPdfField(ctx, y, 'Trạng thái', 'Thanh toán thành công', { badge: true });

    drawPdfDivider(ctx, y + 18);
    drawPdfSectionTitle(ctx, y + 70, 'CHI TIẾT THANH TOÁN');
    let detailY = y + 135;
    detailY = drawPdfField(ctx, detailY, 'Tiền phòng', formatCurrency(receipt.roomFee));
    detailY = drawPdfField(ctx, detailY, 'Tiền điện', formatCurrency(receipt.electricFee));
    detailY = drawPdfField(ctx, detailY, 'Tiền nước', formatCurrency(receipt.waterFee));
    drawPdfDivider(ctx, detailY + 10, '#dce6f2');
    drawPdfTotal(ctx, detailY + 80, 'Tổng cộng', formatCurrency(amount));

    return canvas;
}

function drawInvoicePdfCanvas(inv) {
    const canvas = createPdfCanvas();
    const ctx = canvas.getContext('2d');
    const status = invoiceStatusMeta(inv.status);
    const isPaid = normalizeInvoiceStatus(inv.status) === 'Paid';
    const statusText = status.label || 'Chưa thanh toán';

    preparePdfPage(ctx, canvas);
    drawPdfHeader(ctx, 'CHI TIẾT\nHÓA ĐƠN', statusText, isPaid ? '#dcf8e8' : '#fff3d6', isPaid ? '#009b4e' : '#d97706');
    drawPdfField(ctx, 155, 'Mã hóa đơn', `#${getInvoiceDisplayCode(inv)}`, { hero: true, valueColor: '#0067e8' });

    let y = 290;
    y = drawPdfField(ctx, y, 'Kỳ thanh toán', formatReceiptPeriod(inv.period));
    y = drawPdfField(ctx, y, 'Phòng', inv.roomCode || '—');
    y = drawPdfField(ctx, y, 'Ngày phát hành', formatDate(inv.issuedAt));
    y = drawPdfField(ctx, y, 'Hạn thanh toán', invoiceDueDateText(inv));
    y = drawPdfField(ctx, y, 'Trạng thái', statusText, {
        badge: true,
        badgeBg: isPaid ? '#dcf8e8' : '#fff3d6',
        badgeColor: isPaid ? '#009b4e' : '#d97706'
    });

    drawPdfDivider(ctx, y + 18);
    drawPdfSectionTitle(ctx, y + 70, 'CHI TIẾT THANH TOÁN');
    let detailY = y + 135;
    detailY = drawPdfField(ctx, detailY, 'Tiền phòng', formatCurrency(inv.roomFee));
    detailY = drawPdfField(ctx, detailY, 'Tiền điện', formatCurrency(inv.electricFee));
    detailY = drawPdfField(ctx, detailY, 'Tiền nước', formatCurrency(inv.waterFee));
    drawPdfDivider(ctx, detailY + 10, '#dce6f2');
    drawPdfTotal(ctx, detailY + 80, 'Tổng cộng', formatCurrency(inv.totalAmount));

    return canvas;
}

function createPdfCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 794;
    canvas.height = 1123;
    return canvas;
}

function preparePdfPage(ctx, canvas) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'alphabetic';
}

function pdfFont(weight, size) {
    return `${weight} ${size}px "Be Vietnam Pro", Arial, sans-serif`;
}

function drawPdfHeader(ctx, title, badgeText, badgeBg = '#dcf8e8', badgeColor = '#009b4e') {
    ctx.fillStyle = '#002b5c';
    ctx.font = pdfFont(900, 34);
    const titleLines = title.split('\n');
    titleLines.forEach((line, index) => ctx.fillText(line, 60, 74 + index * 42));

    const badgeWidth = Math.max(260, ctx.measureText(badgeText).width + 58);
    drawRoundRect(ctx, 740 - badgeWidth, 42, badgeWidth, 68, 16, badgeBg);
    ctx.fillStyle = badgeColor;
    ctx.font = pdfFont(800, 21);
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, 740 - badgeWidth / 2, 84);
    ctx.textAlign = 'left';
}

function drawPdfField(ctx, y, label, value, options = {}) {
    ctx.fillStyle = '#4d5f7f';
    ctx.font = pdfFont(500, options.hero ? 22 : 23);
    ctx.fillText(label, 60, y);

    if (options.hero) {
        ctx.fillStyle = options.valueColor || '#00a651';
        ctx.font = pdfFont(900, 40);
        ctx.fillText(value || '—', 60, y + 68);
        return y + 125;
    }

    if (options.badge) {
        const text = value || '—';
        ctx.font = pdfFont(800, 21);
        const width = Math.max(280, ctx.measureText(text).width + 54);
        drawRoundRect(ctx, 740 - width, y - 32, width, 64, 15, options.badgeBg || '#dcf8e8');
        ctx.fillStyle = options.badgeColor || '#009b4e';
        ctx.textAlign = 'center';
        ctx.fillText(text, 740 - width / 2, y + 8);
        ctx.textAlign = 'left';
        return y + 80;
    }

    ctx.fillStyle = '#002b5c';
    ctx.font = pdfFont(900, 28);
    ctx.textAlign = 'right';
    ctx.fillText(value || '—', 740, y);
    ctx.textAlign = 'left';
    return y + 80;
}

function drawPdfDivider(ctx, y, color = '#cbd7e6') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(740, y);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawPdfSectionTitle(ctx, y, title) {
    ctx.fillStyle = '#002b5c';
    ctx.font = pdfFont(900, 27);
    ctx.fillText(title, 60, y);
}

function drawPdfTotal(ctx, y, label, value) {
    ctx.fillStyle = '#002b5c';
    ctx.font = pdfFont(900, 27);
    ctx.fillText(label, 60, y);
    ctx.fillStyle = '#0067e8';
    ctx.font = pdfFont(900, 32);
    ctx.textAlign = 'right';
    ctx.fillText(value || '—', 740, y);
    ctx.textAlign = 'left';
}

function drawRoundRect(ctx, x, y, width, height, radius, fillStyle) {
    ctx.fillStyle = fillStyle;
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.fill();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

async function createCanvasPdfBlob(canvas) {
    if (document.fonts?.ready) await document.fonts.ready;
    const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Cannot render PDF image')), 'image/jpeg', 0.96);
    });
    const bytes = new Uint8Array(await imageBlob.arrayBuffer());
    return createImagePdfBlob(bytes, 595, 842);
}

function createImagePdfBlob(imageBytes, pageWidth, pageHeight) {
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [0];
    let length = 0;
    const addText = text => {
        const bytes = encoder.encode(text);
        parts.push(bytes);
        length += bytes.length;
    };
    const addBytes = bytes => {
        parts.push(bytes);
        length += bytes.length;
    };
    const addObject = (index, writeBody) => {
        offsets.push(length);
        addText(`${index} 0 obj\n`);
        writeBody();
        addText('\nendobj\n');
    };

    addText('%PDF-1.4\n');
    addObject(1, () => addText('<< /Type /Catalog /Pages 2 0 R >>'));
    addObject(2, () => addText('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    addObject(3, () => addText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    addObject(4, () => {
        addText(`<< /Type /XObject /Subtype /Image /Width 794 /Height 1123 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
        addBytes(imageBytes);
        addText('\nendstream');
    });
    addObject(5, () => addText(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));

    const xrefOffset = length;
    addText(`xref\n0 6\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(offset => {
        addText(`${String(offset).padStart(10, '0')} 00000 n \n`);
    });
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
}

function renderReceiptDetail(receipt) {
    const id = getInvoiceRecordId(receipt);
    const amount = receipt.paidAmount ?? receipt.totalAmount;
    const statusPill = '<span class="invoice-status is-paid receipt-success-status">Thanh toán thành công</span>';

    return `
        <aside class="invoice-detail-card receipt-detail-card">
            <div class="invoice-detail-head">
                <h3>CHI TIẾT BIÊN LAI</h3>
                ${statusPill}
            </div>
            <div class="receipt-detail-code">
                <span>Mã biên lai</span>
                <strong>${escapeText(getReceiptDisplayCode(receipt))}</strong>
            </div>
            <div class="invoice-detail-list receipt-detail-list">
                <div class="inv-detail-row"><span>Kỳ thanh toán</span><strong>${escapeText(formatReceiptPeriod(receipt.period))}</strong></div>
                <div class="inv-detail-row"><span>Phòng</span><strong>${escapeText(receipt.roomCode || '—')}</strong></div>
                <div class="inv-detail-row"><span>Ngày thanh toán</span><strong>${escapeText(formatReceiptDateTime(receipt.paidAt))}</strong></div>
                <div class="inv-detail-row"><span>Phương thức</span><strong>${escapeText(getReceiptPaymentMethod(receipt))}</strong></div>
                <div class="inv-detail-row"><span>Mã giao dịch</span><strong>${escapeText(receipt.transactionCode || '—')}</strong></div>
                <div class="inv-detail-row"><span>Trạng thái</span><strong>${statusPill}</strong></div>
            </div>
            <div class="invoice-payment-detail">
                <h4>CHI TIẾT THANH TOÁN</h4>
                <div class="inv-detail-row"><span>Tiền phòng</span><strong>${escapeText(formatCurrency(receipt.roomFee))}</strong></div>
                <div class="inv-detail-row"><span>Tiền điện</span><strong>${escapeText(formatCurrency(receipt.electricFee))}</strong></div>
                <div class="inv-detail-row"><span>Tiền nước</span><strong>${escapeText(formatCurrency(receipt.waterFee))}</strong></div>
            </div>
            <div class="invoice-total-line">
                <span>Tổng cộng</span>
                <strong>${escapeText(formatCurrency(amount))}</strong>
            </div>
            <div class="invoice-detail-actions">
                <button type="button" class="invoice-detail-download" data-receipt-download="${id}"><span class="inv-dl-icon"></span>Tải biên lai</button>
            </div>
        </aside>`;
}

function renderInvoiceDetail(inv) {
    const isReceiptTab = invoiceActiveTab === 'receipt';
    if (!inv) {
        return `
            <aside class="invoice-detail-card">
                <div class="invoice-detail-empty">${isReceiptTab ? 'Chưa có biên lai để xem chi tiết.' : 'Chọn một hóa đơn để xem chi tiết.'}</div>
            </aside>`;
    }

    if (isReceiptTab) return renderReceiptDetail(inv);

    const id = getInvoiceRecordId(inv);
    const title = 'CHI TIẾT HÓA ĐƠN';
    const amount = inv.paidAmount ?? inv.totalAmount;

    const invoiceMeta = `
        <div class="inv-detail-row"><span>Ma hoa don</span><strong>${escapeText(getInvoiceDisplayCode(inv))}</strong></div>
        <div class="inv-detail-row"><span>Sinh viên</span><strong>${escapeText(inv.studentName || '—')}</strong></div>
        <div class="inv-detail-row"><span>Ngày phát hành</span><strong>${escapeText(formatDate(inv.issuedAt))}</strong></div>
        <div class="inv-detail-row"><span>Hạn thanh toán</span><strong class="${isInvoiceUnpaid(inv) ? 'is-danger' : ''}">${escapeText(invoiceDueDateText(inv))}</strong></div>
        <div class="inv-detail-row"><span>Trạng thái</span><strong>${invoiceStatusPill(inv.status)}</strong></div>`;

    return `
        <aside class="invoice-detail-card">
            <div class="invoice-detail-head">
                <h3>${title}</h3>
                ${invoiceStatusPill(inv.status)}
            </div>
            <div class="invoice-detail-period">
                <span>Kỳ thanh toán</span>
                <strong>${escapeText(inv.period || '—')}</strong>
            </div>
            <div class="invoice-detail-list">
                <div class="inv-detail-row"><span>Phòng</span><strong>${escapeText(inv.roomCode || '—')}</strong></div>
                ${invoiceMeta}
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
                <button type="button" class="invoice-detail-pay" data-inv-id="${id}"><span class="inv-pay-icon"></span>Thanh toán ngay</button>
                <button type="button" class="invoice-detail-download" data-invoice-download="${id}"><span class="inv-dl-icon"></span>Tải hóa đơn</button>
            </div>
        </aside>`;
}

function renderInvoiceRows(filtered) {
    if (invoiceActiveTab === 'receipt') {
        return filtered.map(receipt => {
            const id = getInvoiceRecordId(receipt);
            const selected = id === Number(selectedInvoiceId);
            const paidAt = getDateTimeParts(receipt.paidAt);
            return `
                <tr class="${selected ? 'is-selected' : ''}" data-invoice-row="${id}">
                    <td>
                        <div class="receipt-period-cell">
                            <span class="receipt-doc-icon"></span>
                            <div>
                                <strong>${escapeText(formatReceiptPeriod(receipt.period))}</strong>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="receipt-code-cell">
                            <strong>${escapeText(getReceiptDisplayCode(receipt))}</strong>
                            <small>Biên lai điện tử</small>
                        </div>
                    </td>
                    <td>
                        <span class="receipt-date-cell">
                            <strong>${escapeText(paidAt.date)}</strong>
                            <small>${escapeText(paidAt.time)}</small>
                        </span>
                    </td>
                    <td>${getReceiptMethodBadge(receipt)}</td>
                    <td><strong class="receipt-amount">${escapeText(formatCurrency(receipt.paidAmount ?? receipt.totalAmount))}</strong></td>
                    <td><span class="receipt-transaction-code">${escapeText(receipt.transactionCode || '—')}</span></td>
                    <td>
                        <div class="receipt-actions">
                            <button type="button" class="receipt-view-btn" data-invoice-select="${id}" title="Xem chi tiết"><span class="receipt-eye-icon"></span>Xem</button>
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
                <td><div class="invoice-row-actions">${invoiceActionButtons(inv)}</div></td>
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

function renderReceiptMonthOptions() {
    return [
        '<option value="">Tất cả tháng</option>',
        ...getReceiptMonthOptions().map(key => `<option value="${escapeText(key)}">${escapeText(getReceiptMonthLabel(key))}</option>`)
    ].join('');
}

function renderReceiptCardDetail(receipt) {
    const amount = receipt.paidAmount ?? receipt.totalAmount;
    return `
        <div class="receipt-card-detail">
            <div><span>Phòng</span><strong>${escapeText(receipt.roomCode || '—')}</strong></div>
            <div><span>Tiền phòng</span><strong>${escapeText(formatCurrency(receipt.roomFee))}</strong></div>
            <div><span>Tiền điện</span><strong>${escapeText(formatCurrency(receipt.electricFee))}</strong></div>
            <div><span>Tiền nước</span><strong>${escapeText(formatCurrency(receipt.waterFee))}</strong></div>
            <div><span>Tổng cộng</span><strong>${escapeText(formatCurrency(amount))}</strong></div>
        </div>`;
}

function renderReceiptCards(filtered) {
    if (!filtered.length) {
        return '<div class="receipt-card-empty">Chưa có biên lai phù hợp.</div>';
    }

    return filtered.map(receipt => {
        const id = getInvoiceRecordId(receipt);
        const selected = id === Number(selectedInvoiceId);
        const paidAt = getDateTimeParts(receipt.paidAt);
        const amount = receipt.paidAmount ?? receipt.totalAmount;
        return `
            <article class="receipt-card-item ${selected ? 'is-selected' : ''}" data-receipt-card="${id}">
                <div class="receipt-card-period">
                    <span class="receipt-doc-icon"></span>
                    <div>
                        <strong>${escapeText(formatReceiptPeriod(receipt.period))}</strong>
                        <span>Kỳ thanh toán</span>
                    </div>
                </div>
                <div class="receipt-card-code">
                    <strong>${escapeText(getReceiptDisplayCode(receipt))}</strong>
                    <span><i class="receipt-calendar-icon"></i>${escapeText(paidAt.date)}<b>•</b>${escapeText(paidAt.time)}</span>
                    ${getReceiptMethodBadge(receipt)}
                </div>
                <div class="receipt-card-payment">
                    <strong>${escapeText(formatCurrency(amount))}</strong>
                    ${receiptSuccessBadge()}
                    <span>Mã giao dịch: <b>${escapeText(receipt.transactionCode || '—')}</b></span>
                </div>
                <div class="receipt-card-actions">
                    <button type="button" class="receipt-view-btn" data-receipt-view="${id}" title="Xem chi tiết"><span class="receipt-eye-icon"></span>Xem</button>
                    <button type="button" class="invoice-dl-btn" data-receipt-download="${id}" title="Tải biên lai PDF"><span class="inv-dl-icon"></span>Tải PDF</button>
                </div>
            </article>`;
    }).join('');
}

function formatInvoicePeriodShort(period) {
    const parsed = parseInvoicePeriod(period);
    if (!parsed) return String(period || '—');
    return `${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
}

function renderInvoiceInfoNote() {
    return `
        <div class="invoice-info-note">
            <span class="invoice-info-icon">i</span>
            <div>
                <strong>Thông tin</strong>
                <p>Hóa đơn sẽ được tạo vào ngày 15 hằng tháng và có hiệu lực trong 30 ngày kể từ ngày phát hành.</p>
            </div>
            <span class="invoice-info-calendar"></span>
        </div>`;
}

function renderInvoiceCards(filtered) {
    if (!filtered.length) {
        return '<div class="receipt-card-empty">Không có hóa đơn phù hợp.</div>';
    }

    return filtered.map(inv => {
        const id = getInvoiceRecordId(inv);
        const selected = id === Number(selectedInvoiceId);
        const issuedAt = getDateTimeParts(inv.issuedAt);
        const dueSubText = invoiceDueDateSubText(inv);
        const dueDanger = dueSubText.startsWith('Quá hạn') || dueSubText.startsWith('Đến hạn');
        return `
            <article class="invoice-card-item ${selected ? 'is-selected' : ''}" data-invoice-row="${id}">
                <div class="invoice-card-period">
                    <span class="invoice-card-doc-icon"></span>
                    <div>
                        <strong>${escapeText(getInvoiceDisplayCode(inv))}</strong>
                        <span>Kỳ ${escapeText(formatInvoicePeriodShort(inv.period))}</span>
                        <em>${escapeText(inv.roomCode || '—')} - Phòng</em>
                    </div>
                </div>
                <div class="invoice-card-meta">
                    <span class="invoice-card-title"><i class="invoice-card-calendar-icon"></i>Ngày phát hành</span>
                    <strong>${escapeText(issuedAt.date)}</strong>
                    <small>${escapeText(issuedAt.time)}</small>
                </div>
                <div class="invoice-card-meta">
                    <span class="invoice-card-title"><i class="invoice-card-clock-icon"></i>Hạn thanh toán</span>
                    <strong class="${dueDanger ? 'is-danger' : ''}">${escapeText(invoiceDueDateText(inv))}</strong>
                    ${dueSubText ? `<small class="${dueDanger ? 'is-danger' : ''}">${escapeText(dueSubText)}</small>` : ''}
                </div>
                <div class="invoice-card-amount">
                    <span>Số tiền</span>
                    <strong>${escapeText(formatCurrency(inv.totalAmount))}</strong>
                </div>
                <div class="invoice-card-status">
                    ${invoiceStatusPill(inv.status)}
                </div>
                <div class="invoice-card-actions">
                    <button type="button" class="invoice-pay-btn" data-inv-id="${id}"><span class="inv-pay-icon"></span>Thanh toán ngay</button>
                    <button type="button" class="invoice-dl-btn" data-invoice-download="${id}" title="Tải hóa đơn"><span class="inv-dl-icon"></span>Tải hóa đơn</button>
                </div>
            </article>`;
    }).join('');
}

function bindInvoiceTabs(el) {
    el.querySelectorAll('[data-invoice-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            invoiceActiveTab = btn.dataset.invoiceTab || 'invoice';
            invoiceStatusFilter = '';
            invoiceSearchTerm = '';
            if (invoiceSearchDebounceTimer) {
                clearTimeout(invoiceSearchDebounceTimer);
                invoiceSearchDebounceTimer = null;
            }
            receiptMethodFilter = '';
            receiptDateFrom = '';
            receiptDateTo = '';
            receiptMonthFilter = '';
            receiptPage = 1;
            selectedInvoiceId = getActiveInvoiceItems()[0]
                ? getInvoiceRecordId(getActiveInvoiceItems()[0])
                : null;
            renderInvoiceDashboard();
        });
    });
}

function unusedRenderReceiptDashboard(el, filtered, activeItems) {
    selectedInvoiceId = filtered.some(item => getInvoiceRecordId(item) === Number(selectedInvoiceId)) ? selectedInvoiceId : null;

    el.innerHTML = `
        <div class="invoice-dashboard receipt-card-dashboard">
            <section class="invoice-list-card receipt-list-card">
                <div class="invoice-tabs">
                    <button type="button" class="${invoiceActiveTab === 'invoice' ? 'active' : ''}" data-invoice-tab="invoice">Hóa đơn</button>
                    <button type="button" class="${invoiceActiveTab === 'receipt' ? 'active' : ''}" data-invoice-tab="receipt">Biên lai</button>
                </div>
                <div class="receipt-page-head">
                    <div>
                        <h2>Biên lai thanh toán</h2>
                        <p>Lịch sử các giao dịch thanh toán thành công</p>
                    </div>
                    <div class="receipt-page-tools">
                        <label class="invoice-search receipt-search">
                            <input id="invoice-search" type="search" placeholder="Tìm kiếm mã biên lai, mã giao dịch..." value="${escapeText(invoiceSearchTerm)}">
                            <span></span>
                        </label>
                        <label class="receipt-month-select">
                            <span class="receipt-calendar-icon"></span>
                            <select id="receipt-month-filter" aria-label="Lọc theo tháng">${renderReceiptMonthOptions()}</select>
                        </label>
                        ${invoiceActiveTab === 'receipt'
                            ? `<label class="receipt-month-select">
                                <span class="receipt-calendar-icon"></span>
                                <select id="receipt-month-filter" aria-label="Lọc theo tháng">${renderReceiptMonthOptions()}</select>
                            </label>`
                            : ''}
                    </div>
                </div>
                <div class="receipt-count-summary">
                    <span class="receipt-count-icon"></span>
                    <div>
                        <span>Tổng số biên lai</span>
                        <strong>${escapeText(String(activeItems.length))} biên lai</strong>
                    </div>
                </div>
                <div class="receipt-card-list">${renderReceiptCards(filtered)}</div>
                <div class="invoice-footer receipt-card-footer">
                    <span>${escapeText(invoiceFooterText(filtered.length, activeItems.length, 'biên lai'))}</span>
                </div>
            </section>
        </div>`;

    const monthFilter = document.getElementById('receipt-month-filter');
    if (monthFilter) monthFilter.value = '';
    const searchInput = document.getElementById('invoice-search');
    searchInput?.addEventListener('input', event => {
        invoiceSearchTerm = event.target.value || '';
        if (invoiceActiveTab === 'receipt') receiptPage = 1;
        queueInvoiceSearchRender(event.target);
    });
    searchInput?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        invoiceSearchTerm = event.target.value || '';
        flushInvoiceSearchRender(event.target);
    });
    monthFilter?.addEventListener('change', event => {
        const ignoredReceiptMonthFilter = event.target.value || '';
        selectedInvoiceId = null;
        renderInvoiceDashboard();
    });
    bindInvoiceTabs(el);
    el.querySelectorAll('[data-receipt-view]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const id = Number(btn.dataset.receiptView);
            selectedInvoiceId = selectedInvoiceId === id ? null : id;
            renderInvoiceDashboard();
        });
    });
    el.querySelectorAll('[data-receipt-card]').forEach(card => {
        card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            selectedInvoiceId = Number(card.dataset.receiptCard);
            renderInvoiceDashboard();
        });
    });
    el.querySelectorAll('[data-receipt-download]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const receipt = currentReceipts.find(item => getInvoiceRecordId(item) === Number(btn.dataset.receiptDownload));
            downloadReceipt(receipt);
        });
    });
    el.querySelectorAll('[data-receipt-page]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const nextPage = Number(btn.dataset.receiptPage);
            const totalPages = Math.max(1, Math.ceil(filtered.length / getReceiptPageSize()));
            if (!nextPage || nextPage < 1 || nextPage > totalPages) return;
            receiptPage = nextPage;
            renderInvoiceDashboard();
        });
    });
}

function renderInvoiceDashboard(options = {}) {
    const el = document.getElementById('invoice-content');
    if (!el) return;

    const paidTotal = currentReceipts.reduce((sum, inv) => sum + Number(inv.paidAmount ?? inv.totalAmount ?? 0), 0);
    const unpaidTotal = currentInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const debtInvoices = currentInvoices.filter(isInvoiceDueThisCycle);
    const debtTotal = debtInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const totalPeriods = getInvoicePeriodTotal(currentInvoices, currentReceipts);
    const activeItems = getActiveInvoiceItems();
    const filtered = getFilteredInvoices();
    const receiptPageInfo = invoiceActiveTab === 'receipt' ? getReceiptPagedItems(filtered) : null;
    const visibleItems = receiptPageInfo ? receiptPageInfo.items : filtered;

    const selectedInvoice = getSelectedInvoice(visibleItems);
    selectedInvoiceId = selectedInvoice ? getInvoiceRecordId(selectedInvoice) : null;

    const totalPayable = paidTotal + unpaidTotal;
    const summaryCountLabel = invoiceActiveTab === 'receipt' ? 'Tổng biên lai' : 'Tổng hóa đơn';
    const summaryCountValue = invoiceActiveTab === 'receipt' ? String(currentReceipts.length) : String(totalPeriods);
    const summaryCountHint = invoiceActiveTab === 'receipt' ? `${currentReceipts.length} biên lai` : `${Math.max(totalPeriods, 0)} kỳ`;
    const summaryCountIcon = invoiceActiveTab === 'receipt' ? 'invoice-icon-receipt' : 'invoice-icon-count';
    const paidHint = invoiceActiveTab === 'receipt' ? `${currentReceipts.length} biên lai` : `${currentReceipts.length} giao dịch`;
    const rows = invoiceActiveTab === 'receipt' ? renderReceiptCards(visibleItems) : renderInvoiceCards(visibleItems);
    const emptyLabel = invoiceActiveTab === 'receipt' ? 'Chưa có biên lai nào.' : 'Không có hóa đơn chưa thanh toán.';
    const activeLabel = invoiceActiveTab === 'receipt' ? 'biên lai' : 'hóa đơn';
    const alertMessage = invoiceActiveTab === 'receipt'
        ? 'Các khoản đã thanh toán sẽ được lưu tại biên lai để bạn tra cứu và tải lại khi cần.'
        : 'Các hóa đơn chưa thanh toán. Vui lòng thanh toán trước hạn để tránh phát sinh phí trễ hạn.';

    el.innerHTML = `
        <div class="invoice-dashboard ${invoiceActiveTab === 'receipt' ? 'is-receipt' : 'is-invoice'}">
            <div class="invoice-main-column">
                <section class="invoice-overview-card">
                    <div class="invoice-summary-grid">
                        ${invoiceSummaryCard('invoice-icon-total', 'tone-blue', 'Tổng phải thanh toán', formatCurrency(totalPayable), `${currentInvoices.length + currentReceipts.length} hóa đơn`)}
                        ${invoiceSummaryCard('invoice-icon-paid', 'tone-green', 'Đã thanh toán', formatCurrency(paidTotal), paidHint)}
                        ${invoiceSummaryCard('invoice-icon-debt', 'tone-orange', 'Còn nợ', formatCurrency(debtTotal), `${debtInvoices.length} hóa đơn`)}
                        ${invoiceSummaryCard(summaryCountIcon, 'tone-purple', summaryCountLabel, summaryCountValue, summaryCountHint)}
                    </div>
                </section>

                <section class="invoice-list-card">
                    <div class="invoice-tabs">
                        <button type="button" class="${invoiceActiveTab === 'invoice' ? 'active' : ''}" data-invoice-tab="invoice">Hóa đơn</button>
                        <button type="button" class="${invoiceActiveTab === 'receipt' ? 'active' : ''}" data-invoice-tab="receipt">Biên lai</button>
                    </div>
                    ${invoiceActiveTab === 'invoice'
                        ? `<div class="invoice-alert"><strong>i</strong><span>${escapeText(alertMessage)}</span></div>`
                        : ''}
                    ${invoiceActiveTab === 'receipt'
                        ? `<div class="invoice-toolbar">
                            <label class="invoice-search">
                                <input id="invoice-search" type="search" placeholder="Tìm kiếm biên lai, mã giao dịch..." value="${escapeText(invoiceSearchTerm)}">
                                <span></span>
                            </label>
                            <label class="receipt-month-select">
                                <span class="receipt-calendar-icon"></span>
                                <select id="receipt-month-filter" aria-label="Lọc theo tháng">${renderReceiptMonthOptions()}</select>
                            </label>
                        </div>`
                        : ''}
                    <div class="invoice-table-wrap ${invoiceActiveTab === 'receipt' ? 'receipt-table-card-wrap' : 'invoice-card-wrap'}">
                        ${invoiceActiveTab === 'receipt'
                            ? `<div class="receipt-table-card-list">${rows || `<div class="receipt-card-empty">${emptyLabel}</div>`}</div>`
                            : `<div class="invoice-card-list">${rows || `<div class="receipt-card-empty">${emptyLabel}</div>`}</div>
                               ${renderInvoiceInfoNote()}`}
                    </div>
                    <div class="invoice-footer">
                        <span>${escapeText(receiptPageInfo ? receiptFooterText(receiptPageInfo) : invoiceFooterText(filtered.length, activeItems.length, activeLabel))}</span>
                        ${receiptPageInfo ? renderReceiptPager(receiptPageInfo) : ''}
                    </div>
                </section>
            </div>
            ${renderInvoiceDetail(selectedInvoice)}
        </div>`;

    const statusFilter = document.getElementById('invoice-status-filter');
    if (statusFilter) statusFilter.value = invoiceStatusFilter;
    const monthFilter = document.getElementById('receipt-month-filter');
    if (monthFilter) monthFilter.value = receiptMonthFilter;
    const searchInput = document.getElementById('invoice-search');
    searchInput?.addEventListener('input', event => {
        invoiceSearchTerm = event.target.value || '';
        queueInvoiceSearchRender(event.target);
    });
    searchInput?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        invoiceSearchTerm = event.target.value || '';
        flushInvoiceSearchRender(event.target);
    });
    statusFilter?.addEventListener('change', event => {
        if (invoiceSearchDebounceTimer) {
            clearTimeout(invoiceSearchDebounceTimer);
            invoiceSearchDebounceTimer = null;
        }
        invoiceStatusFilter = event.target.value || '';
        renderInvoiceDashboard();
    });
    monthFilter?.addEventListener('change', event => {
        if (invoiceSearchDebounceTimer) {
            clearTimeout(invoiceSearchDebounceTimer);
            invoiceSearchDebounceTimer = null;
        }
        receiptMonthFilter = event.target.value || '';
        receiptPage = 1;
        renderInvoiceDashboard();
    });
    if (options.focusSearch && searchInput) {
        searchInput.focus({ preventScroll: true });
        const start = Math.min(searchInput.value.length, Number(options.searchSelectionStart ?? searchInput.value.length));
        const end = Math.min(searchInput.value.length, Number(options.searchSelectionEnd ?? start));
        try {
            searchInput.setSelectionRange(start, end);
        } catch (_) {
            // Some browsers can ignore selection on search inputs.
        }
    }
    bindInvoiceTabs(el);
    el.querySelectorAll('[data-invoice-row], [data-invoice-select]').forEach(node => {
        node.addEventListener('click', event => {
            const id = node.dataset.invoiceRow || node.dataset.invoiceSelect;
            if (!id) return;
            event.stopPropagation();
            selectedInvoiceId = Number(id);
            renderInvoiceDashboard();
        });
    });
    el.querySelectorAll('[data-receipt-card], [data-receipt-view]').forEach(node => {
        node.addEventListener('click', event => {
            const id = node.dataset.receiptCard || node.dataset.receiptView;
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
    el.querySelectorAll('[data-receipt-page]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const nextPage = Number(btn.dataset.receiptPage);
            const totalPages = Math.max(1, Math.ceil(filtered.length / getReceiptPageSize()));
            if (!nextPage || nextPage < 1 || nextPage > totalPages) return;
            receiptPage = nextPage;
            renderInvoiceDashboard();
        });
    });
}

function sortInvoicesByDueDateAsc(items) {
    return [...items].sort((a, b) => {
        const dueA = getInvoiceDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const dueB = getInvoiceDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (dueA !== dueB) return dueA - dueB;

        const periodCompare = String(a.period || '').localeCompare(String(b.period || ''));
        if (periodCompare !== 0) return periodCompare;
        return getInvoiceRecordId(a) - getInvoiceRecordId(b);
    });
}

function sortReceiptsDesc(items) {
    return [...items].sort((a, b) => {
        const paidA = parseDateValue(a.paidAt || a.issuedAt).getTime() || 0;
        const paidB = parseDateValue(b.paidAt || b.issuedAt).getTime() || 0;
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

    currentInvoices = sortInvoicesByDueDateAsc(invoiceData.filter(isInvoiceUnpaid));
    currentReceipts = sortReceiptsDesc(receiptRes?.ok ? receiptData : invoiceData.filter(isInvoicePaid));

    invoiceActiveTab = options.initialTab || 'invoice';
    invoiceStatusFilter = '';
    invoiceSearchTerm = '';
    if (invoiceSearchDebounceTimer) {
        clearTimeout(invoiceSearchDebounceTimer);
        invoiceSearchDebounceTimer = null;
    }
    receiptMethodFilter = '';
    receiptDateFrom = '';
    receiptDateTo = '';
    receiptMonthFilter = '';
    receiptPage = 1;

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
    const confirmed = typeof showAppConfirm === 'function'
        ? await showAppConfirm({
            title: 'Thanh toán qua VNPAY',
            message: 'Bạn sẽ được chuyển sang cổng VNPAY để hoàn tất thanh toán hóa đơn này.',
            confirmText: 'Tiếp tục thanh toán',
            cancelText: 'Để sau',
            tone: 'payment'
        })
        : confirm('Bạn muốn thanh toán hóa đơn này qua VNPAY?');

    if (!confirmed) return;

    const returnPage = window.location.href.split('#')[0];
    const res = await callApi(`/payments/create-payment-url/${invoiceId}?returnPage=${encodeURIComponent(returnPage)}`, { method: 'POST' });
    if (res?.ok && res.data?.url) {
        window.location.href = res.data.url;
    } else {
        showToast(res?.data?.message || 'Không thể tạo link thanh toán.', true);
    }
}
// ======================================================================
