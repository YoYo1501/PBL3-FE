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

function setInvoiceActionError(message = "") {
  const el = document.getElementById("invoice-action-error");
  if (el) el.textContent = message;
}

function bindInvoiceControls() {
  const importForm = document.getElementById("invoice-import-form");
  const generateForm = document.getElementById("invoice-generate-form");

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
    '<tr><td colspan="11" class="table-empty">Đang tải danh sách hóa đơn...</td></tr>';
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
      '<tr><td colspan="11" class="table-empty">Không có hóa đơn phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminInvoices
    .map(
      (invoice) => `
        <tr>
            <td>${escapeHtml(invoice.id)}</td>
            <td>${escapeHtml(invoice.period || "-")}</td>
            <td>${escapeHtml(invoice.roomCode || "-")}</td>
            <td>${escapeHtml(invoice.studentName || "-")}</td>
            <td>${escapeHtml(formatCurrency(invoice.roomFee))}</td>
            <td>${escapeHtml(formatCurrency(invoice.electricFee))}</td>
            <td>${escapeHtml(formatCurrency(invoice.waterFee))}</td>
            <td><strong>${escapeHtml(formatCurrency(invoice.totalAmount))}</strong></td>
            <td>${adminBadge(invoice.status)}</td>
            <td>${formatDate(invoice.issuedAt)}</td>
            <td>
                <div class="invoice-status-actions">
                    <button type="button" class="secondary-btn" data-invoice-view="${invoice.id}">Chi tiết</button>
                    ${
                      invoice.status === "Unpaid"
                        ? `<button type="button" class="primary-btn" data-invoice-pay="${invoice.id}">Đánh dấu đã thu</button>`
                        : ""
                    }
                </div>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-invoice-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      const resDetail = await callApi(
        `/invoices/${button.dataset.invoiceView}`,
      );
      const invoice = resDetail?.data;
      if (!resDetail?.ok || !invoice) {
        adminToast(
          resDetail?.data?.message || "Không thể lấy chi tiết hóa đơn.",
          true,
        );
        return;
      }

      const details = [
        `Hóa đơn #${invoice.id}`,
        `Kỳ: ${invoice.period || "-"}`,
        `Phòng: ${invoice.roomCode || "-"}`,
        `Sinh viên: ${invoice.studentName || "-"}`,
        `Tiền phòng: ${formatCurrency(invoice.roomFee)}`,
        `Tiền điện: ${formatCurrency(invoice.electricFee)}`,
        `Tiền nước: ${formatCurrency(invoice.waterFee)}`,
        `Tổng tiền: ${formatCurrency(invoice.totalAmount)}`,
        `Trạng thái: ${invoice.status || "-"}`,
        `Ngày phát hành: ${formatDate(invoice.issuedAt)}`,
      ].join("\n");

      window.alert(details);
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

