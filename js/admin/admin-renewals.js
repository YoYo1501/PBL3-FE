
async function loadRenewals() {
  setStackLoading("renewals-list", "Đang tải yêu cầu gia hạn...");
  const state = paginationState.renewals;
  const status = getRenewalStatusFilter();
  if (status === "Pending") {
    const query = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.size),
    });
    const res = await callApi(`/contracts/renewals/pending?${query.toString()}`);
    adminRenewals = applyServerPagination("renewals", res?.data);
  } else {
    const res = await callApi("/contracts/renewals");
    let items = Array.isArray(res?.data) ? res.data : [];
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    items.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));

    state.totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(items.length / state.size));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.size;
    adminRenewals = items.slice(start, start + state.size);
  }
  renderRenewalsList();
}

function getRenewalStatusFilter() {
  return document.getElementById("renewal-filter-status")?.value ?? "Pending";
}

function bindRenewalControls() {
  document
    .getElementById("renewal-filter-status")
    ?.addEventListener("change", () => {
      resetPage("renewals");
      loadRenewals();
    });
}

function renderRenewalsList() {
  const container = preparePagedList(
    "renewals",
    "renewals-list",
    adminRenewals,
    '<div class="empty-state">Không có yêu cầu gia hạn nào đang chờ duyệt.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRenewals
    .map(
      (item) => `
        <article class="queue-item renewal-click-item" role="button" tabindex="0" data-renewal-id="${item.id}" aria-label="Xem chi tiet gia han hop dong ${escapeHtml(item.contractCode)}">
            <div class="renewal-item-icon ${getRenewalStatusClass(item.status)}">
                ${getRenewalIcon(item.status)}
            </div>
            <div class="queue-item-content">
                <strong>${escapeHtml(item.contractCode)}</strong>
                <div class="renewal-card-meta">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><circle cx="10" cy="15" r="1"></circle><circle cx="16" cy="15" r="1"></circle><path d="M10 15h6"></path></svg>
                    <span>Gói: ${escapeHtml(item.packageName || "-")}</span>
                </div>
                ${
                  item.status === "Pending"
                    ? `<div class="renewal-inline-actions">
                        <button type="button" class="primary-btn" data-renewal-approve="${item.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Duyệt
                        </button>
                        <button type="button" class="danger-btn" data-renewal-reject="${item.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Từ chối
                        </button>
                    </div>`
                    : ""
                }
            </div>
            <div class="queue-item-actions">
                ${adminBadge(item.status)}
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#9CA3AF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </article>
    `,
    )
    .join("");

  bindRenewalDetail(container);

  container.querySelectorAll("[data-renewal-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/contracts/renewals/${button.dataset.renewalApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: true,
              rejectionReason: "",
            }),
          },
        );
        if (resApprove?.ok) {
          adminToast("Đã duyệt yêu cầu gia hạn.");
          loadRenewals();
          loadContracts();
          loadOverview();
        } else {
          adminToast(
            resApprove?.data?.message || "Không thể duyệt yêu cầu gia hạn.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-renewal-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = await promptNote("Nhập lý do từ chối gia hạn hợp đồng:");
        if (reason == null) return;
        const resReject = await callApi(
          `/contracts/renewals/${button.dataset.renewalReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Chưa đủ điều kiện gia hạn",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast("Đã từ chối yêu cầu gia hạn.");
          loadRenewals();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message || "Không thể từ chối yêu cầu gia hạn.",
            true,
          );
        }
      }),
    );
  });
}

function getRenewalStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved" || value === "completed") return "is-approved";
  if (value === "rejected" || value === "cancelled") return "is-rejected";
  return "is-pending";
}

function getRenewalIcon(status) {
  const statusClass = getRenewalStatusClass(status);
  const statusIcon =
    statusClass === "is-approved"
      ? '<circle cx="17" cy="17" r="3"></circle><path d="m15.7 17 0.9 0.9 1.7-1.8"></path>'
      : '<circle cx="17" cy="17" r="3"></circle><path d="m15.9 15.9 2.2 2.2"></path><path d="m18.1 15.9-2.2 2.2"></path>';

  return `
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"></path>
      <path d="M14 2v6h6"></path>
      <path d="M8 13h4"></path>
      <path d="M8 17h3"></path>
      ${statusIcon}
    </svg>
  `;
}

function bindRenewalDetail(container) {
  container.querySelectorAll("[data-renewal-id]").forEach((itemEl) => {
    const openDetail = (event) => {
      if (event.target.closest("button, a")) return;
      const item = adminRenewals.find(
        (renewal) => String(renewal.id) === String(itemEl.dataset.renewalId),
      );
      if (item) showRenewalDetailModal(item);
    };

    itemEl.addEventListener("click", openDetail);
    itemEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetail(event);
    });
  });
}

function showRenewalDetailModal(item) {
  const overlay = document.getElementById("request-detail-modal");
  const titleEl = document.getElementById("request-modal-title");
  const metaEl = document.getElementById("request-modal-meta");
  const bodyEl = document.getElementById("request-modal-body");
  const closeBtn = document.getElementById("request-modal-close-btn");
  if (!overlay || !titleEl || !metaEl || !bodyEl || !closeBtn) return;

  overlay.classList.add("renewal-detail-modal");
  titleEl.textContent = "Chi tiết gia hạn hợp đồng";
  metaEl.innerHTML = `
    <span class="registration-modal-code renewal-contract-code">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h5"></path><path d="M8 17h4"></path></svg>
      Hợp đồng: <strong>${escapeHtml(item.contractCode || "-")}</strong>
    </span>
  `;
  bodyEl.innerHTML = `
    <div class="registration-detail-grid">
      ${renewalInfoCard("Sinh viên", item.studentName || "-", "user")}
      ${renewalInfoCard("Phòng", item.roomCode || "-", "room")}
      ${renewalInfoCard("Gói gia hạn", item.packageName || "-", "package")}
      ${renewalInfoCard("Thời hạn gói", item.durationMonths ? `${item.durationMonths} tháng` : "-", "duration")}
      ${renewalInfoCard("Ngày gửi", formatDate(item.requestedAt), "calendar-blue")}
      ${renewalInfoCard("Ngày bắt đầu hợp đồng", formatDate(item.contractStartDate), "calendar-green")}
      ${renewalInfoCard("Ngày kết thúc hợp đồng trước gia hạn", formatDate(item.contractEndDateBeforeRenewal), "calendar-orange")}
      ${renewalInfoCard("Ngày kết thúc hợp đồng sau gia hạn", formatDate(item.contractEndDateAfterRenewal), "calendar-red")}
      ${renewalInfoCard("Giá phòng", formatCurrency(item.price), "money")}
      ${
        item.rejectionReason
          ? renewalInfoCard("Lý do từ chối", item.rejectionReason, "reject")
          : ""
      }
      <div class="registration-detail-card registration-status-card">
        <span class="registration-detail-label">Trạng thái</span>
        ${renewalStatusPill(item.status)}
      </div>
    </div>
    ${
      item.status === "Pending"
        ? `<div class="detail-modal-actions">
            <button type="button" class="primary-btn" data-renewal-detail-approve="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Duyệt
            </button>
            <button type="button" class="danger-btn" data-renewal-detail-reject="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Từ chối
            </button>
        </div>`
        : ""
    }
  `;

  const closeModal = () => {
    overlay.style.display = "none";
    overlay.classList.remove("renewal-detail-modal");
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

  bodyEl.querySelector("[data-renewal-detail-approve]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const resApprove = await callApi(
        `/contracts/renewals/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: true,
            rejectionReason: "",
          }),
        },
      );
      if (resApprove?.ok) {
        adminToast("Đã duyệt yêu cầu gia hạn.");
        closeModal();
        loadRenewals();
        loadContracts();
        loadOverview();
      } else {
        adminToast(
          resApprove?.data?.message || "Không thể duyệt yêu cầu gia hạn.",
          true,
        );
      }
    }),
  );

  bodyEl.querySelector("[data-renewal-detail-reject]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const reason = await promptNote("Nhập lý do từ chối gia hạn hợp đồng:");
      if (reason == null) return;
      const resReject = await callApi(
        `/contracts/renewals/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: false,
            rejectionReason: reason || "Chưa đủ điều kiện gia hạn",
          }),
        },
      );
      if (resReject?.ok) {
        adminToast("Đã từ chối yêu cầu gia hạn.");
        closeModal();
        loadRenewals();
        loadOverview();
      } else {
        adminToast(
          resReject?.data?.message || "Không thể từ chối yêu cầu gia hạn.",
          true,
        );
      }
    }),
  );
}

function renewalInfoCard(label, value, icon) {
  return `
    <div class="registration-detail-card">
      <span class="registration-detail-icon ${getRenewalDetailIconClass(icon)}">${renewalDetailIcon(icon)}</span>
      <div>
        <span class="registration-detail-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    </div>
  `;
}

function getRenewalDetailIconClass(icon) {
  if (icon === "package" || icon === "duration") return "is-purple";
  if (icon === "calendar-green" || icon === "money") return "is-green";
  if (icon === "calendar-orange") return "is-orange";
  if (icon === "calendar-red" || icon === "reject") return "is-red";
  return "";
}

function renewalDetailIcon(icon) {
  const calendar = '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>';
  const icons = {
    user: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    room: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    package: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    duration: calendar,
    "calendar-blue": calendar,
    "calendar-green": calendar,
    "calendar-orange": calendar,
    "calendar-red": calendar,
    money: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 6v12"></path><path d="M16 9.5A3.5 3.5 0 0 0 12 8a3.5 3.5 0 0 0 0 7 3.5 3.5 0 0 0 4-1.5"></path></svg>',
    reject: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>',
  };
  return icons[icon] || icons.user;
}

function renewalStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
  };
  return `
    <strong class="registration-status-pill ${value}">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
      ${escapeHtml(labels[value] || status || "Không rõ")}
    </strong>
  `;
}
