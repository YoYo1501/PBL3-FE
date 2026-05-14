
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
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fromRoomCode)} -> ${escapeHtml(item.toRoomCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Ngày gửi: ${formatDate(item.requestedAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.reason || "Không có lý do")}</p>
            ${
              item.status === "Pending"
                ? `<div class="queue-actions">
                    <button type="button" class="primary-btn" data-transfer-approve="${item.id}">Duyệt</button>
                    <button type="button" class="danger-btn" data-transfer-reject="${item.id}">Từ chối</button>
                </div>`
                : ""
            }
        </article>
    `,
    )
    .join("");

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
        const reason = promptNote("Nhập lý do từ chối chuyển phòng:");
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
