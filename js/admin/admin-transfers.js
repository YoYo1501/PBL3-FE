
async function loadTransfers() {
  setStackLoading("transfers-list", "Đang tải yêu cầu chuyển phòng...");
  const state = paginationState.transfers;
  const status = getTransferStatusFilter();
  if (status === "Pending") {
    const query = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.size),
    });
    const res = await callApi(`/roomtransfers/pending?${query.toString()}`);
    adminTransfers = applyServerPagination("transfers", res?.data);
  } else {
    const res = await callApi("/roomtransfers");
    let items = Array.isArray(res?.data) ? res.data : [];
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    items.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));

    state.totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(items.length / state.size));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.size;
    adminTransfers = items.slice(start, start + state.size);
  }
  renderTransfersList();
}

function getTransferStatusFilter() {
  return document.getElementById("transfer-filter-status")?.value ?? "Pending";
}

function bindTransferControls() {
  document
    .getElementById("transfer-filter-status")
    ?.addEventListener("change", () => {
      resetPage("transfers");
      loadTransfers();
    });
}

function renderTransfersList() {
  const container = preparePagedList(
    "transfers",
    "transfers-list",
    adminTransfers,
    '<div class="empty-state">Không có yêu cầu chuyển phòng nào đang chờ duyệt.</div>',
  );
  if (!container) return;

  container.innerHTML = adminTransfers
    .map(
      (item) => `
        <article class="queue-item transfer-click-item" role="button" tabindex="0" data-transfer-id="${item.id}" aria-label="Xem chi tiet chuyen phong ${escapeHtml(item.studentName || "")}">
            <div class="queue-item-content">
                <strong>${escapeHtml(item.studentName || "-")}</strong>
                <p class="queue-body">${escapeHtml(item.fromRoomCode || "-")} -> ${escapeHtml(item.toRoomCode || "-")}</p>
                ${
                  item.status === "Pending"
                    ? `<div class="transfer-inline-actions">
                        <button type="button" class="primary-btn" data-transfer-approve="${item.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Duyệt
                        </button>
                        <button type="button" class="danger-btn" data-transfer-reject="${item.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Từ chối
                        </button>
                    </div>`
                    : ""
                }
            </div>
            <div class="queue-item-actions">
                ${transferListStatusBadge(item.status)}
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#9CA3AF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </article>
    `,
    )
    .join("");

  bindTransferDetail(container);

  container.querySelectorAll("[data-transfer-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/roomtransfers/${button.dataset.transferApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: true,
              rejectionReason: "",
            }),
          },
        );
        if (resApprove?.ok) {
          adminToast(resApprove.data?.message || "Đã duyệt chuyển phòng.");
          loadTransfers();
          loadOverview();
          loadRooms();
        } else {
          adminToast(
            resApprove?.data?.message || "Không thể duyệt chuyển phòng.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-transfer-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = await promptNote("Nhập lý do từ chối chuyển phòng:");
        if (reason == null) return;
        const resReject = await callApi(
          `/roomtransfers/${button.dataset.transferReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Không đủ điều kiện chuyển phòng",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast(resReject.data?.message || "Đã từ chối chuyển phòng.");
          loadTransfers();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message || "Không thể từ chối chuyển phòng.",
            true,
          );
        }
      }),
    );
  });
}

function transferStatusLabel(status = "") {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
  };
  return labels[value] || status || "Không rõ";
}

function transferStatusClass(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected" || value === "cancelled") return "rejected";
  return "pending";
}

function transferListStatusBadge(status = "") {
  return `<span class="transfer-status-badge ${transferStatusClass(status)}">${escapeHtml(transferStatusLabel(status))}</span>`;
}

function bindTransferDetail(container) {
  container.querySelectorAll("[data-transfer-id]").forEach((itemEl) => {
    const openDetail = (event) => {
      if (event.target.closest("button, a")) return;
      const item = adminTransfers.find(
        (transfer) => String(transfer.id) === String(itemEl.dataset.transferId),
      );
      if (item) showTransferDetailModal(item);
    };

    itemEl.addEventListener("click", openDetail);
    itemEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetail(event);
    });
  });
}

function showTransferDetailModal(item) {
  const overlay = document.getElementById("request-detail-modal");
  const titleEl = document.getElementById("request-modal-title");
  const metaEl = document.getElementById("request-modal-meta");
  const bodyEl = document.getElementById("request-modal-body");
  const closeBtn = document.getElementById("request-modal-close-btn");
  if (!overlay || !titleEl || !metaEl || !bodyEl || !closeBtn) return;

  overlay.classList.add("transfer-detail-modal");
  titleEl.textContent = "Chi tiết chuyển phòng";
  metaEl.innerHTML = `
    <strong class="request-modal-name">${escapeHtml(item.studentName || "-")}</strong>
  `;
  bodyEl.innerHTML = `
    <div class="registration-detail-grid">
      ${transferInfoCard("Sinh viên", item.studentName || "-", "user")}
      ${transferInfoCard("Phòng hiện tại", item.fromRoomCode || "-", "room")}
      ${transferInfoCard("Phòng muốn chuyển", item.toRoomCode || "-", "room")}
      <div class="registration-detail-card registration-status-card">
        <span class="registration-detail-label">Trạng thái</span>
        ${transferStatusPill(item.status)}
      </div>
      ${transferInfoCard("Ngày gửi", formatDate(item.requestedAt), "calendar")}
      ${item.rejectionReason ? transferInfoCard("Lý do từ chối", item.rejectionReason, "reject") : ""}
    </div>
    <div class="request-note-panel">
      <section class="request-detail-section">
        <span>Lý do chuyển phòng</span>
        <p>${escapeHtml(item.reason || "Không có lý do")}</p>
      </section>
    </div>
    ${
      item.status === "Pending"
        ? `<div class="detail-modal-actions">
            <button type="button" class="primary-btn" data-transfer-detail-approve="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Duyệt
            </button>
            <button type="button" class="danger-btn" data-transfer-detail-reject="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Từ chối
            </button>
        </div>`
        : ""
    }
  `;

  const closeModal = () => {
    overlay.style.display = "none";
    overlay.classList.remove("transfer-detail-modal");
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

  bodyEl.querySelector("[data-transfer-detail-approve]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const resApprove = await callApi(
        `/roomtransfers/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: true,
            rejectionReason: "",
          }),
        },
      );
      if (resApprove?.ok) {
        adminToast(resApprove.data?.message || "Đã duyệt chuyển phòng.");
        closeModal();
        loadTransfers();
        loadOverview();
        loadRooms();
      } else {
        adminToast(
          resApprove?.data?.message || "Không thể duyệt chuyển phòng.",
          true,
        );
      }
    }),
  );

  bodyEl.querySelector("[data-transfer-detail-reject]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const reason = await promptNote("Nhập lý do từ chối chuyển phòng:");
      if (reason == null) return;
      const resReject = await callApi(
        `/roomtransfers/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: false,
            rejectionReason: reason || "Không đủ điều kiện chuyển phòng",
          }),
        },
      );
      if (resReject?.ok) {
        adminToast(resReject.data?.message || "Đã từ chối chuyển phòng.");
        closeModal();
        loadTransfers();
        loadOverview();
      } else {
        adminToast(
          resReject?.data?.message || "Không thể từ chối chuyển phòng.",
          true,
        );
      }
    }),
  );
}

function transferInfoCard(label, value, icon) {
  return `
    <div class="registration-detail-card">
      <span class="registration-detail-icon ${icon === "reject" ? "is-red" : ""}">${transferDetailIcon(icon)}</span>
      <div>
        <span class="registration-detail-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    </div>
  `;
}

function transferDetailIcon(icon) {
  const icons = {
    user: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    room: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>',
    reject: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>',
  };
  return icons[icon] || icons.room;
}

function transferStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
  };
  return `
    <strong class="registration-status-pill ${value}">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
      ${escapeHtml(labels[value] || status || "Không rõ")}
    </strong>
  `;
}
