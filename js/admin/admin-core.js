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
    rejected: "Từ chối",
    active: "Đang hiệu lực",
    inactive: "Vô hiệu",
    completed: "Đã duyệt",
    cancelled: "Đã hủy",
    terminated: "Đã thanh lý",
    draft: "Nháp",
    expired: "Hết hạn",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    damaged: "Hư hỏng",
    undermaintenance: "Đang bảo trì",
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
  const value = window.prompt(message);
  return value == null ? null : value.trim();
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
