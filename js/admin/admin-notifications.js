
function bindNotificationForm() {
  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");
  const updateNotificationTargetUi = () => {
    if (!targetTypeEl || !userIdEl) return;
    const isSingleTarget = targetTypeEl.value === "single";
    userIdEl.disabled = !isSingleTarget;
    if (!isSingleTarget) userIdEl.value = "";
  };

  targetTypeEl?.addEventListener("change", updateNotificationTargetUi);
  updateNotificationTargetUi();

  document
    .getElementById("notification-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById("notif-form-error");
      errorEl.textContent = "";

      const targetType =
        document.getElementById("notif-target-type")?.value || "single";
      const sendToAllStudents = targetType === "all-students";
      const userId = Number(document.getElementById("notif-user-id").value);
      const title = document.getElementById("notif-title").value.trim();
      const message = document.getElementById("notif-message").value.trim();

      if (!sendToAllStudents && !userId) {
        errorEl.textContent = "Vui lòng nhập User ID hợp lệ.";
        return;
      }
      if (!title || !message) {
        errorEl.textContent = "Vui lòng nhập đủ tiêu đề và nội dung.";
        return;
      }

      const res = await callApi("/notifications", {
        method: "POST",
        body: JSON.stringify({
          userId: sendToAllStudents ? null : userId,
          sendToAllStudents,
          title,
          message,
        }),
      });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (sendToAllStudents
              ? "Đã gửi thông báo cho tất cả sinh viên."
              : "Đã gửi thông báo."),
        );
        event.target.reset();
        updateNotificationTargetUi();
        loadNotifications();
      } else {
        errorEl.textContent = res?.data?.message || "Không thể gửi thông báo.";
      }
    });
}

async function loadNotifications() {
  setStackLoading("notifications-list", "Đang tải thông báo...");
  const state = paginationState.notifications;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/notifications/my?${query.toString()}`);
  adminNotifications = applyServerPagination("notifications", res?.data);
  renderNotificationsList();
  loadAdminNotificationCount();
}

async function loadAdminNotificationCount() {
  const badge = document.getElementById("admin-notif-badge");
  if (!badge) return;

  const res = await callApi("/notifications/my");
  const notifications = Array.isArray(res?.data) ? res.data : [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  badge.textContent = String(unreadCount);
  badge.hidden = unreadCount === 0;
}

function renderNotificationsList() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  updatePaginationUi(
    "notifications",
    paginationState.notifications.totalItems || adminNotifications.length,
  );

  if (!adminNotifications.length) {
    container.innerHTML = '<div class="empty-state">Chưa có thông báo nào.</div>';
    return;
  }

  container.innerHTML = adminNotifications
    .map(
      (item) => `
        <article class="queue-item ${item.isRead ? "" : "unread-notification"}" data-notification-id="${item.id}">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="pill neutral">${item.isRead ? "Đã đọc" : "Chưa đọc"}</span>
            </div>
            <div class="queue-meta">
                <span>${formatDate(item.createdAt)}</span>
                <span>User #${escapeHtml(item.userId)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.message)}</p>
        </article>
    `,
    )
    .join("");

  container.querySelectorAll(".queue-item.unread-notification").forEach((item) => {
    item.addEventListener("click", async () => {
      const id = item.dataset.notificationId;
      if (!id) return;
      const res = await callApi(`/notifications/${id}/read`, { method: "PUT" });
      if (!res?.ok) return;
      item.classList.remove("unread-notification");
      const pill = item.querySelector(".pill");
      if (pill) pill.textContent = "Đã đọc";
      loadAdminNotificationCount();
    });
  });
}
