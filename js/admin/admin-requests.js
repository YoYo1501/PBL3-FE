
async function loadRequests() {
  setStackLoading("requests-list", "Đang tải yêu cầu sinh viên...");
  const state = paginationState.requests;
  const query = new URLSearchParams({
    status: "Pending",
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/studentrequests?${query.toString()}`);
  adminRequests = applyServerPagination("requests", res?.data);
  renderRequestsList();
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
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>${escapeHtml(item.studentName || "-")}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || "-")}</span>
                <span>Loại: ${escapeHtml(item.requestType || "-")}</span>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.description || "")}</p>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-request-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-request-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");

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
