
async function loadRenewals() {
  setStackLoading("renewals-list", "Đang tải yêu cầu gia hạn...");
  const state = paginationState.renewals;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/contracts/renewals/pending?${query.toString()}`);
  adminRenewals = applyServerPagination("renewals", res?.data);
  renderRenewalsList();
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
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.contractCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Gói: ${escapeHtml(item.packageName || "-")}</span>
                <span>Ngày gửi: ${formatDate(item.requestedAt)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-renewal-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-renewal-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");

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
