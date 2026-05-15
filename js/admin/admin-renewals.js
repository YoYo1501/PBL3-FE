
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
            <div class="queue-head">
                <strong>${escapeHtml(item.contractCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Gói: ${escapeHtml(item.packageName || "-")}</span>
                <span>Ngày gửi: ${formatDate(item.requestedAt)}</span>
            </div>
            ${
              item.status === "Pending"
                ? `<div class="queue-actions">
                    <button type="button" class="primary-btn" data-renewal-approve="${item.id}">Duyệt</button>
                    <button type="button" class="danger-btn" data-renewal-reject="${item.id}">Từ chối</button>
                </div>`
                : ""
            }
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
        const reason = promptNote("Nhập lý do từ chối gia hạn hợp đồng:");
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

  titleEl.textContent = "Chi tiết gia hạn hợp đồng";
  metaEl.textContent = `Hợp đồng ${item.contractCode || "-"}`;
  bodyEl.innerHTML = `
    <div class="request-detail-grid">
      ${requestDetailField("Sinh viên", item.studentName || "-")}
      ${requestDetailField("Phòng", item.roomCode || "-")}
      ${requestDetailField("Gói gia hạn", item.packageName || "-")}
      ${requestDetailField("Thời hạn gói", item.durationMonths ? `${item.durationMonths} tháng` : "-")}
      ${requestDetailField("Ngày gửi", formatDate(item.requestedAt))}
      ${requestDetailField("Ngày bắt đầu hợp đồng", formatDate(item.contractStartDate))}
      ${requestDetailField("Ngày kết thúc hợp đồng trước gia hạn", formatDate(item.contractEndDateBeforeRenewal))}
      ${requestDetailField("Ngày kết thúc hợp đồng sau gia hạn", formatDate(item.contractEndDateAfterRenewal))}
      ${requestDetailField("Giá phòng", formatCurrency(item.price))}
      ${
        item.rejectionReason
          ? requestDetailField("Lý do từ chối", item.rejectionReason)
          : ""
      }
      <div class="request-detail-field">
        <span>Trạng thái</span>
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
