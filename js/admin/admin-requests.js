
async function loadRequests() {
  setStackLoading("requests-list", "Đang tải yêu cầu sinh viên...");
  const state = paginationState.requests;
  const status = getRequestStatusFilter();
  const res = await callApi("/studentrequests");
  let items = Array.isArray(res?.data) ? res.data : [];
  if (status) {
    const normalizedStatus = status.toLowerCase();
    items = items.filter(
      (item) => String(item.status || "").toLowerCase() === normalizedStatus,
    );
  }
  items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  state.totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / state.size));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.size;
  adminRequests = items.slice(start, start + state.size);
  renderRequestsList();
}

function getRequestStatusFilter() {
  const value = document.getElementById("request-filter-status")?.value;
  return value == null ? "Pending" : value.trim();
}

function getRequestEmptyHtml() {
  const status = getRequestStatusFilter();
  const messages = {
    Pending: "Khong co yeu cau sinh vien nao dang cho duyet.",
    Approved: "Khong co yeu cau sinh vien nao da duyet.",
    InProgress: "Khong co yeu cau bao tri nao dang sua.",
    Completed: "Khong co yeu cau sinh vien nao da hoan thanh.",
    Rejected: "Khong co yeu cau sinh vien nao bi tu choi.",
  };

  return `<div class="empty-state">${escapeHtml(messages[status] || "Khong co yeu cau sinh vien nao.")}</div>`;
}

function bindRequestControls() {
  document
    .getElementById("request-filter-status")
    ?.addEventListener("change", () => {
      resetPage("requests");
      loadRequests();
    });
}

function renderRequestsList() {
  const container = preparePagedList(
    "requests",
    "requests-list",
    adminRequests,
    '<div class="empty-state">Không có yêu cầu sinh viên nào đang chờ xử lý.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRequests
    .map(
      (item) => `
        <article class="queue-item request-click-item" role="button" tabindex="0" data-request-id="${item.id}" aria-label="Xem chi tiet yeu cau ${escapeHtml(item.title)}">
            <div class="queue-item-content">
                <strong>${escapeHtml(item.title)}</strong>
                <div class="request-card-meta">
                    <span class="request-student-meta">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${escapeHtml(item.studentName || "-")}
                    </span>
                    <span class="request-type-badge ${getRequestTypeClass(item.requestType)}">${escapeHtml(getRequestTypeLabel(item.requestType))}</span>
                </div>
                ${renderRequestActions(item)}
            </div>
            <div class="queue-item-actions">
                ${requestListStatusBadge(item.status)}
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#9CA3AF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </article>
    `,
    )
    .join("");

  bindRequestDetail(container);
  bindRequestStatusAction(
    container,
    "[data-request-approve]",
    "Approved",
    "Nhập ghi chú duyệt yêu cầu:",
    "Đã duyệt yêu cầu.",
  );
  bindRequestStatusAction(
    container,
    "[data-request-reject]",
    "Rejected",
    "Nhập lý do từ chối yêu cầu:",
    "Đã từ chối yêu cầu.",
  );
  bindRequestStatusAction(
    container,
    "[data-request-start]",
    "InProgress",
    "Nh\u1eadp ghi ch\u00fa b\u1eaft \u0111\u1ea7u s\u1eeda:",
    "\u0110\u00e3 chuy\u1ec3n sang \u0111ang s\u1eeda.",
  );
  bindRequestStatusAction(
    container,
    "[data-request-complete]",
    "Completed",
    "Nh\u1eadp ghi ch\u00fa ho\u00e0n th\u00e0nh s\u1eeda ch\u1eefa:",
    "\u0110\u00e3 ho\u00e0n th\u00e0nh s\u1eeda ch\u1eefa.",
  );
}

function renderRequestActions(item) {
  if (item.status === "Pending") {
    return `<div class="request-inline-actions">
        <button type="button" class="primary-btn" data-request-approve="${item.id}">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Duyệt
        </button>
        <button type="button" class="danger-btn" data-request-reject="${item.id}">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            Từ chối
        </button>
    </div>`;
  }

  if (item.requestType === "Maintenance" && item.status === "Approved") {
    return `<div class="request-inline-actions">
        <button type="button" class="primary-btn" data-request-start="${item.id}">\u0110ang s\u1eeda</button>
    </div>`;
  }

  if (item.requestType === "Maintenance" && item.status === "InProgress") {
    return `<div class="request-inline-actions">
        <button type="button" class="primary-btn" data-request-complete="${item.id}">Ho\u00e0n th\u00e0nh</button>
    </div>`;
  }

  return "";
}

function requestStatusLabel(status = "") {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    inprogress: "Đang sửa",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  return labels[value] || status || "Không rõ";
}

function requestStatusClass(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "approved" || value === "completed") return "approved";
  if (value === "rejected" || value === "cancelled") return "rejected";
  if (value === "inprogress") return "progress";
  return "pending";
}

function requestListStatusBadge(status = "") {
  const statusClass = requestStatusClass(status);
  return `<span class="request-status-badge ${statusClass}">${adminStatusIcon(statusClass)}${escapeHtml(requestStatusLabel(status))}</span>`;
}

function bindRequestDetail(container) {
  container.querySelectorAll("[data-request-id]").forEach((itemEl) => {
    const openDetail = (event) => {
      if (event.target.closest("button, a")) return;
      const item = adminRequests.find(
        (request) => String(request.id) === String(itemEl.dataset.requestId),
      );
      if (item) showRequestDetailModal(item);
    };

    itemEl.addEventListener("click", openDetail);
    itemEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetail(event);
    });
  });
}

function showRequestDetailModal(item) {
  const overlay = document.getElementById("request-detail-modal");
  const titleEl = document.getElementById("request-modal-title");
  const metaEl = document.getElementById("request-modal-meta");
  const bodyEl = document.getElementById("request-modal-body");
  const closeBtn = document.getElementById("request-modal-close-btn");
  if (!overlay || !titleEl || !metaEl || !bodyEl || !closeBtn) return;

  overlay.classList.add("student-request-detail-modal");
  titleEl.textContent = "Chi tiết yêu cầu";
  metaEl.innerHTML = `
    <strong class="request-modal-name">${escapeHtml(item.title || "-")}</strong>
  `;
  bodyEl.innerHTML = `
    <div class="registration-detail-grid">
      ${requestInfoCard("Sinh viên", item.studentName || "-", "user")}
      ${requestInfoCard("Phòng", item.roomCode || "-", "room")}
      ${requestInfoCard("Loại yêu cầu", getRequestTypeLabel(item.requestType), "tag")}
      <div class="registration-detail-card registration-status-card">
        <span class="registration-detail-label">Trạng thái</span>
        ${requestStatusPill(item.status)}
      </div>
      ${requestInfoCard("Ngày gửi", formatDate(item.createdAt), "calendar")}
      ${requestInfoCard("Ngày xử lý", item.resolvedAt ? formatDate(item.resolvedAt) : "-", "calendar")}
    </div>
    <div class="request-note-panel">
      <section class="request-detail-section">
        <span>Nội dung yêu cầu</span>
        <p>${escapeHtml(item.description || "-")}</p>
      </section>
      <section class="request-detail-section">
        <span>Ghi chú xử lý</span>
        <p>${escapeHtml(item.resolutionNote || "-")}</p>
      </section>
    </div>
    ${
      item.status === "Pending"
        ? `<div class="detail-modal-actions">
            <button type="button" class="primary-btn" data-request-detail-approve="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Duyệt
            </button>
            <button type="button" class="danger-btn" data-request-detail-reject="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Từ chối
            </button>
        </div>`
        : ""
    }
  `;

  const closeModal = () => {
    overlay.style.display = "none";
    overlay.classList.remove("student-request-detail-modal");
    document.removeEventListener("keydown", handleKey);
  };
  const handleKey = (event) => {
    if (event.key === "Escape") closeModal();
  };

  closeBtn.onclick = closeModal;
  overlay.onclick = (event) => {
    if (event.target === overlay) closeModal();
  };
  document.addEventListener("keydown", handleKey);
  overlay.style.display = "flex";

  bodyEl.querySelector("[data-request-detail-approve]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const resolutionNote = await promptNote("Nhập ghi chú duyệt yêu cầu:");
      if (resolutionNote == null) return;
      const res = await callApi(`/studentrequests/${item.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: "Approved",
          resolutionNote: resolutionNote || "Đã xử lý theo yêu cầu.",
        }),
      });
      if (res?.ok) {
        adminToast("Đã duyệt yêu cầu.");
        closeModal();
        loadRequests();
        loadOverview();
      } else {
        adminToast(res?.data?.message || "Không thể cập nhật yêu cầu.", true);
      }
    }),
  );

  bodyEl.querySelector("[data-request-detail-reject]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const resolutionNote = await promptNote("Nhập lý do từ chối yêu cầu:");
      if (resolutionNote == null) return;
      const res = await callApi(`/studentrequests/${item.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: "Rejected",
          resolutionNote: resolutionNote || "Không đáp ứng điều kiện xử lý.",
        }),
      });
      if (res?.ok) {
        adminToast("Đã từ chối yêu cầu.");
        closeModal();
        loadRequests();
        loadOverview();
      } else {
        adminToast(res?.data?.message || "Không thể cập nhật yêu cầu.", true);
      }
    }),
  );
}

function requestInfoCard(label, value, icon) {
  return `
    <div class="registration-detail-card">
      <span class="registration-detail-icon">${requestDetailIcon(icon)}</span>
      <div>
        <span class="registration-detail-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    </div>
  `;
}

function requestDetailIcon(icon) {
  const icons = {
    user: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    room: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    tag: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><circle cx="7" cy="7" r="1"></circle></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>',
  };
  return icons[icon] || icons.user;
}

function requestStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    inprogress: "\u0110ang s\u1eeda",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
    completed: "Ho\u00e0n th\u00e0nh",
  };
  return `
    <strong class="registration-status-pill ${value}">
      ${adminStatusIcon(value)}
      ${escapeHtml(labels[value] || status || "Không rõ")}
    </strong>
  `;
}

function requestDetailField(label, value) {
  return `
    <div class="request-detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function getRequestTypeLabel(type) {
  const labels = {
    Checkout: "Trả phòng",
    Maintenance: "Bảo trì",
    RoomTransfer: "Chuyển phòng",
    Other: "Khác",
  };
  return labels[type] || type || "-";
}

function getRequestTypeClass(type) {
  const classes = {
    Checkout: "is-checkout",
    Maintenance: "is-maintenance",
    RoomTransfer: "is-transfer",
    Other: "is-other",
  };
  return classes[type] || "is-other";
}

function bindRequestStatusAction(
  container,
  selector,
  status,
  promptMessage,
  successMessage,
) {
  container.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resolutionNote = await promptNote(promptMessage);
        if (resolutionNote == null) return;
        const requestId =
          button.dataset.requestApprove || button.dataset.requestReject || button.dataset.requestStart || button.dataset.requestComplete;
        const res = await callApi(`/studentrequests/${requestId}/status`, {
          method: "PUT",
          body: JSON.stringify({
            status,
            resolutionNote:
              resolutionNote ||
              (status === "Rejected"
                ? "Không đáp ứng điều kiện xử lý."
                : "Đã xử lý theo yêu cầu."),
          }),
        });

        if (res?.ok) {
          adminToast(res.data?.message || successMessage);
          loadRequests();
          loadOverview();
        } else {
          adminToast(res?.data?.message || "Không thể cập nhật yêu cầu.", true);
        }
      }),
    );
  });
}
