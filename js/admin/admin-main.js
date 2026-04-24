
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
  loadFacilitiesInventory();
  loadStudents();
  loadNotifications();
});
