
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
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fullName)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Mã đơn: ${escapeHtml(item.registrationCode)}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || "-")}</span>
                <span>${formatDate(item.startDate)} - ${formatDate(item.endDate)}</span>
                <span>Ngày gửi: ${formatDate(item.submittedAt)}</span>
            </div>
            ${
              item.status === "Pending"
                ? `<div class="queue-actions">
                    <button type="button" class="primary-btn" data-reg-approve="${item.id}">Duyệt</button>
                    <button type="button" class="danger-btn" data-reg-reject="${item.id}">Từ chối</button>
                </div>`
                : ""
            }
        </article>
    `,
    )
    .join("");

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
