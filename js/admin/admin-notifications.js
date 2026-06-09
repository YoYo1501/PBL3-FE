// ======================================================================
// THÃ”NG BÃO ADMIN â€“ TÃ¡ch 2 luá»“ng:
//   1. loadAdminInbox()      â†’ GET /notifications/my  (há»‡ thá»‘ng â†’ admin)
//   2. loadNotifications()   â†’ GET /notifications     (admin Ä‘Ã£ gá»­i â†’ sinh viÃªn)
// ======================================================================

// â”€â”€ Filters cho lá»‹ch sá»­ Ä‘Ã£ gá»­i â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getNotificationFilters() {
  return {
    searchText: document.getElementById("notif-search")?.value.trim() || "",
    fromDate: document.getElementById("notif-from-date")?.value || "",
    toDate: document.getElementById("notif-to-date")?.value || "",
  };
}

/** Cáº¯t ngáº¯n vÄƒn báº£n, thÃªm "..." náº¿u vÆ°á»£t quÃ¡ maxLen kÃ½ tá»± */
function truncateHtml(text, maxLen = 120) {
  if (!text) return '';
  text = String(text);
  if (text.length <= maxLen) return escapeHtml(text);
  return escapeHtml(text.slice(0, maxLen).trimEnd()) + '...';
}

function repairVietnameseMojibake(value) {
  const text = String(value || "");
  if (!/[ÃÂÄÆáºá»]/.test(text)) return text;

  try {
    const bytes = Array.from(text, (char) => {
      const code = char.charCodeAt(0);
      return code <= 255 ? `%${code.toString(16).padStart(2, "0")}` : char;
    }).join("");
    return decodeURIComponent(bytes);
  } catch {
    return text;
  }
}

function formatSystemNotificationText(value) {
  return repairVietnameseMojibake(value)
    .replace(/\bYeu cau sinh vien moi\b/gi, "Yêu cầu sinh viên mới")
    .replace(/\bYeu cau gia han hop dong moi\b/gi, "Yêu cầu gia hạn hợp đồng mới")
    .replace(/\bYeu cau chuyen phong moi\b/gi, "Yêu cầu chuyển phòng mới")
    .replace(/\bDon dang ky o tru moi\b/gi, "Đơn đăng ký ở trú mới")
    .replace(/\bSinh vien\b/gi, "Sinh viên")
    .replace(/\bvua gui\b/gi, "vừa gửi")
    .replace(/\bye[uê] cau\b/gi, "yêu cầu")
    .replace(/\bgia han\b/gi, "gia hạn")
    .replace(/\bhop dong\b/gi, "hợp đồng")
    .replace(/\bdon dang ky\b/gi, "đơn đăng ký")
    .replace(/\bdang ky\b/gi, "đăng ký")
    .replace(/\bo tru\b/gi, "ở trú")
    .replace(/\bchuyen phong\b/gi, "chuyển phòng")
    .replace(/\bvao phong\b/gi, "vào phòng")
    .replace(/\bsang phong\b/gi, "sang phòng")
    .replace(/\bphong\b/gi, "phòng")
    .replace(/\bthuoc loai\b/gi, "thuộc loại")
    .replace(/\bOther\b/g, "Khác");
}

/** Hiá»‡n modal chi tiáº¿t thÃ´ng bÃ¡o */
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

function updateAdminNotificationBadges(unreadCount) {
  document.querySelectorAll(".admin-notif-count").forEach((badge) => {
    badge.textContent = String(unreadCount);
    badge.hidden = unreadCount === 0;
  });
}

const adminInboxState = {
  page: 1,
  size: 6,
  items: [],
};

let notificationStudentSearchTimer = null;
let notificationStudentSearchSeq = 0;
let selectedNotificationStudent = null;

function getNotificationKind(item) {
  const text = formatSystemNotificationText(`${item?.title || ""} ${item?.message || ""}`).toLowerCase();
  if (text.includes("gia hạn") || text.includes("gia han")) return "renewal";
  if (text.includes("đăng ký") || text.includes("dang ky")) return "registration";
  if (text.includes("chuyển phòng") || text.includes("chuyen phong")) return "transfer";
  if (text.includes("yêu cầu") || text.includes("yeu cau")) return "request";
  return "default";
}

function notificationIcon(kind) {
  const icons = {
    renewal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 15h6"/><path d="M9 11h3"/></svg>',
    registration: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="m9 15 2 2 4-5"/></svg>',
    transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    request: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>',
  };
  return icons[kind] || icons.default;
}

function getInboxTotalPages() {
  return Math.max(1, Math.ceil(adminInboxState.items.length / adminInboxState.size));
}

function getInboxPageNumbers(totalPages) {
  if (totalPages <= 6) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const current = adminInboxState.page;
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

function updateAdminInboxPagination() {
  const wrapper = document.getElementById("admin-inbox-pagination");
  const prevBtn = document.getElementById("admin-inbox-prev-btn");
  const nextBtn = document.getElementById("admin-inbox-next-btn");
  const pagesEl = document.getElementById("admin-inbox-pages");
  if (!wrapper || !pagesEl) return;

  const totalItems = adminInboxState.items.length;
  const totalPages = getInboxTotalPages();
  if (adminInboxState.page > totalPages) adminInboxState.page = totalPages;

  wrapper.hidden = totalItems === 0;
  if (prevBtn) prevBtn.disabled = adminInboxState.page <= 1;
  if (nextBtn) nextBtn.disabled = adminInboxState.page >= totalPages;
  let previousPage = 0;
  pagesEl.innerHTML = getInboxPageNumbers(totalPages)
    .map((page) => {
      const gap = previousPage && page - previousPage > 1 ? '<span class="notification-page-gap">...</span>' : "";
      previousPage = page;
      return `${gap}<button type="button" class="notification-page-btn ${page === adminInboxState.page ? "active" : ""}" data-inbox-page="${page}">${page}</button>`;
    })
    .join("");
}

function renderAdminInboxList() {
  const container = document.getElementById("admin-inbox-list");
  if (!container) return;

  const items = adminInboxState.items;
  updateAdminInboxPagination();

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Chưa có thông báo nào từ hệ thống.</div>';
    return;
  }

  const start = (adminInboxState.page - 1) * adminInboxState.size;
  const pageItems = items.slice(start, start + adminInboxState.size);

  container.innerHTML = pageItems
    .map((n) => {
      const kind = getNotificationKind(n);
      const title = formatSystemNotificationText(n.title || "Thông báo");
      const message = formatSystemNotificationText(n.message || "");
      return `
        <article class="notification-inbox-item ${n.isRead ? "is-read" : "is-unread"}" data-inbox-id="${n.id}" data-title="${escapeHtml(title)}" data-msg="${escapeHtml(message)}" data-date="${formatDate(n.createdAt)}">
          <span class="notification-inbox-icon ${kind}">${notificationIcon(kind)}</span>
          <div class="notification-inbox-content">
            <strong>${escapeHtml(title)}</strong>
            <p>${truncateHtml(message, 110)}</p>
          </div>
          <div class="notification-inbox-meta">
            <span class="notification-read-pill ${n.isRead ? "read" : "unread"}">${n.isRead ? "Đã đọc" : "Chưa đọc"}</span>
            <time>${formatDate(n.createdAt)}</time>
          </div>
          <span class="notification-unread-dot" aria-hidden="true"></span>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("article[data-inbox-id]").forEach((article) => {
    article.addEventListener("click", async () => {
      showNotifModal({
        title: article.dataset.title,
        date: article.dataset.date,
        message: article.dataset.msg,
      });
      if (!article.classList.contains("is-unread")) return;

      const id = article.dataset.inboxId;
      const res = await callApi(`/notifications/${id}/read`, { method: "PUT" });
      if (res?.ok) {
        const item = adminInboxState.items.find((n) => String(n.id) === String(id));
        if (item) item.isRead = true;
        updateAdminNotificationBadges(adminInboxState.items.filter((n) => !n.isRead).length);
        renderAdminInboxList();
      }
    });
  });
}

function getStudentNotificationUserId(student) {
  return Number(student?.userId ?? student?.UserId ?? 0);
}

function getStudentNotificationId(student) {
  return Number(student?.id ?? student?.Id ?? 0);
}

function getStudentNotificationName(student) {
  return student?.fullName || student?.FullName || "Sinh viên";
}

function getStudentNotificationCitizenId(student) {
  return student?.citizenId || student?.CitizenId || "-";
}

function getStudentNotificationEmail(student) {
  return student?.email || student?.Email || "-";
}

function getStudentNotificationPhone(student) {
  return student?.phone || student?.Phone || "-";
}

function getStudentNotificationRoom(student) {
  return student?.roomCode || student?.RoomCode || "Chưa có phòng";
}

function clearNotificationStudentSelection(options = {}) {
  notificationStudentSearchSeq += 1;
  selectedNotificationStudent = null;
  const userIdEl = document.getElementById("notif-user-id");
  const searchEl = document.getElementById("notif-student-search");
  const selectedEl = document.getElementById("notif-student-selected");
  const suggestionsEl = document.getElementById("notif-student-suggestions");

  if (userIdEl) userIdEl.value = "";
  if (searchEl && !options.keepSearch) searchEl.value = "";
  if (selectedEl) {
    selectedEl.hidden = true;
    selectedEl.innerHTML = "";
  }
  if (suggestionsEl) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  }
}

function setNotificationStudentSelection(student) {
  const userId = getStudentNotificationUserId(student);
  if (!userId) {
    setNotificationError("Không tìm thấy User ID của sinh viên được chọn.");
    return;
  }

  selectedNotificationStudent = student;
  const userIdEl = document.getElementById("notif-user-id");
  const searchEl = document.getElementById("notif-student-search");
  const selectedEl = document.getElementById("notif-student-selected");
  const suggestionsEl = document.getElementById("notif-student-suggestions");
  const name = getStudentNotificationName(student);
  const citizenId = getStudentNotificationCitizenId(student);
  const email = getStudentNotificationEmail(student);
  const room = getStudentNotificationRoom(student);

  if (userIdEl) userIdEl.value = String(userId);
  if (searchEl) searchEl.value = `${name} - ${citizenId}`;
  if (suggestionsEl) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  }
  if (selectedEl) {
    selectedEl.hidden = false;
    selectedEl.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>CCCD: ${escapeHtml(citizenId)}</span>
      <span>Email: ${escapeHtml(email)}</span>
      <span>Phòng: ${escapeHtml(room)}</span>
    `;
  }
  setNotificationError("");
}

function renderNotificationStudentSuggestions(students, keyword) {
  const suggestionsEl = document.getElementById("notif-student-suggestions");
  if (!suggestionsEl) return;

  if (!students.length) {
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML = `<div class="notification-student-empty">Không tìm thấy sinh viên phù hợp với "${escapeHtml(keyword)}".</div>`;
    return;
  }

  suggestionsEl.hidden = false;
  suggestionsEl.innerHTML = students
    .map((student) => {
      const userId = getStudentNotificationUserId(student);
      const studentId = getStudentNotificationId(student);
      const isSelectable = userId > 0;
      return `
        <button type="button" class="notification-student-option" data-user-id="${userId}" data-student-id="${studentId}" ${isSelectable ? "" : "disabled"}>
          <strong>${escapeHtml(getStudentNotificationName(student))}</strong>
          <span>${escapeHtml(getStudentNotificationCitizenId(student))}</span>
          <span>${escapeHtml(getStudentNotificationEmail(student))}</span>
          <small>${isSelectable
            ? `${escapeHtml(getStudentNotificationRoom(student))} • ${escapeHtml(getStudentNotificationPhone(student))}`
            : "Thiếu User ID - vui lòng restart backend để tải dữ liệu mới"}</small>
        </button>
      `;
    })
    .join("");

  suggestionsEl.querySelectorAll("[data-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const student = students.find((item) =>
        getStudentNotificationUserId(item) === Number(button.dataset.userId) &&
        getStudentNotificationId(item) === Number(button.dataset.studentId)
      );
      if (student) setNotificationStudentSelection(student);
    });
  });
}

async function searchNotificationStudents(keyword) {
  const suggestionsEl = document.getElementById("notif-student-suggestions");
  if (!suggestionsEl) return;

  const requestSeq = ++notificationStudentSearchSeq;
  suggestionsEl.hidden = false;
  suggestionsEl.innerHTML = '<div class="notification-student-empty">Đang tìm sinh viên...</div>';

  const query = new URLSearchParams({
    page: "1",
    pageSize: "6",
    keyword,
  });

  try {
    const res = await callApi(`/students?${query.toString()}`);
    if (requestSeq !== notificationStudentSearchSeq) return;
    if (!res?.ok) {
      suggestionsEl.innerHTML = '<div class="notification-student-empty">Không thể tải danh sách sinh viên.</div>';
      return;
    }

    const students = Array.isArray(res.data?.items)
      ? res.data.items
      : (Array.isArray(res.data) ? res.data : []);
    renderNotificationStudentSuggestions(students, keyword);
  } catch (error) {
    if (requestSeq !== notificationStudentSearchSeq) return;
    suggestionsEl.innerHTML = '<div class="notification-student-empty">Không thể tải danh sách sinh viên.</div>';
  }
}

function bindNotificationStudentPicker() {
  const searchEl = document.getElementById("notif-student-search");
  const clearBtn = document.getElementById("notif-student-clear-btn");
  const suggestionsEl = document.getElementById("notif-student-suggestions");
  if (!searchEl || searchEl._notificationPickerBound) return;
  searchEl._notificationPickerBound = true;

  searchEl.addEventListener("input", () => {
    clearNotificationStudentSelection({ keepSearch: true });
    window.clearTimeout(notificationStudentSearchTimer);
    const keyword = searchEl.value.trim();
    if (keyword.length < 2) {
      if (suggestionsEl) {
        suggestionsEl.hidden = true;
        suggestionsEl.innerHTML = "";
      }
      return;
    }
    notificationStudentSearchTimer = window.setTimeout(() => {
      searchNotificationStudents(keyword);
    }, 250);
  });

  searchEl.addEventListener("focus", () => {
    const keyword = searchEl.value.trim();
    if (!selectedNotificationStudent && keyword.length >= 2) searchNotificationStudents(keyword);
  });

  clearBtn?.addEventListener("click", () => {
    clearNotificationStudentSelection();
    searchEl.focus();
  });

  document.addEventListener("click", (event) => {
    const picker = document.getElementById("notif-student-picker");
    if (!picker?.contains(event.target) && suggestionsEl) suggestionsEl.hidden = true;
  });
}

// â”€â”€ Bind form táº¡o/gá»­i thÃ´ng bÃ¡o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function bindNotificationForm() {
  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");
  const studentSearchEl = document.getElementById("notif-student-search");
  const studentPickerField = document.getElementById("notif-student-picker-field");

  const updateNotificationTargetUi = () => {
    if (!targetTypeEl || !userIdEl) return;
    const isSingleTarget = targetTypeEl.value === "single";
    const shouldDisablePicker = !!selectedNotificationId || !isSingleTarget;
    userIdEl.disabled = shouldDisablePicker;
    if (studentSearchEl) studentSearchEl.disabled = shouldDisablePicker;
    if (studentPickerField) studentPickerField.hidden = !isSingleTarget;
    studentPickerField?.classList.toggle("is-disabled", shouldDisablePicker);
    if (!isSingleTarget && !selectedNotificationId) clearNotificationStudentSelection();
  };

  targetTypeEl?.addEventListener("change", updateNotificationTargetUi);
  bindNotificationStudentPicker();

  const messageEl = document.getElementById("notif-message");
  const messageCountEl = document.getElementById("notif-message-count");
  const updateMessageCount = () => {
    if (messageCountEl) messageCountEl.textContent = `${messageEl?.value.length || 0}/1000`;
  };
  messageEl?.addEventListener("input", updateMessageCount);
  updateMessageCount();

  document
    .getElementById("reset-notification-form-btn")
    ?.addEventListener("click", resetNotificationForm);

  // NÃºt toggle lá»‹ch sá»­ Ä‘Ã£ gá»­i
  document
    .getElementById("toggle-sent-history-btn")
    ?.addEventListener("click", () => {
      const panel = document.getElementById("sent-history-panel");
      const btn = document.getElementById("toggle-sent-history-btn");
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.textContent = isOpen ? "Xem lịch sử đã gửi" : "Ẩn lịch sử đã gửi";
      // Load láº§n Ä‘áº§u khi má»Ÿ
      if (!isOpen) {
        resetPage("notifications");
        loadNotifications();
      }
    });

  // Filter thay Ä‘á»•i â†’ load láº¡i lá»‹ch sá»­ Ä‘Ã£ gá»­i
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

  document.getElementById("admin-inbox-prev-btn")?.addEventListener("click", () => {
    if (adminInboxState.page <= 1) return;
    adminInboxState.page -= 1;
    renderAdminInboxList();
  });
  document.getElementById("admin-inbox-next-btn")?.addEventListener("click", () => {
    if (adminInboxState.page >= getInboxTotalPages()) return;
    adminInboxState.page += 1;
    renderAdminInboxList();
  });
  document.getElementById("admin-inbox-pages")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-inbox-page]");
    if (!button) return;
    adminInboxState.page = Number(button.dataset.inboxPage) || 1;
    renderAdminInboxList();
  });

  updateNotificationTargetUi();

  // Chá»‰ load inbox khi vÃ o section.
  // Lá»‹ch sá»­ Ä‘Ã£ gá»­i sáº½ load khi nháº¥n toggle.
  loadAdminInbox();

  // Submit form gá»­i thÃ´ng bÃ¡o
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
        loadNotifications(); // reload lá»‹ch sá»­ Ä‘Ã£ gá»­i
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
    setNotificationError("Vui lòng tìm và chọn đúng sinh viên nhận thông báo.");
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
  document.getElementById("notif-student-search").disabled = false;
  const pickerField = document.getElementById("notif-student-picker-field");
  if (pickerField) {
    pickerField.hidden = false;
    pickerField.classList.remove("is-disabled");
  }
  clearNotificationStudentSelection();
  document.getElementById("notif-form-mode").textContent = "Tạo mới";
  document.getElementById("save-notification-btn").textContent = "Gửi thông báo";
  const messageCountEl = document.getElementById("notif-message-count");
  if (messageCountEl) messageCountEl.textContent = "0/1000";
  setNotificationError("");

  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");
  if (targetTypeEl?.value !== "single") {
    userIdEl.disabled = true;
    clearNotificationStudentSelection();
    if (pickerField) pickerField.hidden = true;
  }
  renderNotificationsList(); // cáº­p nháº­t highlight trong lá»‹ch sá»­ Ä‘Ã£ gá»­i
}

function editNotification(item) {
  selectedNotificationId = item.id;
  const isBroadcast = !!item.isBroadcast;
  document.getElementById("notif-target-type").value = isBroadcast ? "all-students" : "single";
  document.getElementById("notif-target-type").disabled = true;
  document.getElementById("notif-user-id").value = isBroadcast ? "" : item.userId || "";
  document.getElementById("notif-user-id").disabled = true;
  const studentSearchEl = document.getElementById("notif-student-search");
  if (studentSearchEl) {
    studentSearchEl.value = isBroadcast ? "" : (item.recipientName || `User #${item.userId || ""}`);
    studentSearchEl.disabled = true;
  }
  const pickerField = document.getElementById("notif-student-picker-field");
  if (pickerField) {
    pickerField.hidden = isBroadcast;
    pickerField.classList.toggle("is-disabled", true);
  }
  const selectedEl = document.getElementById("notif-student-selected");
  if (selectedEl) {
    selectedEl.hidden = isBroadcast;
    selectedEl.innerHTML = isBroadcast ? "" : `<strong>${escapeHtml(item.recipientName || `User #${item.userId || ""}`)}</strong><span>Đang sửa thông báo đã gửi</span>`;
  }
  document.getElementById("notif-student-suggestions")?.setAttribute("hidden", "");
  document.getElementById("notif-title").value = item.title || "";
  document.getElementById("notif-message").value = item.message || "";
  const messageCountEl = document.getElementById("notif-message-count");
  if (messageCountEl) messageCountEl.textContent = `${document.getElementById("notif-message").value.length}/1000`;
  document.getElementById("notif-form-mode").textContent = isBroadcast
    ? "Đang sửa thông báo gửi tất cả"
    : `Đang sửa #${item.id}`;
  document.getElementById("save-notification-btn").textContent = "Cập nhật thông báo";
  setNotificationError("");
  renderNotificationsList();
}

// â”€â”€ 1. INBOX: ThÃ´ng bÃ¡o há»‡ thá»‘ng gá»­i cho admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Tá»•ng há»£p badge (dÃ¹ng á»Ÿ nÆ¡i khÃ¡c trong app) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadAdminInbox() {
  const container = document.getElementById("admin-inbox-list");
  if (!container) return;

  container.innerHTML = '<div class="empty-state">Đang tải thông báo đến...</div>';

  const res = await callApi("/notifications/my");
  const items = Array.isArray(res?.data) ? res.data : [];
  adminInboxState.items = items;
  adminInboxState.page = 1;

  updateAdminNotificationBadges(items.filter((n) => !n.isRead).length);
  renderAdminInboxList();
}

async function loadAdminNotificationCount() {
  const res = await callApi("/notifications/my");
  const notifications = Array.isArray(res?.data) ? res.data : [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  updateAdminNotificationBadges(unreadCount);
}

// â”€â”€ 2. Lá»ŠCH Sá»¬ ÄÃƒ Gá»¬I: thÃ´ng bÃ¡o admin táº¡o gá»­i sinh viÃªn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      (item) => {
        const title = formatSystemNotificationText(item.title);
        const message = formatSystemNotificationText(item.message);
        const isBroadcast = !!item.isBroadcast;
        const recipient = isBroadcast
          ? "Tất cả sinh viên"
          : item.recipientName || (item.userId ? `User #${item.userId}` : "Tất cả sinh viên");
        return `
        <article class="queue-item notification-history-item ${selectedNotificationId === item.id ? 'is-selected' : ''}" data-notification-id="${item.id}" data-title="${escapeHtml(title)}" data-msg="${escapeHtml(message)}" data-date="${formatDate(item.createdAt)}" style="cursor:pointer;">
            <div class="notification-history-title">
                <strong>${escapeHtml(title)}</strong>
                <span class="pill neutral notification-recipient-pill">Gửi đến: <strong>${escapeHtml(recipient)}</strong></span>
            </div>
            <div class="queue-meta notification-history-date"><span>${formatDate(item.createdAt)}</span></div>
            <div class="notification-history-message">
                <p class="queue-preview">${truncateHtml(message, 120)}</p>
                ${item.message.length > 120 ? '<span class="queue-expand-hint">▼ Xem chi tiết</span>' : ''}
            </div>
            <div class="queue-actions notification-history-actions">
                <button type="button" class="secondary-btn" data-notif-edit="${item.id}">Sửa</button>
                <button type="button" class="danger-btn" data-notif-delete="${item.id}">Xóa</button>
            </div>
        </article>
    `;
      },
    )
    .join("");

  // Click vÃ o card â†’ má»Ÿ modal (ngoáº¡i trá»« nÃºt Sá»­a/XÃ³a)
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
      const notification = adminNotifications.find((item) => item.id === id);
      const isBroadcast = !!notification?.isBroadcast;
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xóa thông báo",
              message: isBroadcast
                ? "Bạn có chắc muốn xóa thông báo đã gửi đến tất cả sinh viên không?"
                : "Bạn có chắc muốn xóa thông báo này không?",
              confirmText: "Xóa",
              cancelText: "Hủy",
            })
          : confirm(
              isBroadcast
                ? "Bạn có chắc muốn xóa thông báo đã gửi đến tất cả sinh viên không?"
                : "Bạn có chắc muốn xóa thông báo này không?",
            );
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

