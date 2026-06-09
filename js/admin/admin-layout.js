
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

const ADMIN_AUTO_REFRESH_INTERVAL_MS = 15000;
let lastAdminAutoRefreshAt = Date.now();
let pendingAdminRealtimeRefresh = false;
let adminRealtimeRefreshTimer = null;

function loadAdminSectionData(sectionId) {
  lastAdminAutoRefreshAt = Date.now();
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
    "section-revenue": () => {
      if (typeof adminRevenueHasLoaded !== "undefined" && adminRevenueHasLoaded) {
        loadRevenue();
      }
    },
    "section-notifications": () => {
      loadNotifications();
      if (typeof loadAdminInbox === "function") loadAdminInbox();
    },
  };

  loaders[sectionId]?.();
}

function getActiveAdminSectionId() {
  return document.querySelector(".panel.active")?.id || "section-overview";
}

function shouldPauseAdminAutoRefresh() {
  if (document.visibilityState !== "visible") return true;
  const active = document.activeElement;
  if (active?.matches?.("input, textarea, select")) return true;
  if (document.body.classList.contains("modal-open")) return true;
  return false;
}

function refreshActiveAdminSection(force = false) {
  if (shouldPauseAdminAutoRefresh()) return;
  const now = Date.now();
  if (!force && now - lastAdminAutoRefreshAt < ADMIN_AUTO_REFRESH_INTERVAL_MS) return;
  loadAdminSectionData(getActiveAdminSectionId());
}

function scheduleAdminRealtimeRefresh() {
  if (shouldPauseAdminAutoRefresh()) {
    pendingAdminRealtimeRefresh = true;
    return;
  }
  window.clearTimeout(adminRealtimeRefreshTimer);
  adminRealtimeRefreshTimer = window.setTimeout(() => {
    refreshActiveAdminSection(true);
  }, 250);
}

function bindAdminAutoRefresh() {
  lastAdminAutoRefreshAt = Date.now();
  let lastHandledChangeAt = 0;
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshActiveAdminSection(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (pendingAdminRealtimeRefresh) {
      pendingAdminRealtimeRefresh = false;
      refreshActiveAdminSection(true);
      return;
    }
    refreshActiveAdminSection();
  });
  document.addEventListener("focusout", () => {
    if (!pendingAdminRealtimeRefresh) return;
    window.setTimeout(() => {
      if (shouldPauseAdminAutoRefresh()) return;
      pendingAdminRealtimeRefresh = false;
      refreshActiveAdminSection(true);
    }, 0);
  });
  if (typeof onDataChanged === "function") {
    onDataChanged((detail = {}) => {
      const now = Date.now();
      if (detail.at && detail.at === lastHandledChangeAt) return;
      if (now - lastHandledChangeAt < 800) return;
      lastHandledChangeAt = detail.at || now;
      scheduleAdminRealtimeRefresh();
    });
  }
  window.setInterval(refreshActiveAdminSection, ADMIN_AUTO_REFRESH_INTERVAL_MS);
}
