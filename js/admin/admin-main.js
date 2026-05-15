
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
  loadRegistrations();
  loadRequests();
  loadTransfers();
  loadRenewals();
  loadContracts();
  loadInvoices();
  loadRooms();
  loadFacilityRooms();
  loadFacilitiesInventory();
  loadStudents();
  loadNotifications();
});
