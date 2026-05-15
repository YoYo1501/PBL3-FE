
async function loadRegistrations() {
  setStackLoading("registrations-list", "Đang tải danh sách đăng ký...");
  const state = paginationState.registrations;
  const status = getRegistrationStatusFilter();

  if (status === "Pending") {
    const query = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.size),
    });
    const res = await callApi(`/registrations/pending?${query.toString()}`);
    adminRegistrations = applyServerPagination("registrations", res?.data);
  } else {
    const res = await callApi("/registrations");
    let items = Array.isArray(res?.data) ? res.data : [];
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    items.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    state.totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(items.length / state.size));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.size;
    adminRegistrations = items.slice(start, start + state.size);
  }

  renderRegistrationsList();
}

function getRegistrationStatusFilter() {
  return document.getElementById("registration-filter-status")?.value ?? "Pending";
}

function bindRegistrationControls() {
  document
    .getElementById("registration-filter-status")
    ?.addEventListener("change", () => {
      resetPage("registrations");
      loadRegistrations();
    });
}

function renderRegistrationsList() {
  const container = preparePagedList(
    "registrations",
    "registrations-list",
    adminRegistrations,
    '<div class="empty-state">Không có đơn đăng ký nào đang chờ duyệt.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRegistrations
    .map(
      (item) => `
        <article class="queue-item registration-click-item" role="button" tabindex="0" data-registration-id="${item.id}" aria-label="Xem chi tiet don dang ky ${escapeHtml(item.fullName)}">
            <div class="queue-item-icon icon-blue">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div class="queue-item-content">
                <strong>${escapeHtml(item.fullName)}</strong>
                <p class="queue-body">Phòng: ${escapeHtml(item.roomCode || "-")}</p>
                ${
                  item.status === "Pending"
                    ? `<div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button type="button" class="primary-btn" data-reg-approve="${item.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Duyệt</button>
                        <button type="button" class="danger-btn" data-reg-reject="${item.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Từ chối</button>
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

  bindRegistrationDetail(container);

  container.querySelectorAll("[data-reg-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/registrations/${button.dataset.regApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: true,
              rejectionReason: "Hồ sơ hợp lệ",
            }),
          },
        );
        if (resApprove?.ok) {
          adminToast("Đã duyệt đơn đăng ký.");
          loadRegistrations();
          loadOverview();
        } else {
          adminToast(
            resApprove?.data?.message || "Không thể duyệt đơn đăng ký.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-reg-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = await promptNote("Nhập lý do từ chối đơn đăng ký:");
        if (reason == null) return;
        const resReject = await callApi(
          `/registrations/${button.dataset.regReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Hồ sơ chưa đáp ứng yêu cầu",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast("Đã từ chối đơn đăng ký.");
          loadRegistrations();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message || "Không thể từ chối đơn đăng ký.",
            true,
          );
        }
      }),
    );
  });
}

function bindRegistrationDetail(container) {
  container.querySelectorAll("[data-registration-id]").forEach((itemEl) => {
    const openDetail = (event) => {
      if (event.target.closest("button, a")) return;
      const item = adminRegistrations.find(
        (registration) => String(registration.id) === String(itemEl.dataset.registrationId),
      );
      if (item) showRegistrationDetailModal(item);
    };

    itemEl.addEventListener("click", openDetail);
    itemEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetail(event);
    });
  });
}

function showRegistrationDetailModal(item) {
  const overlay = document.getElementById("request-detail-modal");
  const titleEl = document.getElementById("request-modal-title");
  const metaEl = document.getElementById("request-modal-meta");
  const bodyEl = document.getElementById("request-modal-body");
  const closeBtn = document.getElementById("request-modal-close-btn");
  if (!overlay || !titleEl || !metaEl || !bodyEl || !closeBtn) return;

  const submittedAt = item.submittedAt ?? item.SubmittedAt;
  const startDate = item.startDate ?? item.StartDate;
  const endDate = item.endDate ?? item.EndDate;
  const registrationCode = item.registrationCode || item.RegistrationCode || "-";
  const status = item.status || item.Status;

  overlay.classList.add("registration-detail-modal");
  titleEl.textContent = "Chi tiết đơn đăng ký ở trú";
  metaEl.innerHTML = `
    <span class="registration-modal-code">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h5"></path><path d="M8 17h4"></path></svg>
      Mã đơn: <strong>${escapeHtml(registrationCode)}</strong>
    </span>
  `;
  bodyEl.innerHTML = `
    <div class="registration-detail-grid">
      ${registrationDetailCard("Họ tên", item.fullName || item.FullName || "-", "user")}
      ${registrationDetailCard("CCCD", item.citizenId || item.CitizenId || "-", "id")}
      ${registrationDetailCard("Số điện thoại", item.phone || item.Phone || "-", "phone")}
      ${registrationDetailCard("Giới tính", item.gender || item.Gender || "-", "gender")}
      ${registrationDetailCard("Email", item.email || item.Email || "-", "mail")}
      ${registrationDetailCard("Phòng", item.roomCode || item.RoomCode || "-", "room")}
      ${registrationDetailCard("Ngày gửi", formatDate(submittedAt), "calendar")}
      ${registrationDetailCard("Ngày bắt đầu", formatDate(startDate), "calendar")}
      ${registrationDetailCard("Ngày kết thúc", formatDate(endDate), "calendar")}
      <div class="registration-detail-card registration-status-card">
        <span class="registration-detail-label">Trạng thái</span>
        ${registrationStatusPill(status)}
      </div>
    </div>
    ${
      String(status || "").toLowerCase() === "pending"
        ? `<div class="registration-detail-actions">
            <button type="button" class="primary-btn" data-registration-detail-approve="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Duyệt
            </button>
            <button type="button" class="danger-btn" data-registration-detail-reject="${item.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Từ chối
            </button>
        </div>`
        : ""
    }
  `;

  const closeModal = () => {
    overlay.style.display = "none";
    overlay.classList.remove("registration-detail-modal");
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

  bodyEl.querySelector("[data-registration-detail-approve]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const resApprove = await callApi(
        `/registrations/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: true,
            rejectionReason: "Hồ sơ hợp lệ",
          }),
        },
      );
      if (resApprove?.ok) {
        adminToast("Đã duyệt đơn đăng ký.");
        closeModal();
        loadRegistrations();
        loadOverview();
      } else {
        adminToast(
          resApprove?.data?.message || "Không thể duyệt đơn đăng ký.",
          true,
        );
      }
    }),
  );

  bodyEl.querySelector("[data-registration-detail-reject]")?.addEventListener("click", (event) =>
    withAction(event.currentTarget, async () => {
      const reason = await promptNote("Nhập lý do từ chối đơn đăng ký:");
      if (reason == null) return;
      const resReject = await callApi(
        `/registrations/${item.id}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved: false,
            rejectionReason: reason || "Hồ sơ chưa đáp ứng yêu cầu",
          }),
        },
      );
      if (resReject?.ok) {
        adminToast("Đã từ chối đơn đăng ký.");
        closeModal();
        loadRegistrations();
        loadOverview();
      } else {
        adminToast(
          resReject?.data?.message || "Không thể từ chối đơn đăng ký.",
          true,
        );
      }
    }),
  );
}

function registrationDetailCard(label, value, icon) {
  return `
    <div class="registration-detail-card">
      <span class="registration-detail-icon">${registrationDetailIcon(icon)}</span>
      <div>
        <span class="registration-detail-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    </div>
  `;
}

function registrationDetailIcon(icon) {
  const icons = {
    user: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    id: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M7 15h4"></path><path d="M14 10h4"></path><path d="M14 14h4"></path></svg>',
    phone: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.61a2 2 0 0 1-.45 2.11L8.09 9.64a16 16 0 0 0 6.27 6.27l1.2-1.2a2 2 0 0 1 2.11-.45c.84.3 1.71.51 2.61.63A2 2 0 0 1 22 16.92z"></path></svg>',
    gender: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="5"></circle><path d="M14 10 21 3"></path><path d="M16 3h5v5"></path></svg>',
    mail: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>',
    room: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>',
  };
  return icons[icon] || icons.user;
}

function registrationStatusPill(status) {
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
