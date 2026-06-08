
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
  document
    .getElementById("header-notif-btn-main")
    ?.addEventListener("click", () => {
      showAdminSection("section-notifications");
      if (typeof loadAdminInbox === "function") loadAdminInbox();
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
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showAdminSection(button.dataset.target);
      loadAdminSectionData(button.dataset.target);
    });
  });

  document.getElementById("sidebar-collapse-btn")?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });
}

function showAdminSection(sectionId) {
  if (!sectionId) return;

  document
    .querySelectorAll(".nav-link")
    .forEach((item) => item.classList.remove("active"));
  document
    .querySelectorAll(".panel")
    .forEach((panel) => panel.classList.remove("active"));

  document
    .querySelector(`.nav-link[data-target="${sectionId}"]`)
    ?.classList.add("active");
  document.getElementById(sectionId)?.classList.add("active");
}

function loadAdminSectionData(sectionId) {
  const loaders = {
    "section-overview": () => loadOverview(),
    "section-admin-profile": () => loadAdminProfile(),
    "section-registrations": () => loadRegistrations(),
    "section-requests": () => loadRequests(),
    "section-transfers": () => loadTransfers(),
    "section-renewals": () => loadRenewals(),
    "section-contracts": () => loadContracts(),
    "section-invoices": () => loadInvoices(),
    "section-rooms": () => loadRooms(),
    "section-facilities": () => {
      loadFacilityRooms();
      loadFacilitiesInventory();
    },
    "section-students": () => loadStudents(),
    "section-notifications": () => {
      loadNotifications();
      if (typeof loadAdminInbox === "function") loadAdminInbox();
    },
  };

  loaders[sectionId]?.();
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
