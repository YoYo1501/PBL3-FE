
const paginationState = {
  registrations: { page: 1, size: 5 },
  requests: { page: 1, size: 5 },
  transfers: { page: 1, size: 5 },
  renewals: { page: 1, size: 5 },
  invoices: { page: 1, size: 8 },
  rooms: { page: 1, size: 8 },
  facilities: { page: 1, size: 8 },
  students: { page: 1, size: 8 },
  revenue: { page: 1, size: 8 },
  notifications: { page: 1, size: 8 },
};

function bindPaginationControls() {
  bindPaginationControl("registrations", loadRegistrations);
  bindPaginationControl("requests", loadRequests);
  bindPaginationControl("transfers", loadTransfers);
  bindPaginationControl("renewals", loadRenewals);
  bindPaginationControl("invoices", loadInvoices);
  bindPaginationControl("rooms", loadRooms);
  bindPaginationControl("facilities", loadFacilitiesInventory);
  bindPaginationControl("students", loadStudents);
  bindPaginationControl("revenue", loadRevenue);
  bindPaginationControl("notifications", loadNotifications);
}

function bindPaginationControl(key, loadFn) {
  document.getElementById(`${key}-prev-btn`)?.addEventListener("click", () => {
    if ((paginationState[key]?.page || 1) <= 1) return;
    paginationState[key].page -= 1;
    loadFn();
  });
  document.getElementById(`${key}-next-btn`)?.addEventListener("click", () => {
    paginationState[key].page += 1;
    loadFn();
  });
}

function resetPage(key) {
  if (paginationState[key]) paginationState[key].page = 1;
}

function updatePaginationUi(key, totalItems) {
  const wrapper = document.getElementById(`${key}-pagination`);
  const prevBtn = document.getElementById(`${key}-prev-btn`);
  const nextBtn = document.getElementById(`${key}-next-btn`);
  const info = document.getElementById(`${key}-page-info`);
  const state = paginationState[key];
  if (!state) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.size));
  if (state.page > totalPages) state.page = totalPages;
  if (info) info.textContent = `Trang ${state.page} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages;
  if (wrapper) wrapper.hidden = totalItems <= state.size;
}

function applyServerPagination(key, data) {
  const state = paginationState[key];
  if (!state) return [];
  const items = Array.isArray(data?.items) ? data.items : [];
  if (typeof data?.page === "number") state.page = data.page;
  if (typeof data?.pageSize === "number") state.size = data.pageSize;
  state.totalItems =
    typeof data?.totalItems === "number" ? data.totalItems : items.length;
  return items;
}

function preparePagedList(key, elementId, items, emptyHtml) {
  const container = document.getElementById(elementId);
  if (!container) return null;

  updatePaginationUi(key, paginationState[key].totalItems || items.length);

  if (!items.length) {
    container.innerHTML = emptyHtml;
    return null;
  }

  return container;
}
