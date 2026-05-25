function adminToast(message, isError = false) {
  const toast = document.getElementById("admin-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? "#991b1b" : "#1f2937";
  toast.classList.add("show");
  window.clearTimeout(adminToast._timer);
  adminToast._timer = window.setTimeout(
    () => toast.classList.remove("show"),
    2600,
  );
}

function adminBadge(status) {
  const value = String(status || "").toLowerCase();
  const labels = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    inprogress: "\u0110ang s\u1eeda",
    rejected: "Từ chối",
    active: "Đang hiệu lực",
    inactive: "Vô hiệu",
    completed: "Ho\u00e0n th\u00e0nh",
    cancelled: "Đã hủy",
    terminated: "Đã chấm dứt",
    draft: "Nháp",
    expired: "Hết hạn",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    good: "Ho\u1ea1t \u0111\u1ed9ng t\u1ed1t",
    damaged: "H\u01b0 h\u1ecfng",
    undermaintenance: "\u0110ang b\u1ea3o tr\u00ec",
  };
  return `<span class="status-badge ${value}">${labels[value] || status || "Không rõ"}</span>`;
}

function setStackLoading(id, message) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty-state">${message}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function promptNote(message) {
  const overlay = document.getElementById("note-input-modal");
  const form = document.getElementById("note-input-form");
  const title = document.getElementById("note-input-title");
  const label = document.getElementById("note-input-label");
  const textarea = document.getElementById("note-input-text");
  const closeBtn = document.getElementById("note-input-close-btn");
  const cancelBtn = document.getElementById("note-input-cancel-btn");

  if (!overlay || !form || !textarea || !closeBtn || !cancelBtn) {
    const value = window.prompt(message);
    return Promise.resolve(value == null ? null : value.trim());
  }

  if (title) title.textContent = "Nhập thông tin xử lý";
  if (label) label.textContent = message;
  textarea.value = "";
  overlay.style.display = "flex";
  window.setTimeout(() => textarea.focus(), 0);

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.style.display = "none";
      form.removeEventListener("submit", handleSubmit);
      closeBtn.removeEventListener("click", handleCancel);
      cancelBtn.removeEventListener("click", handleCancel);
      overlay.removeEventListener("click", handleOverlayClick);
      document.removeEventListener("keydown", handleKey);
    };

    const done = (value) => {
      cleanup();
      resolve(value);
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      done(textarea.value.trim());
    };
    const handleCancel = () => done(null);
    const handleOverlayClick = (event) => {
      if (event.target === overlay) done(null);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") done(null);
    };

    form.addEventListener("submit", handleSubmit);
    closeBtn.addEventListener("click", handleCancel);
    cancelBtn.addEventListener("click", handleCancel);
    overlay.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleKey);
  });
}

async function withAction(button, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Đang xử lý...";
  try {
    await task();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
