
function toRevenueDateInputValue(value) {
  const date =
    typeof parseDateValue === "function" ? parseDateValue(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function bindRevenueControls() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = toRevenueDateInputValue(now);
  const startEl = document.getElementById("revenue-start-date");
  const endEl = document.getElementById("revenue-end-date");
  if (startEl) {
    startEl.max = today;
    if (!startEl.value) startEl.value = toRevenueDateInputValue(start);
  }
  if (endEl) {
    endEl.max = today;
    if (!endEl.value) endEl.value = today;
  }

  document.getElementById("load-revenue-btn")?.addEventListener("click", () => {
    adminRevenueStatusFilter = "";
    adminRevenueHasLoaded = true;
    resetPage("revenue");
    loadRevenue();
  });
  document
    .getElementById("export-revenue-btn")
    ?.addEventListener("click", exportRevenue);

  bindRevenueStatusCard("revenue-total-invoices", "");
  bindRevenueStatusCard("revenue-paid-invoices", "Paid");
  bindRevenueStatusCard("revenue-unpaid-invoices", "Unpaid");
  updateRevenueStatusCards();
}

function bindRevenueStatusCard(valueId, status) {
  const valueEl = document.getElementById(valueId);
  const card = valueEl?.closest(".stat-card");
  if (!card) return;

  card.dataset.revenueStatusFilter = status;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");
  card.title = status === "Paid"
    ? "Lọc hóa đơn đã thanh toán"
    : status === "Unpaid"
      ? "Lọc hóa đơn chưa thanh toán"
      : "Hiển thị tất cả hóa đơn";

  const applyFilter = () => {
    if (!adminRevenueHasLoaded) {
      setRevenueError("Bấm Xem báo cáo để tải dữ liệu trước khi lọc hóa đơn.");
      return;
    }
    adminRevenueStatusFilter = status && adminRevenueStatusFilter !== status ? status : "";
    resetPage("revenue");
    loadRevenue();
  };

  card.addEventListener("click", applyFilter);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    applyFilter();
  });
}

function getRevenuePayload() {
  const state = paginationState.revenue;
  return {
    startDate: document.getElementById("revenue-start-date")?.value || "",
    endDate: document.getElementById("revenue-end-date")?.value || "",
    period: document.getElementById("revenue-period")?.value.trim() || null,
    roomCode: document.getElementById("revenue-room-code")?.value.trim() || null,
    status: adminRevenueStatusFilter || null,
    page: state.page,
    pageSize: state.size,
  };
}

function updateRevenueStatusCards() {
  document.querySelectorAll("[data-revenue-status-filter]").forEach((card) => {
    const status = card.dataset.revenueStatusFilter || "";
    const active = status === adminRevenueStatusFilter;
    card.classList.toggle("is-filter-active", active);
    card.classList.toggle("is-disabled", !adminRevenueHasLoaded);
    card.setAttribute("aria-pressed", String(active));
    card.setAttribute("aria-disabled", String(!adminRevenueHasLoaded));
  });
}

function setRevenueError(message = "") {
  const el = document.getElementById("revenue-form-error");
  if (el) el.textContent = message;
}

function validateRevenuePayload(payload, missingMessage) {
  if (!payload.startDate || !payload.endDate) {
    return missingMessage;
  }
  if (payload.startDate > payload.endDate) {
    return "Ngày bắt đầu không được lớn hơn ngày kết thúc.";
  }
  if (payload.endDate > toRevenueDateInputValue(new Date())) {
    return "Ngày kết thúc không được vượt quá ngày hiện tại.";
  }
  return "";
}

async function loadRevenue() {
  const tbody = document.getElementById("revenue-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="9" class="table-empty">Đang tải báo cáo doanh thu...</td></tr>';
  setRevenueError("");

  const payload = getRevenuePayload();
  const validationMessage = validateRevenuePayload(
    payload,
    "Vui lòng chọn khoảng thời gian báo cáo.",
  );
  if (validationMessage) {
    setRevenueError(validationMessage);
    resetRevenueStats();
    renderRevenueTable();
    return;
  }

  const res = await callApi("/revenue/stats", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = res?.data?.data;
  if (!res?.ok || !data) {
    setRevenueError(res?.data?.message || "Không thể tải báo cáo doanh thu.");
    resetRevenueStats();
    renderRevenueTable();
    return;
  }

  document.getElementById("revenue-room-fee").textContent = formatCurrency(
    data.totalRoomFee,
  );
  document.getElementById("revenue-electric-fee").textContent = formatCurrency(
    data.totalElectricFee,
  );
  document.getElementById("revenue-water-fee").textContent = formatCurrency(
    data.totalWaterFee,
  );
  document.getElementById("revenue-grand-total").textContent = formatCurrency(
    data.grandTotal,
  );
  document.getElementById("revenue-total-invoices").textContent =
    data.totalInvoices ?? 0;
  document.getElementById("revenue-paid-invoices").textContent =
    data.paidInvoices ?? 0;
  document.getElementById("revenue-unpaid-invoices").textContent =
    data.unpaidInvoices ?? 0;

  adminRevenueDetails = applyServerPagination("revenue", data.details);
  updateRevenueStatusCards();
  renderRevenueTable();
}

function renderRevenueTable() {
  const tbody = document.getElementById("revenue-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "revenue",
    paginationState.revenue.totalItems || adminRevenueDetails.length,
  );

  if (!adminRevenueDetails.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="table-empty">Không có dữ liệu doanh thu phù hợp bộ lọc.</td></tr>';
    updateRevenueStatusCards();
    return;
  }

  updateRevenueStatusCards();
  tbody.innerHTML = adminRevenueDetails
    .map(
      (item) => `
        <tr>
            <td>${escapeHtml(item.period || "-")}</td>
            <td>${escapeHtml(item.roomCode || "-")}</td>
            <td>${escapeHtml(item.studentName || "-")}</td>
            <td>${escapeHtml(formatCurrency(item.roomFee))}</td>
            <td>${escapeHtml(formatCurrency(item.electricFee))}</td>
            <td>${escapeHtml(formatCurrency(item.waterFee))}</td>
            <td><strong>${escapeHtml(formatCurrency(item.totalAmount))}</strong></td>
            <td>${revenueStatusBadge(item.status)}</td>
            <td>${formatDate(item.issuedAt)}</td>
        </tr>
    `,
    )
    .join("");
}

function revenueStatusLabel(status = "") {
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

function revenueStatusClass(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return "paid";
  if (value === "unpaid" || value === "overdue") return "unpaid";
  if (value === "cancelled") return "cancelled";
  return "draft";
}

function revenueStatusBadge(status = "") {
  return `<span class="invoice-status-badge ${revenueStatusClass(status)}">${escapeHtml(revenueStatusLabel(status))}</span>`;
}

function resetRevenueStats() {
  adminRevenueDetails = [];
  updateRevenueStatusCards();
  [
    "revenue-room-fee",
    "revenue-electric-fee",
    "revenue-water-fee",
    "revenue-grand-total",
  ].forEach((id) => {
    document.getElementById(id).textContent = formatCurrency(0);
  });
  [
    "revenue-total-invoices",
    "revenue-paid-invoices",
    "revenue-unpaid-invoices",
  ].forEach((id) => {
    document.getElementById(id).textContent = "0";
  });
}

async function exportRevenue() {
  setRevenueError("");
  const payload = getRevenuePayload();
  const validationMessage = validateRevenuePayload(
    payload,
    "Vui lòng chọn khoảng thời gian trước khi xuất file.",
  );
  if (validationMessage) {
    setRevenueError(validationMessage);
    return;
  }

  const res = await callApiBlob("/revenue/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res?.ok || !res.blob) {
    setRevenueError("Không thể xuất file doanh thu.");
    return;
  }

  const url = URL.createObjectURL(res.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DoanhThu_${payload.startDate}_${payload.endDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  adminToast("Đã xuất file Excel doanh thu.");
}
