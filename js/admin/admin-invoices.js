function getInvoiceFilters() {
  return {
    period:
      document.getElementById("invoice-filter-period")?.value.trim() || "",
    status: document.getElementById("invoice-filter-status")?.value || "",
  };
}

function getActiveInvoicePeriod() {
  const filterPeriod = document
    .getElementById("invoice-filter-period")
    ?.value.trim();
  if (filterPeriod) return filterPeriod;
  return (
    document.getElementById("invoice-generate-period")?.value.trim() ||
    document.getElementById("invoice-import-period")?.value.trim() ||
    ""
  );
}

function bindInvoiceUploadDrop() {
  const fileInput = document.getElementById("invoice-import-file");
  const dropZone = document.querySelector(".invoice-upload-drop");
  const fileNameEl = dropZone?.querySelector("strong");
  if (!fileInput || !dropZone || !fileNameEl) return;

  const defaultText = fileNameEl.textContent;
  const updateFileName = () => {
    fileNameEl.textContent =
      fileInput.files?.[0]?.name || defaultText || "Chọn hoặc kéo thả file Excel vào đây";
  };

  fileInput.addEventListener("change", updateFileName);
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    updateFileName();
  });
}

function setInvoiceActionError(message = "") {
  const el = document.getElementById("invoice-action-error");
  if (el) el.textContent = message;
}

function bindInvoiceControls() {
  const importForm = document.getElementById("invoice-import-form");
  const generateForm = document.getElementById("invoice-generate-form");
  bindInvoiceUploadDrop();

  if (!document.getElementById("invoice-filter-period")?.value) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("invoice-filter-period").value = period;
    document.getElementById("invoice-import-period").value = period;
    document.getElementById("invoice-generate-period").value = period;
  }

  importForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("invoice-import-error");
    errorEl.textContent = "";

    const period = document
      .getElementById("invoice-import-period")
      .value.trim();
    const file = document.getElementById("invoice-import-file").files?.[0];

    if (!period) {
      errorEl.textContent = "Vui lòng nhập kỳ hóa đơn.";
      return;
    }
    if (!file) {
      errorEl.textContent = "Vui lòng chọn file Excel.";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await callApiUpload(
      `/invoices/import?period=${encodeURIComponent(period)}`,
      formData,
    );
    if (res?.ok) {
      adminToast(res.data?.message || "Đã import dữ liệu điện nước.");
      document.getElementById("invoice-filter-period").value = period;
      setInvoiceActionError("");
    } else {
      errorEl.textContent =
        res?.data?.message || "Không thể import file Excel.";
    }
  });

  generateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("invoice-generate-error");
    errorEl.textContent = "";

    const period = document
      .getElementById("invoice-generate-period")
      .value.trim();
    const electricPricePerKwh = Number(
      document.getElementById("invoice-electric-price").value,
    );
    const waterPricePerM3 = Number(
      document.getElementById("invoice-water-price").value,
    );

    if (!period) {
      errorEl.textContent = "Vui lòng nhập kỳ hóa đơn.";
      return;
    }
    if (!(electricPricePerKwh > 0) || !(waterPricePerM3 > 0)) {
      errorEl.textContent = "Gia dien va gia nu>c phai l>n hon 0.";
      return;
    }

    const res = await callApi("/invoices/generate", {
      method: "POST",
      body: JSON.stringify({ period, electricPricePerKwh, waterPricePerM3 }),
    });

    if (res?.ok) {
      adminToast(res.data?.message || "Đã tạo hóa đơn nháp.");
      document.getElementById("invoice-filter-period").value = period;
      loadInvoices();
    } else {
      errorEl.textContent = res?.data?.message || "Không thể tạo hóa đơn nháp.";
    }
  });

  const reloadFilteredInvoices = () => {
    resetPage("invoices");
    loadInvoices();
  };
  document
    .getElementById("invoice-filter-period")
    ?.addEventListener("input", reloadFilteredInvoices);
  document
    .getElementById("invoice-filter-status")
    ?.addEventListener("change", reloadFilteredInvoices);

  document
    .getElementById("publish-invoices-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      if (!period) {
        setInvoiceActionError("Vui lòng nhập kỳ hóa đơn trước khi phát hành.");
        return;
      }

      const res = await callApi(
        `/invoices/publish?period=${encodeURIComponent(period)}`,
        { method: "POST" },
      );
      if (res?.ok) {
        adminToast(res.data?.message || "Đã phát hành hóa đơn.");
        setInvoiceActionError("");
        loadInvoices();
      } else {
        setInvoiceActionError(
          res?.data?.message || "Không thể phát hành hóa đơn.",
        );
      }
    });

  document
    .getElementById("remind-debt-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      const query = period ? `?period=${encodeURIComponent(period)}` : "";
      const res = await callApi(`/invoices/remind-debt${query}`, {
        method: "POST",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã gửi nhắc nợ.");
        setInvoiceActionError("");
      } else {
        setInvoiceActionError(res?.data?.message || "Không thể gửi nhắc nợ.");
      }
    });

  document
    .getElementById("export-invoices-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      if (!period) {
        setInvoiceActionError("Vui lòng nhập kỳ hóa đơn trước khi xuất file.");
        return;
      }

      const res = await callApiBlob(
        `/invoices/export?period=${encodeURIComponent(period)}`,
      );
      if (!res?.ok || !res.blob) {
        setInvoiceActionError("Không thể xuất file hóa đơn.");
        return;
      }

      const url = URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HoaDon_${period}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      adminToast("Đã xuất file Excel hóa đơn.");
      setInvoiceActionError("");
    });
}

//7. Hoa don
async function loadInvoices() {
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="10" class="table-empty">Đang tải danh sách hóa đơn...</td></tr>';
  setInvoiceActionError("");

  const filters = getInvoiceFilters();
  const state = paginationState.invoices;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (filters.period) query.set("period", filters.period);
  if (filters.status) query.set("status", filters.status);

  const res = await callApi(`/invoices?${query.toString()}`);
  adminInvoices = applyServerPagination("invoices", res?.data);
  renderInvoicesTable();
}

function renderInvoicesTable() {
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "invoices",
    paginationState.invoices.totalItems || adminInvoices.length,
  );

  if (!adminInvoices.length) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="table-empty">Không có hóa đơn phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminInvoices
    .map(
      (invoice) => `
        <tr data-invoice-view="${invoice.id}" style="cursor: pointer;">
            <td class="invoice-code-cell">
              <span class="invoice-code-content">
                <span class="invoice-row-icon">${invoiceCodeIconSvg()}</span>
                <span class="invoice-code-text">${escapeHtml(getInvoiceDisplayCode(invoice))}</span>
              </span>
            </td>
            <td>${escapeHtml(invoice.period || "-")}</td>
            <td>${escapeHtml(invoice.roomCode || "-")}</td>
            <td>${escapeHtml(invoice.studentName || "-")}</td>
            <td class="invoice-money-cell">${escapeHtml(formatCurrency(invoice.electricFee))}</td>
            <td class="invoice-money-cell">${escapeHtml(formatCurrency(invoice.waterFee))}</td>
            <td class="invoice-money-cell">${escapeHtml(formatCurrency(invoice.roomFee))}</td>
            <td class="invoice-total-cell"><strong>${escapeHtml(formatCurrency(invoice.totalAmount))}</strong></td>
            <td>${invoiceStatusBadge(invoice.status)}</td>
            <td>${escapeHtml(formatDate(invoice.issuedAt))}</td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("tr[data-invoice-view]").forEach((row) => {
    row.addEventListener("click", async () => {
      const resDetail = await callApi(
        `/invoices/${row.dataset.invoiceView}`,
      );
      const invoice = resDetail?.data;
      if (!resDetail?.ok || !invoice) {
        adminToast(
          resDetail?.data?.message || "Không thể lấy chi tiết hóa đơn.",
          true,
        );
        return;
      }
      showInvoiceDetailModal(invoice);
    });
  });

  tbody.querySelectorAll("[data-invoice-pay]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resPay = await callApi(
          `/invoices/${button.dataset.invoicePay}/pay`,
          { method: "PUT" },
        );
        if (resPay?.ok) {
          adminToast(resPay.data?.message || "Đã cập nhật hóa đơn đã thanh toán.");
          loadInvoices();
        } else {
          adminToast(
            resPay?.data?.message || "Không thể cập nhật hóa đơn.",
            true,
          );
        }
      }),
    );
  });
}

function invoiceStatusLabel(status = "") {
  const value = String(status || "").toLowerCase();
  const labels = {
    draft: "Nháp",
    unpaid: "Chưa thanh toán",
    paid: "Đã thanh toán",
    cancelled: "Đã hủy",
    overdue: "Quá hạn",
  };
  return labels[value] || status || "Không rõ";
}

function getInvoiceDisplayCode(invoice) {
  if (invoice?.invoiceCode) return invoice.invoiceCode;
  const raw = String(invoice?.period || "").trim();
  let period = "";
  let match = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (match) period = `${match[1]}${String(Number(match[2])).padStart(2, "0")}`;
  match = period ? null : raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (match) period = `${match[2]}${String(Number(match[1])).padStart(2, "0")}`;
  if (!period) period = raw.replace(/[^\d]+/g, "") || "000000";
  const id = Number(invoice?.id || 0);
  return `HD-${period}-${String(id).padStart(6, "0")}`;
}

function invoiceStatusClass(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return "paid";
  if (value === "unpaid" || value === "overdue") return "unpaid";
  if (value === "cancelled") return "cancelled";
  return "draft";
}

function invoiceStatusBadge(status = "") {
  return `<span class="invoice-status-badge ${invoiceStatusClass(status)}">${escapeHtml(invoiceStatusLabel(status))}</span>`;
}

function invoiceCodeIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path><path d="M9 13h6"></path><path d="M9 17h4"></path></svg>`;
}

function showInvoiceDetailModal(invoice) {
  const overlay = ensureInvoiceDetailModal();
  const content = overlay.querySelector(".invoice-detail-card");
  const isPaid = String(invoice.status || "").toLowerCase() === "paid";
  const note = isPaid
    ? "Hóa đơn đã được thanh toán đầy đủ."
    : "Hóa đơn chưa được thanh toán. Vui lòng theo dõi hạn thanh toán.";

  content.innerHTML = `
    <button type="button" class="invoice-detail-close" aria-label="Dong">×</button>
    <header class="invoice-detail-head">
      <span class="invoice-detail-main-icon">${invoiceCodeIconSvg()}</span>
      <div>
        <h3>Chi tiết hóa đơn</h3>
        <p>${escapeHtml(getInvoiceDisplayCode(invoice))}</p>
      </div>
    </header>

    <section class="invoice-detail-summary">
      ${invoiceInfoTile("calendar", "Kỳ hóa đơn", invoice.period || "-")}
      ${invoiceInfoTile("room", "Phòng", invoice.roomCode || "-")}
      ${invoiceInfoTile("student", "Sinh viên", invoice.studentName || "-")}
      ${invoiceInfoTile("issued", "Ngày phát hành", formatDate(invoice.issuedAt))}
      ${invoiceInfoTile("due", "Hạn thanh toán", formatDate(invoice.dueDate))}
      ${invoiceInfoTile("status", "Trạng thái", invoiceStatusBadge(invoice.status), true)}
    </section>

    <section class="invoice-detail-section">
      <h4><span>${invoiceCodeIconSvg()}</span>Chi tiết thanh toán</h4>
      <div class="invoice-detail-lines">
        <div class="invoice-detail-line invoice-detail-line-head">
          <span>Nội dung</span>
          <span>Đơn giá</span>
          <span>Số lượng</span>
          <span>Thành tiền</span>
        </div>
        ${invoicePaymentLine("roomFee", "Tiền phòng", `Phí phòng tháng ${escapeHtml(invoice.period || "-")}`, invoice.roomFee, "1", invoice.roomFee)}
        ${invoicePaymentLine("electric", "Tiền điện", "Theo dữ liệu điện nước đã nhập", invoice.electricFee, "1", invoice.electricFee)}
        ${invoicePaymentLine("water", "Tiền nước", "Theo dữ liệu điện nước đã nhập", invoice.waterFee, "1", invoice.waterFee)}
        <div class="invoice-detail-total">
          <strong>Tổng tiền</strong>
          <strong>${escapeHtml(formatCurrency(invoice.totalAmount))}</strong>
        </div>
      </div>
    </section>

    <section class="invoice-detail-note">
      <h4><span>▣</span>Ghi chú</h4>
      <p>${escapeHtml(note)}</p>
    </section>

    <footer class="invoice-detail-footer">
      ${
        isPaid
          ? '<button type="button" class="secondary-btn" data-invoice-detail-close>Đóng</button>'
          : `<button type="button" class="primary-btn invoice-cash-pay-btn" data-invoice-cash-pay="${escapeHtml(invoice.id)}">Xác nhận thu tiền mặt</button>
             <button type="button" class="secondary-btn" data-invoice-detail-close>Đóng</button>`
      }
    </footer>

  `;

  overlay.style.display = "flex";
  document.body.classList.add("modal-open");

  const close = () => {
    overlay.style.display = "none";
    document.body.classList.remove("modal-open");
  };
  overlay.querySelector(".invoice-detail-close").onclick = close;
  overlay.querySelectorAll("[data-invoice-detail-close]").forEach((button) => {
    button.onclick = close;
  });
  overlay.querySelector("[data-invoice-cash-pay]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const confirmed = await confirmInvoiceCashPayment(invoice);
    if (!confirmed) return;

    await withAction(button, async () => {
      const resPay = await callApi(`/invoices/${button.dataset.invoiceCashPay}/pay`, {
        method: "PUT",
      });

      if (resPay?.ok) {
        adminToast(resPay.data?.message || "Đã xác nhận thanh toán tiền mặt.");
        close();
        await loadInvoices();
        await promptPrintCashReceipt(invoice.id);
      } else {
        adminToast(resPay?.data?.message || "Không thể xác nhận thanh toán.", true);
      }
    });
  });
  overlay.onclick = (event) => {
    if (event.target === overlay) close();
  };
}

async function confirmInvoiceCashPayment(invoice) {
  const message = [
    `Xác nhận sinh viên ${invoice.studentName || "-"} đã nộp tiền tại phòng quản lý?`,
    `Hóa đơn: ${getInvoiceDisplayCode(invoice)}`,
    `Số tiền: ${formatCurrency(invoice.totalAmount)}`
  ].join("\n");

  if (typeof showAppConfirm === "function") {
    return await showAppConfirm({
      title: "Xác nhận thu tiền mặt",
      message,
      confirmText: "Xác nhận đã thu",
      cancelText: "Hủy",
      tone: "default",
    });
  }

  return confirm(message);
}

async function promptPrintCashReceipt(invoiceId) {
  const message = "Thu tiền mặt thành công. Bạn có muốn in hóa đơn không?";
  const shouldPrint =
    typeof showAppConfirm === "function"
      ? await showAppConfirm({
          title: "In hóa đơn",
          message,
          confirmText: "Có, in hóa đơn",
          cancelText: "Không",
          tone: "default",
        })
      : confirm(message);

  if (!shouldPrint) return;

  const receiptRes = await callApi(`/receipts/${invoiceId}`);
  if (!receiptRes?.ok || !receiptRes.data) {
    adminToast(receiptRes?.data?.message || "Không thể tải biên lai để in.", true);
    return;
  }

  showReceiptPrintModal(receiptRes.data);
}

function showReceiptPrintModal(receipt) {
  const overlay = ensureReceiptPrintModal();
  const content = overlay.querySelector(".receipt-print-card");
  const receiptCode = receipt.receiptCode || `BL-${receipt.invoiceId || ""}`;
  const invoiceCode = receipt.invoiceCode || `HD-${String(receipt.invoiceId || "").padStart(6, "0")}`;

  content.innerHTML = `
    <button type="button" class="receipt-print-close no-print" aria-label="Đóng">×</button>
    <section class="receipt-print-sheet" id="receipt-print-sheet">
      <header class="receipt-print-header">
        <div>
          <strong>TRUNG TÂM QUẢN LÝ KÝ TÚC XÁ</strong>
          <span>Đại học Đà Nẵng</span>
        </div>
        <div class="receipt-print-code">
          <span>Mã biên lai</span>
          <strong>${escapeHtml(receiptCode)}</strong>
        </div>
      </header>

      <div class="receipt-print-title">
        <h2>HÓA ĐƠN / BIÊN LAI THANH TOÁN</h2>
        <p>Phương thức: ${escapeHtml(formatPaymentMethod(receipt.paymentMethod))}</p>
      </div>

      <div class="receipt-print-grid">
        ${receiptPrintInfo("Mã hóa đơn", invoiceCode)}
        ${receiptPrintInfo("Sinh viên", receipt.studentName || "-")}
        ${receiptPrintInfo("Phòng", receipt.roomCode || "-")}
        ${receiptPrintInfo("Kỳ thanh toán", receipt.period || "-")}
        ${receiptPrintInfo("Ngày phát hành", formatDate(receipt.issuedAt))}
        ${receiptPrintInfo("Ngày thanh toán", formatDate(receipt.paidAt))}
      </div>

      <table class="receipt-print-table">
        <thead>
          <tr>
            <th>Nội dung</th>
            <th>Số tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tiền phòng</td>
            <td>${escapeHtml(formatCurrency(receipt.roomFee))}</td>
          </tr>
          <tr>
            <td>Tiền điện</td>
            <td>${escapeHtml(formatCurrency(receipt.electricFee))}</td>
          </tr>
          <tr>
            <td>Tiền nước</td>
            <td>${escapeHtml(formatCurrency(receipt.waterFee))}</td>
          </tr>
          <tr class="receipt-print-total">
            <td>Tổng đã thu</td>
            <td>${escapeHtml(formatCurrency(receipt.paidAmount ?? receipt.totalAmount))}</td>
          </tr>
        </tbody>
      </table>

      <div class="receipt-print-meta">
        ${receiptPrintInfo("Mã giao dịch", receipt.transactionCode || "-")}
        ${receiptPrintInfo("Trạng thái", receipt.status || "Success")}
      </div>

      <footer class="receipt-print-signatures">
        <div>
          <span>Người nộp tiền</span>
          <strong>${escapeHtml(receipt.studentName || "")}</strong>
        </div>
        <div>
          <span>Người thu tiền</span>
          <strong>Admin</strong>
        </div>
      </footer>
    </section>

    <footer class="receipt-print-actions no-print">
      <button type="button" class="secondary-btn" data-receipt-print-close>Đóng</button>
      <button type="button" class="primary-btn" data-receipt-print-now>In hóa đơn</button>
    </footer>
  `;

  overlay.style.display = "flex";
  document.body.classList.add("modal-open");
  document.body.classList.add("receipt-print-open");

  const close = () => {
    overlay.style.display = "none";
    document.body.classList.remove("modal-open");
    document.body.classList.remove("receipt-print-open");
  };

  overlay.querySelector(".receipt-print-close").onclick = close;
  overlay.querySelector("[data-receipt-print-close]").onclick = close;
  overlay.querySelector("[data-receipt-print-now]").onclick = () => window.print();
  overlay.onclick = (event) => {
    if (event.target === overlay) close();
  };
}

function ensureReceiptPrintModal() {
  let overlay = document.getElementById("receipt-print-modal");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "receipt-print-modal";
  overlay.className = "receipt-print-overlay";
  overlay.style.display = "none";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = '<article class="receipt-print-card"></article>';
  document.body.appendChild(overlay);
  return overlay;
}

function receiptPrintInfo(label, value) {
  return `
    <div class="receipt-print-info">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function formatPaymentMethod(method = "") {
  const value = String(method || "").toLowerCase();
  if (value === "cash") return "Tiền mặt";
  if (value === "vnpay") return "VNPAY";
  return method || "-";
}

function ensureInvoiceDetailModal() {
  let overlay = document.getElementById("invoice-detail-modal");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "invoice-detail-modal";
  overlay.className = "invoice-detail-overlay";
  overlay.style.display = "none";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = '<article class="invoice-detail-card"></article>';
  document.body.appendChild(overlay);
  return overlay;
}

function invoiceInfoTile(type, label, value, allowHtml = false) {
  return `
    <article class="invoice-info-tile ${type}">
      <span class="invoice-info-icon">${invoiceInfoIconSvg(type)}</span>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${allowHtml ? value : escapeHtml(value)}</strong>
      </div>
    </article>
  `;
}

function invoicePaymentLine(type, title, desc, unitPrice, quantity, amount) {
  return `
    <div class="invoice-detail-line">
      <span class="invoice-line-title">
        <span class="invoice-line-icon ${type}">${invoiceInfoIconSvg(type)}</span>
        <span><strong>${escapeHtml(title)}</strong><em>${escapeHtml(desc)}</em></span>
      </span>
      <strong>${escapeHtml(formatCurrency(unitPrice))}</strong>
      <strong>${escapeHtml(quantity)}</strong>
      <strong>${escapeHtml(formatCurrency(amount))}</strong>
    </div>
  `;
}

function invoiceInfoIconSvg(type) {
  const icons = {
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>',
    issued: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>',
    room: '<svg viewBox="0 0 24 24"><path d="M3 21V9l9-6 9 6v12"></path><path d="M9 21v-8h6v8"></path></svg>',
    student: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg>',
    due: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
    status: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    electric: '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"></path></svg>',
    water: '<svg viewBox="0 0 24 24"><path d="M12 2.69 5.6 9.09a9 9 0 1 0 12.8 0L12 2.69z"></path></svg>',
    roomFee: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h4"></path></svg>'
  };
  return icons[type] || icons.roomFee;
}

