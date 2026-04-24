// ======================================================================
// THÔNG BÁO ADMIN – Tách 2 luồng:
//   1. loadAdminInbox()      → GET /notifications/my  (hệ thống → admin)
//   2. loadNotifications()   → GET /notifications     (admin đã gửi → sinh viên)
// ======================================================================

// ── Filters cho lịch sử đã gửi ──────────────────────────────────────
function getNotificationFilters() {
  return {
    searchText: document.getElementById("notif-search")?.value.trim() || "",
    fromDate: document.getElementById("notif-from-date")?.value || "",
    toDate: document.getElementById("notif-to-date")?.value || "",
  };
}

/** Cắt ngắn văn bản, thêm "..." nếu vượt quá maxLen ký tự */
function truncateHtml(text, maxLen = 120) {
  if (!text) return '';
  text = String(text);
  if (text.length <= maxLen) return escapeHtml(text);
  return escapeHtml(text.slice(0, maxLen).trimEnd()) + '...';
}

/** Hiện modal chi tiết thông báo */
function showNotifModal({ title, date, message }) {
  const overlay = document.getElementById('notif-detail-modal');
  if (!overlay) return;
  document.getElementById('notif-modal-title').textContent = title || '';
  document.getElementById('notif-modal-date').textContent  = date  || '';
  document.getElementById('notif-modal-body').textContent  = message || '';
  overlay.style.display = 'flex';

  document.getElementById('notif-modal-close-btn').onclick = () => {
    overlay.style.display = 'none';
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { overlay.style.display = 'none'; document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

function setNotificationError(message = "") {
  const el = document.getElementById("notif-form-error");
  if (el) el.textContent = message;
}

// ── Bind form tạo/gửi thông báo ─────────────────────────────────────
function bindNotificationForm() {
  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");

  const updateNotificationTargetUi = () => {
    if (!targetTypeEl || !userIdEl) return;
    const isSingleTarget = targetTypeEl.value === "single";
    userIdEl.disabled = !!selectedNotificationId || !isSingleTarget;
    if (!isSingleTarget && !selectedNotificationId) userIdEl.value = "";
  };

  targetTypeEl?.addEventListener("change", updateNotificationTargetUi);

  document
    .getElementById("reset-notification-form-btn")
    ?.addEventListener("click", resetNotificationForm);

  // Nút tải lại inbox
  document
    .getElementById("reload-admin-inbox-btn")
    ?.addEventListener("click", () => loadAdminInbox());

  // Nút toggle lịch sử đã gửi
  document
    .getElementById("toggle-sent-history-btn")
    ?.addEventListener("click", () => {
      const panel = document.getElementById("sent-history-panel");
      const btn = document.getElementById("toggle-sent-history-btn");
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.textContent = isOpen ? "📋 Xem lịch sử đã gửi" : "📋 Ẩn lịch sử đã gửi";
      // Load lần đầu khi mở
      if (!isOpen) {
        resetPage("notifications");
        loadNotifications();
      }
    });

  // Nút tải lại bên trong panel lịch sử
  document
    .getElementById("reload-notifications-btn")
    ?.addEventListener("click", () => {
      resetPage("notifications");
      loadNotifications();
    });

  // Filter thay đổi → load lại lịch sử đã gửi
  const reloadFilteredNotifications = () => {
    resetPage("notifications");
    loadNotifications();
  };
  document
    .getElementById("notif-search")
    ?.addEventListener("input", reloadFilteredNotifications);
  document
    .getElementById("notif-from-date")
    ?.addEventListener("change", reloadFilteredNotifications);
  document
    .getElementById("notif-to-date")
    ?.addEventListener("change", reloadFilteredNotifications);

  updateNotificationTargetUi();

  // Chỉ load inbox khi vào section.
  // Lịch sử đã gửi sẽ load khi nhấn toggle.
  loadAdminInbox();

  // Submit form gửi thông báo
  document
    .getElementById("notification-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setNotificationError("");

      const targetType =
        document.getElementById("notif-target-type")?.value || "single";
      const sendToAllStudents = targetType === "all-students";
      const userId = Number(document.getElementById("notif-user-id").value);
      const title = document.getElementById("notif-title").value.trim();
      const message = document.getElementById("notif-message").value.trim();

      if (!title || !message) {
        setNotificationError("Vui lòng nhập đủ tiêu đề và nội dung.");
        return;
      }

      const res = selectedNotificationId
        ? await callApi(`/notifications/${selectedNotificationId}`, {
            method: "PUT",
            body: JSON.stringify({ title, message }),
          })
        : await createNotification({ sendToAllStudents, userId, title, message });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (selectedNotificationId
              ? "Đã cập nhật thông báo."
              : "Đã gửi thông báo."),
        );
        resetNotificationForm();
        loadNotifications(); // reload lịch sử đã gửi
      } else {
        setNotificationError(
          res?.data?.message ||
            (selectedNotificationId
              ? "Không thể cập nhật thông báo."
              : "Không thể gửi thông báo."),
        );
      }
    });
}

async function createNotification({ sendToAllStudents, userId, title, message }) {
  if (!sendToAllStudents && !userId) {
    setNotificationError("Vui lòng nhập User ID hợp lệ.");
    return null;
  }

  return callApi("/notifications", {
    method: "POST",
    body: JSON.stringify({
      userId: sendToAllStudents ? null : userId,
      sendToAllStudents,
      title,
      message,
    }),
  });
}

function resetNotificationForm() {
  selectedNotificationId = null;
  const form = document.getElementById("notification-form");
  form?.reset();
  document.getElementById("notif-target-type").disabled = false;
  document.getElementById("notif-user-id").disabled = false;
  document.getElementById("notif-form-mode").textContent = "Tạo mới";
  document.getElementById("save-notification-btn").textContent = "Gửi thông báo";
  setNotificationError("");

  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");
  if (targetTypeEl?.value !== "single") {
    userIdEl.disabled = true;
    userIdEl.value = "";
  }
  renderNotificationsList(); // cập nhật highlight trong lịch sử đã gửi
}

function editNotification(item) {
  selectedNotificationId = item.id;
  document.getElementById("notif-target-type").value = "single";
  document.getElementById("notif-target-type").disabled = true;
  document.getElementById("notif-user-id").value = item.userId || "";
  document.getElementById("notif-user-id").disabled = true;
  document.getElementById("notif-title").value = item.title || "";
  document.getElementById("notif-message").value = item.message || "";
  document.getElementById("notif-form-mode").textContent = `Đang sửa #${item.id}`;
  document.getElementById("save-notification-btn").textContent = "Cập nhật thông báo";
  setNotificationError("");
  renderNotificationsList();
}

// ── 1. INBOX: Thông báo hệ thống gửi cho admin ──────────────────────
async function loadAdminInbox() {
  const container = document.getElementById("admin-inbox-list");
  const badge = document.getElementById("admin-notif-badge");
  if (!container) return;

  container.innerHTML = '<div class="loading-state">Đang tải thông báo đến...</div>';

  const res = await callApi("/notifications/my");
  const items = Array.isArray(res?.data) ? res.data : [];

  // Cập nhật badge số chưa đọc
  const unreadCount = items.filter((n) => !n.isRead).length;
  if (badge) {
    badge.textContent = String(unreadCount);
    badge.hidden = unreadCount === 0;
  }

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Chưa có thông báo nào từ hệ thống.</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (n) => `
      <article class="queue-item ${n.isRead ? '' : 'unread-notification'}" data-inbox-id="${n.id}" data-title="${escapeHtml(n.title)}" data-msg="${escapeHtml(n.message)}" data-date="${formatDate(n.createdAt)}" style="cursor:pointer;">
          <div class="queue-head">
              <strong>${escapeHtml(n.title)}</strong>
              <span class="pill ${n.isRead ? 'neutral' : ''}">${n.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <div class="queue-meta">
              <span>${formatDate(n.createdAt)}</span>
          </div>
          <p class="queue-preview">${truncateHtml(n.message, 120)}</p>
          ${n.message.length > 120 ? '<span class="queue-expand-hint">▼ Xem chi tiết</span>' : ''}
      </article>`,
    )
    .join("");

  // Click → mở modal + đánh dấu đã đọc
  container.querySelectorAll("article[data-inbox-id]").forEach((article) => {
    article.addEventListener("click", async () => {
      showNotifModal({
        title:   article.dataset.title,
        date:    article.dataset.date,
        message: article.dataset.msg,
      });
      if (article.classList.contains("unread-notification")) {
        const id = article.dataset.inboxId;
        await callApi(`/notifications/${id}/read`, { method: "PUT" });
        article.classList.remove("unread-notification");
        const pill = article.querySelector(".pill");
        if (pill) { pill.textContent = "Đã đọc"; pill.classList.add("neutral"); }
        loadAdminInbox();
      }
    });
  });
}

// ── Tổng hợp badge (dùng ở nơi khác trong app) ──────────────────────
async function loadAdminNotificationCount() {
  const badge = document.getElementById("admin-notif-badge");
  if (!badge) return;

  const res = await callApi("/notifications/my");
  const notifications = Array.isArray(res?.data) ? res.data : [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  badge.textContent = String(unreadCount);
  badge.hidden = unreadCount === 0;
}

// ── 2. LỊCH SỬ ĐÃ GỬI: thông báo admin tạo gửi sinh viên ───────────
async function loadNotifications() {
  setStackLoading("notifications-list", "Đang tải lịch sử đã gửi...");
  const state = paginationState.notifications;
  const filters = getNotificationFilters();
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (filters.searchText) query.set("searchText", filters.searchText);
  if (filters.fromDate) query.set("fromDate", filters.fromDate);
  if (filters.toDate) query.set("toDate", filters.toDate);

  const res = await callApi(`/notifications?${query.toString()}`);
  adminNotifications = applyServerPagination("notifications", res?.data);
  renderNotificationsList();
}

function renderNotificationsList() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  updatePaginationUi(
    "notifications",
    paginationState.notifications.totalItems || adminNotifications.length,
  );

  if (!adminNotifications.length) {
    container.innerHTML = '<div class="empty-state">Chưa có thông báo nào đã gửi.</div>';
    return;
  }

  container.innerHTML = adminNotifications
    .map(
      (item) => `
        <article class="queue-item ${selectedNotificationId === item.id ? 'is-selected' : ''}" data-notification-id="${item.id}" data-title="${escapeHtml(item.title)}" data-msg="${escapeHtml(item.message)}" data-date="${formatDate(item.createdAt)}" style="cursor:pointer;">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="pill neutral">Gửi: <strong>${item.userId ? `User #${escapeHtml(String(item.userId))}` : 'Tất cả sinh viên'}</strong></span>
            </div>
            <div class="queue-meta"><span>${formatDate(item.createdAt)}</span></div>
            <p class="queue-preview">${truncateHtml(item.message, 120)}</p>
            ${item.message.length > 120 ? '<span class="queue-expand-hint">▼ Xem chi tiết</span>' : ''}
            <div class="queue-actions" style="margin-top:8px;">
                <button type="button" class="secondary-btn" data-notif-edit="${item.id}">Sửa</button>
                <button type="button" class="danger-btn" data-notif-delete="${item.id}">Xóa</button>
            </div>
        </article>
    `,
    )
    .join("");

  // Click vào card → mở modal (ngoại trừ nút Sửa/Xóa)
  container.querySelectorAll("article[data-notification-id]").forEach((article) => {
    article.addEventListener("click", (e) => {
      if (e.target.closest(".queue-actions")) return;
      showNotifModal({
        title:   article.dataset.title,
        date:    article.dataset.date,
        message: article.dataset.msg,
      });
    });
  });

  container.querySelectorAll("[data-notif-edit]").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const notification = adminNotifications.find(
        (item) => item.id === Number(button.dataset.notifEdit),
      );
      if (notification) editNotification(notification);
    });
  });

  container.querySelectorAll("[data-notif-delete]").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(button.dataset.notifDelete);
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xóa thông báo",
              message: "Bạn có chắc muốn xóa thông báo này không?",
              confirmText: "Xóa",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn xóa thông báo này không?");
      if (!confirmed) return;

      const res = await callApi(`/notifications/${id}`, { method: "DELETE" });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã xóa thông báo.");
        if (selectedNotificationId === id) resetNotificationForm();
        loadNotifications();
      } else {
        adminToast(res?.data?.message || "Không thể xóa thông báo.", true);
      }
    });
  });
}

