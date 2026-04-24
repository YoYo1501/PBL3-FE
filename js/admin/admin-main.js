
document.addEventListener("DOMContentLoaded", () => {
  bindAdminHeader();
  bindNavigation();
  bindReloadButtons();
  bindPaginationControls();
  bindRegistrationControls();
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
