
document.addEventListener("DOMContentLoaded", () => {
  bindAdminHeader();
  bindNavigation();
  bindOverviewShortcuts();
  bindReloadButtons();
  bindPaginationControls();
  bindRegistrationControls();
  bindRequestControls();
  bindTransferControls();
  bindRenewalControls();
  bindAdminProfileControls();
  bindNotificationForm();
  bindInvoiceControls();
  bindContractControls();
  bindRoomControls();
  bindFacilityControls();
  bindStudentControls();
  bindRevenueControls();

  loadOverview();
  loadAdminProfile();
  bindOverviewAutoRefresh();
});

function isOverviewActive() {
  return document.getElementById("section-overview")?.classList.contains("active");
}

function bindOverviewAutoRefresh() {
  window.addEventListener("pageshow", () => {
    if (isOverviewActive()) loadOverview();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isOverviewActive()) {
      loadOverview();
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === "visible" && isOverviewActive()) {
      loadOverview();
    }
  }, 30000);
}
