
function bindAdminHeader() {
  const fullName =
    localStorage.getItem("fullName") ||
    sessionStorage.getItem("fullName") ||
    "Quản trị viên";
  document.getElementById("admin-name").textContent = fullName;
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    const confirmLogout =
      typeof showAppConfirm === "function"
        ? showAppConfirm({
            title: "Đăng xuất",
            message: "Bạn có chắc muốn đăng xuất khỏi khu vực quản trị không?",
            confirmText: "Đăng xuất",
            cancelText: "Ở lại",
          })
        : Promise.resolve(confirm("Bạn có chắc muốn đăng xuất?"));

    confirmLogout.then((confirmed) => {
      if (confirmed) logout();
    });
  });
  initWelcomeMenu();
}

function initWelcomeMenu() {
  const menu = document.getElementById("welcome-menu");
  const trigger = document.getElementById("welcome-trigger");
  if (!menu || !trigger) return;

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const opened = menu.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(opened));
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) {
      menu.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

function bindNavigation() {
  document.querySelectorAll(".nav-link[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-link")
        .forEach((item) => item.classList.remove("active"));
      document
        .querySelectorAll(".panel")
        .forEach((panel) => panel.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(button.dataset.target)?.classList.add("active");
    });
  });
}

function bindReloadButtons() {
  document
    .getElementById("refresh-dashboard-btn")
    ?.addEventListener("click", loadOverview);
  document
    .getElementById("reload-registrations-btn")
    ?.addEventListener("click", loadRegistrations);
  document
    .getElementById("reload-requests-btn")
    ?.addEventListener("click", loadRequests);
  document
    .getElementById("reload-transfers-btn")
    ?.addEventListener("click", loadTransfers);
  document
    .getElementById("reload-renewals-btn")
    ?.addEventListener("click", loadRenewals);
  document
    .getElementById("reload-contracts-btn")
    ?.addEventListener("click", loadContracts);
  document
    .getElementById("reload-invoices-btn")
    ?.addEventListener("click", loadInvoices);
  document
    .getElementById("reload-rooms-btn")
    ?.addEventListener("click", loadRooms);
  document
    .getElementById("reload-students-btn")
    ?.addEventListener("click", loadStudents);
  document
    .getElementById("reload-notifications-btn")
    ?.addEventListener("click", loadNotifications);
}
