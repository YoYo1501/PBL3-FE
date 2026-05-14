
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
        const reason = promptNote("Nhập lý do từ chối đơn đăng ký:");
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

  titleEl.textContent = "Chi tiet don dang ky o tru";
  metaEl.textContent = `Ma don ${item.registrationCode || "-"}`;
  bodyEl.innerHTML = `
    <div class="request-detail-grid">
      ${requestDetailField("Ho ten", item.fullName || "-")}
      ${requestDetailField("Phong", item.roomCode || "-")}
      ${requestDetailField("Ngay gui", formatDate(item.submittedAt))}
      ${requestDetailField("Ngay bat dau", formatDate(item.startDate))}
      ${requestDetailField("Ngay ket thuc", formatDate(item.endDate))}
      <div class="request-detail-field">
        <span>Trang thai</span>
        ${adminBadge(item.status)}
      </div>
    </div>
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
