
document.addEventListener("DOMContentLoaded", () => {
  bindAdminHeader();
  bindNavigation();
  bindOverviewShortcuts();
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
  connectRealtimeUpdates();
  bindAdminAutoRefresh();
});
