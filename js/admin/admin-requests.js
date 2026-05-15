
async function loadRequests() {
  setStackLoading("requests-list", "Đang tải yêu cầu sinh viên...");
  const state = paginationState.requests;
  const status = getRequestStatusFilter();
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (status) query.set("status", status);
  const res = await callApi(`/studentrequests?${query.toString()}`);
  adminRequests = applyServerPagination("requests", res?.data);
  renderRequestsList();
}

function getRequestStatusFilter() {
  return document.getElementById("request-filter-status")?.value ?? "Pending";
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
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
            </div>
            <div class="queue-meta">
                <span>${escapeHtml(item.studentName || "-")}</span>
                <span>Loại: ${escapeHtml(getRequestTypeLabel(item.requestType))}</span>
            </div>
            ${
              item.status === "Pending"
                ? `<div class="queue-actions">
                    <button type="button" class="primary-btn" data-request-approve="${item.id}">Duyệt</button>
                    <button type="button" class="danger-btn" data-request-reject="${item.id}">Từ chối</button>
                </div>`
                : ""
            }
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

  titleEl.textContent = item.title || "Chi tiet yeu cau";
  metaEl.textContent = `Ma yeu cau #${item.id || "-"} - ${formatDate(item.createdAt)}`;
  bodyEl.innerHTML = `
    <div class="request-detail-grid">
      ${requestDetailField("Sinh vien", item.studentName || "-")}
      ${requestDetailField("Phong", item.roomCode || "-")}
      ${requestDetailField("Loai yeu cau", getRequestTypeLabel(item.requestType))}
      <div class="request-detail-field">
        <span>Trang thai</span>
        ${adminBadge(item.status)}
      </div>
      ${requestDetailField("Ngay gui", formatDate(item.createdAt))}
      ${requestDetailField("Ngay xu ly", item.resolvedAt ? formatDate(item.resolvedAt) : "-")}
    </div>
    <section class="request-detail-section">
      <span>Noi dung yeu cau</span>
      <p>${escapeHtml(item.description || "-")}</p>
    </section>
    <section class="request-detail-section">
      <span>Ghi chu xu ly</span>
      <p>${escapeHtml(item.resolutionNote || "-")}</p>
    </section>
  `;

  const closeModal = () => {
    overlay.style.display = "none";
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
        const resolutionNote = promptNote(promptMessage);
        if (resolutionNote == null) return;
        const requestId =
          button.dataset.requestApprove || button.dataset.requestReject;
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
