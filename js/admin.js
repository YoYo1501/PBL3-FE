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
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    draft: "Nháp",
    expired: "Hết hạn",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
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

let adminContracts = [];
let selectedContractId = null;
let contractPage = 1;
let contractTotalItems = 0;
const CONTRACTS_PAGE_SIZE = 6;
let adminRegistrations = [];
let adminRequests = [];
let adminTransfers = [];
let adminRenewals = [];
let adminRooms = [];
let roomBuildings = [];
let selectedRoomId = null;
let selectedFacilityId = null;
let selectedRoomFacilities = [];
let adminStudents = [];
let selectedStudentId = null;
let adminInvoices = [];
let adminNotifications = [];
let adminRevenueDetails = [];
const paginationState = {
  registrations: { page: 1, size: 5 },
  requests: { page: 1, size: 5 },
  transfers: { page: 1, size: 5 },
  renewals: { page: 1, size: 5 },
  invoices: { page: 1, size: 8 },
  rooms: { page: 1, size: 8 },
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

document.addEventListener("DOMContentLoaded", () => {
  bindAdminHeader();
  bindNavigation();
  bindReloadButtons();
  bindPaginationControls();
  bindNotificationForm();
  bindInvoiceControls();
  bindContractControls();
  bindRoomControls();
  bindStudentControls();
  bindRevenueControls(); //10. Doanh thu
  loadOverview(); //1. Tổng quan
  loadRegistrations(); //2. Đơn đăng ký
  loadRequests(); //3. Yêu cầu sinh viên
  loadTransfers(); //4. Chuyển phòng
  loadRenewals(); //5. Gia hạn hợp đồng
  loadContracts(); //6. quản lýHợp đồng
  loadInvoices(); //7. Hoa don
  loadRooms(); ////8.phòng và thiết bị phòng
  loadStudents(); //9. Sinh viên
  loadNotifications(); //11. Thông báo
});

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
  document.querySelectorAll(".nav-link").forEach((button) => {
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

function getContractFilters() {
  return {
    keyword:
      document.getElementById("contract-search")?.value.trim().toLowerCase() ||
      "",
    status: document.getElementById("contract-filter-status")?.value || "",
  };
}

function setContractError(message = "") {
  const el = document.getElementById("contract-form-error");
  if (el) el.textContent = message;
}

function bindContractControls() {
  const rerenderContracts = () => {
    contractPage = 1;
    loadContracts();
  };
  document
    .getElementById("contract-search")
    ?.addEventListener("input", rerenderContracts);
  document
    .getElementById("contract-filter-status")
    ?.addEventListener("change", rerenderContracts);
  document
    .getElementById("contracts-prev-btn")
    ?.addEventListener("click", () => {
      if (contractPage <= 1) return;
      contractPage -= 1;
      loadContracts();
    });
  document
    .getElementById("contracts-next-btn")
    ?.addEventListener("click", () => {
      contractPage += 1;
      loadContracts();
    });

  document
    .getElementById("contract-edit-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedContractId) {
        setContractError("Vui lòng chọn một hợp đồng trước khi cập nhật.");
        return;
      }

      const startDate = document.getElementById("contract-start-date").value;
      const endDate = document.getElementById("contract-end-date").value;
      const priceValue = document.getElementById("contract-price").value;
      const status = document.getElementById("contract-status").value;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        setContractError("Ngay bat dau khong duoc lon hon ngay ket thuc.");
        return;
      }

      const payload = {};
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (priceValue !== "") payload.price = Number(priceValue);
      if (status) payload.status = status;

      if (!Object.keys(payload).length) {
        setContractError("Hãy nhập ít nhất một thông tin cần cập nhật.");
        return;
      }

      const res = await callApi(`/contracts/${selectedContractId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        adminToast(res.data?.message || "Đã cập nhật hợp đồng.");
        setContractError("");
        await loadContracts();
        if (selectedContractId) await selectContract(selectedContractId);
      } else {
        setContractError(res?.data?.message || "Không thể cập nhật hợp đồng.");
      }
    });

  document
    .getElementById("deactivate-contract-btn")
    ?.addEventListener("click", async () => {
      if (!selectedContractId) {
        setContractError("Vui lòng chọn một hợp đồng trước khi vô hiệu hóa.");
        return;
      }

      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Vô hiệu hóa hợp đồng",
              message: "Bạn có chắc muốn vô hiệu hóa hợp đồng này không?",
              confirmText: "Vô hiệu hóa",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn vô hiệu hóa hợp đồng này không?");

      if (!confirmed) return;

      const res = await callApi(`/contracts/${selectedContractId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã vô hiệu hóa hợp đồng.");
        selectedContractId = null;
        clearContractDetail();
        loadContracts();
      } else {
        setContractError(
          res?.data?.message || "Không thể vô hiệu hóa hợp đồng.",
        );
      }
    });
}

function getInvoiceFilters() {
  return {
    period:
      document.getElementById("invoice-filter-period")?.value.trim() || "",
    status: document.getElementById("invoice-filter-status")?.value || "",
  };
}

function getActiveInvoicePeriod() {
  const filterPeriod = document
    .getElementById("invoice-filter-period")
    ?.value.trim();
  if (filterPeriod) return filterPeriod;
  return (
    document.getElementById("invoice-generate-period")?.value.trim() ||
    document.getElementById("invoice-import-period")?.value.trim() ||
    ""
  );
}

function setInvoiceActionError(message = "") {
  const el = document.getElementById("invoice-action-error");
  if (el) el.textContent = message;
}

function bindInvoiceControls() {
  const importForm = document.getElementById("invoice-import-form");
  const generateForm = document.getElementById("invoice-generate-form");

  if (!document.getElementById("invoice-filter-period")?.value) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("invoice-filter-period").value = period;
    document.getElementById("invoice-import-period").value = period;
    document.getElementById("invoice-generate-period").value = period;
  }

  importForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("invoice-import-error");
    errorEl.textContent = "";

    const period = document
      .getElementById("invoice-import-period")
      .value.trim();
    const file = document.getElementById("invoice-import-file").files?.[0];

    if (!period) {
      errorEl.textContent = "Vui lòng nhập kỳ hóa đơn.";
      return;
    }
    if (!file) {
      errorEl.textContent = "Vui lòng chọn file Excel.";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await callApiUpload(
      `/invoices/import?period=${encodeURIComponent(period)}`,
      formData,
    );
    if (res?.ok) {
      adminToast(res.data?.message || "Đã import dữ liệu điện nước.");
      document.getElementById("invoice-filter-period").value = period;
      setInvoiceActionError("");
    } else {
      errorEl.textContent =
        res?.data?.message || "Không thể import file Excel.";
    }
  });

  generateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("invoice-generate-error");
    errorEl.textContent = "";

    const period = document
      .getElementById("invoice-generate-period")
      .value.trim();
    const electricPricePerKwh = Number(
      document.getElementById("invoice-electric-price").value,
    );
    const waterPricePerM3 = Number(
      document.getElementById("invoice-water-price").value,
    );

    if (!period) {
      errorEl.textContent = "Vui lòng nhập kỳ hóa đơn.";
      return;
    }
    if (!(electricPricePerKwh > 0) || !(waterPricePerM3 > 0)) {
      errorEl.textContent = "Gia dien va gia nu>c phai l>n hon 0.";
      return;
    }

    const res = await callApi("/invoices/generate", {
      method: "POST",
      body: JSON.stringify({ period, electricPricePerKwh, waterPricePerM3 }),
    });

    if (res?.ok) {
      adminToast(res.data?.message || "Đã tạo hóa đơn nháp.");
      document.getElementById("invoice-filter-period").value = period;
      loadInvoices();
    } else {
      errorEl.textContent = res?.data?.message || "Không thể tạo hóa đơn nháp.";
    }
  });

  const reloadFilteredInvoices = () => {
    resetPage("invoices");
    loadInvoices();
  };
  document
    .getElementById("invoice-filter-period")
    ?.addEventListener("input", reloadFilteredInvoices);
  document
    .getElementById("invoice-filter-status")
    ?.addEventListener("change", reloadFilteredInvoices);

  document
    .getElementById("publish-invoices-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      if (!period) {
        setInvoiceActionError("Vui lòng nhập kỳ hóa đơn trước khi phát hành.");
        return;
      }

      const res = await callApi(
        `/invoices/publish?period=${encodeURIComponent(period)}`,
        { method: "POST" },
      );
      if (res?.ok) {
        adminToast(res.data?.message || "Đã phát hành hóa đơn.");
        setInvoiceActionError("");
        loadInvoices();
      } else {
        setInvoiceActionError(
          res?.data?.message || "Không thể phát hành hóa đơn.",
        );
      }
    });

  document
    .getElementById("remind-debt-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      const query = period ? `?period=${encodeURIComponent(period)}` : "";
      const res = await callApi(`/invoices/remind-debt${query}`, {
        method: "POST",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã gửi nhắc nợ.");
        setInvoiceActionError("");
      } else {
        setInvoiceActionError(res?.data?.message || "Không thể gửi nhắc nợ.");
      }
    });

  document
    .getElementById("export-invoices-btn")
    ?.addEventListener("click", async () => {
      const period = getActiveInvoicePeriod();
      if (!period) {
        setInvoiceActionError("Vui lòng nhập kỳ hóa đơn trước khi xuất file.");
        return;
      }

      const res = await callApiBlob(
        `/invoices/export?period=${encodeURIComponent(period)}`,
      );
      if (!res?.ok || !res.blob) {
        setInvoiceActionError("Không thể xuất file hóa đơn.");
        return;
      }

      const url = URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HoaDon_${period}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      adminToast("Đã xuất file Excel hóa đơn.");
      setInvoiceActionError("");
    });
}
//1. Tổng quan
async function loadOverview() {
  setStackLoading("overview-pending-feed", "Đang tải dữ liệu chờ xử lý...");
  setStackLoading("overview-room-feed", "Đang tải tình trạng phòng...");

  const [registrations, requests, transfers, renewals, rooms] =
    await Promise.all([
      callApi("/registrations/pending"),
      callApi("/studentrequests?status=Pending"),
      callApi("/roomtransfers/pending"),
      callApi("/contracts/renewals/pending"),
      callApi("/room"),
    ]);

  const regList = Array.isArray(registrations?.data) ? registrations.data : [];
  const reqList = Array.isArray(requests?.data) ? requests.data : [];
  const transferList = Array.isArray(transfers?.data) ? transfers.data : [];
  const renewalList = Array.isArray(renewals?.data) ? renewals.data : [];
  const roomList = Array.isArray(rooms?.data) ? rooms.data : [];

  document.getElementById("stat-registrations").textContent = regList.length;
  document.getElementById("stat-requests").textContent = reqList.length;
  document.getElementById("stat-transfers").textContent = transferList.length;
  document.getElementById("stat-renewals").textContent = renewalList.length;

  const pendingFeed = [
    ...regList.slice(0, 3).map((item) => ({
      title: item.fullName,
      meta: `${item.registrationCode}  -  ${item.roomCode || "Chua co phong"}`,
      type: "Dang ky moi",
    })),
    ...reqList.slice(0, 3).map((item) => ({
      title: item.title,
      meta: `${item.studentName}  -  ${item.requestType}`,
      type: "Yeu cau sinh vien",
    })),
    ...transferList.slice(0, 3).map((item) => ({
      title: `${item.fromRoomCode} -> ${item.toRoomCode}`,
      meta: item.reason || "Không có lý do",
      type: "Chuyen phong",
    })),
    ...renewalList.slice(0, 3).map((item) => ({
      title: item.contractCode,
      meta: item.packageName,
      type: "Gia han",
    })),
  ];

  document.getElementById("overview-pending-feed").innerHTML =
    pendingFeed.length
      ? pendingFeed
          .map(
            (item) => `
            <div class="queue-item">
                <div class="queue-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill">${escapeHtml(item.type)}</span>
                </div>
                <p class="queue-body">${escapeHtml(item.meta)}</p>
            </div>
        `,
          )
          .join("")
      : '<div class="empty-state">Hien khong co muc nao dang cho xu ly.</div>';

  const roomSummary = summarizeRooms(roomList);
  document.getElementById("overview-room-feed").innerHTML = roomSummary.length
    ? roomSummary
        .map(
          (item) => `
            <div class="queue-item">
                <div class="queue-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill neutral">${escapeHtml(item.value)}</span>
                </div>
                <p class="queue-body">${escapeHtml(item.description)}</p>
            </div>
        `,
        )
        .join("")
    : '<div class="empty-state">Chua lay duoc du lieu phong.</div>';
}

function summarizeRooms(rooms) {
  if (!rooms.length) return [];
  const available = rooms.filter((room) => room.availableSlots > 0).length;
  const full = rooms.filter((room) => (room.availableSlots ?? 0) <= 0).length;
  const male = rooms.filter((room) => room.genderAllowed === "Nam").length;
  const female = rooms.filter((room) => room.genderAllowed === "Nu").length;

  return [
    {
      title: "Phong con cho",
      value: `${available}`,
      description: "Cac phong con the nhan them sinh vien.",
    },
    {
      title: "Phong da day",
      value: `${full}`,
      description: "Can theo doi de can doi khi co yeu cau chuyen.",
    },
    {
      title: "Phong nam",
      value: `${male}`,
      description: "Tong so phong dang danh cho sinh vien nam.",
    },
    {
      title: "Phong nu",
      value: `${female}`,
      description: "Tong so phong dang danh cho sinh vien nu.",
    },
  ];
}
//2. Đơn đăng ký
async function loadRegistrations() {
  setStackLoading("registrations-list", "Đang tải danh sách đăng ký...");
  const state = paginationState.registrations;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/registrations/pending?${query.toString()}`);
  adminRegistrations = applyServerPagination("registrations", res?.data);
  renderRegistrationsList();
}

function renderRegistrationsList() {
  const container = preparePagedList(
    "registrations",
    "registrations-list",
    adminRegistrations,
    '<div class="empty-state">Không có đơn đăng ký nào đang chờ duyệt.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRegistrations
    .map(
      (item) => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fullName)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Mã đơn: ${escapeHtml(item.registrationCode)}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || "-")}</span>
                <span>${formatDate(item.startDate)} - ${formatDate(item.endDate)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-reg-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-reg-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");
  // Duyệt đơn đăng ký
  container.querySelectorAll("[data-reg-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/registrations/${button.dataset.regApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: true,
              rejectionReason: "Hồ sơ hợp lệ",
            }),
          },
        );
        if (resApprove?.ok) {
          adminToast("Đã duyệt đơn đăng ký.");
          loadRegistrations();
          loadOverview();
        } else {
          adminToast(
            resApprove?.data?.message || "Không thể duyệt đơn đăng ký.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-reg-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = promptNote("Nhập lý do từ chối đơn đăng ký:");
        if (reason == null) return;
        const resReject = await callApi(
          `/registrations/${button.dataset.regReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Hồ sơ chưa đáp ứng yêu cầu",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast("Đã từ chối đơn đăng ký.");
          loadRegistrations();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message || "Không thể từ chối đơn đăng ký.",
            true,
          );
        }
      }),
    );
  });
}
//3. Yêu cầu sinh viên
async function loadRequests() {
  setStackLoading("requests-list", "Đang tải yêu cầu sinh viên...");
  const state = paginationState.requests;
  const query = new URLSearchParams({
    status: "Pending",
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/studentrequests?${query.toString()}`);
  adminRequests = applyServerPagination("requests", res?.data);
  renderRequestsList();
}

function renderRequestsList() {
  const container = preparePagedList(
    "requests",
    "requests-list",
    adminRequests,
    '<div class="empty-state">Không có yêu cầu sinh viên nào đang chờ.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRequests
    .map(
      (item) => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>${escapeHtml(item.studentName)}</span>
                <span>Loại: ${escapeHtml(item.requestType)}</span>
                <span>Phòng: ${escapeHtml(item.roomCode || "-")}</span>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.description)}</p>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-req-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-req-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");

  bindRequestStatusAction(
    container,
    "[data-req-approve]",
    "reqApprove",
    "Approved",
    "Nhập ghi chú duyệt yêu cầu:",
  );
  bindRequestStatusAction(
    container,
    "[data-req-reject]",
    "reqReject",
    "Rejected",
    "Nhập lý do từ chối yêu cầu:",
  );
}

function bindRequestStatusAction(
  container,
  selector,
  datasetKey,
  status,
  promptMessage,
) {
  container.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const note = promptNote(promptMessage);
        if (note == null) return;
        const requestId = button.dataset[datasetKey];
        const res = await callApi(`/studentrequests/${requestId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, resolutionNote: note || null }),
        });
        if (res?.ok) {
          adminToast("Da cap nhat trang thai yeu cau.");
          loadRequests();
          loadOverview();
        } else {
          adminToast(res?.data?.message || "Không thể cập nhật yêu cầu.", true);
        }
      }),
    );
  });
}

//4. Chuyển phòng

async function loadTransfers() {
  setStackLoading("transfers-list", "Đang tải yêu cầu chuyển phòng...");
  const state = paginationState.transfers;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/roomtransfers/pending?${query.toString()}`);
  adminTransfers = applyServerPagination("transfers", res?.data);
  renderTransfersList();
}

function renderTransfersList() {
  const container = preparePagedList(
    "transfers",
    "transfers-list",
    adminTransfers,
    '<div class="empty-state">Không có yêu cầu chuyển phòng đang chờ.</div>',
  );
  if (!container) return;

  container.innerHTML = adminTransfers
    .map(
      (item) => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.fromRoomCode)} -> ${escapeHtml(item.toRoomCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Ngay gui: ${formatDate(item.requestedAt)}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.reason || "Không có lý do")}</p>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-transfer-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-transfer-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");
  // Admin bấm duyệt/từ chối yêu cầu chuyển phòng
  container.querySelectorAll("[data-transfer-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/roomtransfers/${button.dataset.transferApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({ isApproved: true, rejectionReason: null }),
          },
        );
        if (resApprove?.ok) {
          adminToast("Đã duyệt yêu cầu chuyển phòng.");
          loadTransfers();
          loadOverview();
        } else {
          adminToast(
            resApprove?.data?.message ||
              "Không thể duyệt yêu cầu chuyển phòng.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-transfer-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = promptNote("Nhập lý do từ chối yêu cầu chuyển phòng:");
        if (reason == null) return;
        const resReject = await callApi(
          `/roomtransfers/${button.dataset.transferReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Khong phu hop dieu kien chuyen phong",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast("Đã từ chối yêu cầu chuyển phòng.");
          loadTransfers();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message ||
              "Không thể từ chối yêu cầu chuyển phòng.",
            true,
          );
        }
      }),
    );
  });
}
//5. Gia hạn hợp đồng

async function loadRenewals() {
  setStackLoading("renewals-list", "Đang tải yêu cầu gia hạn...");
  const state = paginationState.renewals;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/contracts/renewals/pending?${query.toString()}`);
  adminRenewals = applyServerPagination("renewals", res?.data);
  renderRenewalsList();
}

function renderRenewalsList() {
  const container = preparePagedList(
    "renewals",
    "renewals-list",
    adminRenewals,
    '<div class="empty-state">Không có yêu cầu gia hạn nào đang chờ.</div>',
  );
  if (!container) return;

  container.innerHTML = adminRenewals
    .map(
      (item) => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.contractCode)}</strong>
                ${adminBadge(item.status)}
            </div>
            <div class="queue-meta">
                <span>Goi: ${escapeHtml(item.packageName)}</span>
                <span>Ngay gui: ${formatDate(item.requestedAt)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="primary-btn" data-renewal-approve="${item.id}">Duyệt</button>
                <button type="button" class="danger-btn" data-renewal-reject="${item.id}">Từ chối</button>
            </div>
        </article>
    `,
    )
    .join("");

  container.querySelectorAll("[data-renewal-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resApprove = await callApi(
          `/contracts/renewals/${button.dataset.renewalApprove}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({ isApproved: true, rejectionReason: null }),
          },
        );
        if (resApprove?.ok) {
          adminToast("Đã duyệt yêu cầu gia hạn.");
          loadRenewals();
          loadOverview();
        } else {
          adminToast(
            resApprove?.data?.message || "Không thể duyệt yêu cầu gia hạn.",
            true,
          );
        }
      }),
    );
  });

  container.querySelectorAll("[data-renewal-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const reason = promptNote("Nhập lý do từ chối gia hạn hợp đồng:");
        if (reason == null) return;
        const resReject = await callApi(
          `/contracts/renewals/${button.dataset.renewalReject}/approve`,
          {
            method: "PUT",
            body: JSON.stringify({
              isApproved: false,
              rejectionReason: reason || "Chua du dieu kien gia han",
            }),
          },
        );
        if (resReject?.ok) {
          adminToast("Đã từ chối yêu cầu gia hạn.");
          loadRenewals();
          loadOverview();
        } else {
          adminToast(
            resReject?.data?.message || "Không thể từ chối yêu cầu gia hạn.",
            true,
          );
        }
      }),
    );
  });
}
//6. Hợp đồng
async function loadContracts() {
  const tbody = document.getElementById("contracts-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" class="table-empty">Đang tải danh sách hợp đồng...</td></tr>';
  const filters = getContractFilters();
  const query = new URLSearchParams({
    page: String(contractPage),
    pageSize: String(CONTRACTS_PAGE_SIZE),
  });
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.status) query.set("status", filters.status);

  const res = await callApi(`/contracts?${query.toString()}`);
  adminContracts = Array.isArray(res?.data?.items) ? res.data.items : [];
  contractPage = Number(res?.data?.page || contractPage);
  contractTotalItems = Number(res?.data?.totalItems || adminContracts.length);
  renderContractsTable();

  if (selectedContractId) {
    const exists = adminContracts.some(
      (contract) => contract.id === selectedContractId,
    );
    if (exists) {
      await selectContract(selectedContractId);
    } else {
      selectedContractId = null;
      clearContractDetail();
    }
  }
}

function renderContractsTable() {
  const tbody = document.getElementById("contracts-table-body");
  const pageInfo = document.getElementById("contracts-page-info");
  const prevBtn = document.getElementById("contracts-prev-btn");
  const nextBtn = document.getElementById("contracts-next-btn");
  if (!tbody) return;

  const totalPages = Math.max(
    1,
    Math.ceil(contractTotalItems / CONTRACTS_PAGE_SIZE),
  );
  if (contractPage > totalPages) contractPage = totalPages;
  if (contractPage < 1) contractPage = 1;

  if (pageInfo) pageInfo.textContent = `Trang ${contractPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = contractPage <= 1;
  if (nextBtn) nextBtn.disabled = contractPage >= totalPages;

  if (!adminContracts.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="table-empty">Không có hợp đồng phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminContracts
    .map(
      (contract) => `
        <tr class="${selectedContractId === contract.id ? "is-selected" : ""}">
            <td><strong>${escapeHtml(contract.contractCode)}</strong></td>
            <td>${escapeHtml(contract.studentName || "-")}</td>
            <td>${escapeHtml(contract.roomCode || "-")} (${escapeHtml(contract.roomType || "-")})</td>
            <td>${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}</td>
            <td>${escapeHtml(formatCurrency(contract.price))}</td>
            <td>${adminBadge(contract.status)}</td>
            <td>
                <button type="button" class="secondary-btn" data-contract-view="${contract.id}">Chon</button>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-contract-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectContract(Number(button.dataset.contractView)),
    );
  });
}

async function selectContract(contractId) {
  const res = await callApi(`/contracts/${contractId}`);
  const contract = res?.ok ? res.data : null;
  if (!contract) {
    adminToast(res?.data?.message || "Không thể lấy chi tiết hợp đồng.", true);
    return;
  }

  selectedContractId = contract.id;
  document.getElementById("contract-detail-code").textContent =
    contract.contractCode || "Da chon";
  document.getElementById("contract-detail-student").textContent =
    contract.studentName || "-";
  document.getElementById("contract-detail-room").textContent =
    `${contract.roomCode || "-"} (${contract.roomType || "-"})`;
  document.getElementById("contract-detail-days").textContent =
    `${contract.daysRemaining ?? 0} ngay`;
  document.getElementById("contract-detail-renew").textContent =
    contract.canRenew ? "Co the gia han" : "Chua den han gia han";

  document.getElementById("contract-start-date").value = toDateInputValue(
    contract.startDate,
  );
  document.getElementById("contract-end-date").value = toDateInputValue(
    contract.endDate,
  );
  document.getElementById("contract-price").value = contract.price ?? "";
  document.getElementById("contract-status").value = contract.status || "";
  setContractError("");
  renderContractsTable();
}

function clearContractDetail() {
  document.getElementById("contract-detail-code").textContent = "Chua chon";
  document.getElementById("contract-detail-student").textContent = "-";
  document.getElementById("contract-detail-room").textContent = "-";
  document.getElementById("contract-detail-days").textContent = "-";
  document.getElementById("contract-detail-renew").textContent = "-";
  document.getElementById("contract-start-date").value = "";
  document.getElementById("contract-end-date").value = "";
  document.getElementById("contract-price").value = "";
  document.getElementById("contract-status").value = "";
  setContractError("");
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getRoomFilters() {
  return {
    keyword:
      document.getElementById("room-search")?.value.trim().toLowerCase() || "",
    status: document.getElementById("room-filter-status")?.value || "",
  };
}

function setRoomError(message = "") {
  const el = document.getElementById("room-form-error");
  if (el) el.textContent = message;
}

function setFacilityError(message = "") {
  const el = document.getElementById("facility-form-error");
  if (el) el.textContent = message;
}
//phòng và thiết bị phòng
function bindRoomControls() {
  const rerenderRooms = () => {
    resetPage("rooms");
    loadRooms();
  };
  document
    .getElementById("room-search")
    ?.addEventListener("input", rerenderRooms);
  document
    .getElementById("room-filter-status")
    ?.addEventListener("change", rerenderRooms);

  document.getElementById("new-room-btn")?.addEventListener("click", () => {
    selectedRoomId = null;
    selectedFacilityId = null;
    selectedRoomFacilities = [];
    clearRoomDetail();
    renderRoomsTable();
  });

  document
    .getElementById("room-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const buildingId = Number(
        document.getElementById("room-building-id").value,
      );
      const roomCode = document.getElementById("room-code").value.trim();
      const roomType = document.getElementById("room-type").value.trim();
      const capacity = Number(document.getElementById("room-capacity").value);
      const currentOccupancy = Number(
        document.getElementById("room-occupancy").value,
      );
      const price = Number(document.getElementById("room-price").value);
      const status = document.getElementById("room-status").value;

      if (
        !buildingId ||
        !roomCode ||
        !roomType ||
        !(capacity > 0) ||
        price < 0
      ) {
        setRoomError("Vui lòng nhập đầy đủ thông tin phòng hợp lệ.");
        return;
      }
      if (currentOccupancy > capacity) {
        setRoomError("So nguoi hien tai khong duoc lon hon suc chua.");
        return;
      }

      const payload = { roomType, capacity, currentOccupancy, status, price };
      let res;
      if (selectedRoomId) {
        res = await callApi(`/room/${selectedRoomId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        res = await callApi("/room", {
          method: "POST",
          body: JSON.stringify({ buildingId, roomCode, ...payload }),
        });
      }

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (selectedRoomId ? "Da cap nhat phong." : "Da tao phong."),
        );
        setRoomError("");
        await loadRooms();
        if (res.data?.data?.id) {
          await selectRoom(res.data.data.id);
        }
      } else {
        setRoomError(res?.data?.message || "Không thể lưu phòng.");
      }
    });

  document
    .getElementById("delete-room-btn")
    ?.addEventListener("click", async () => {
      if (!selectedRoomId) {
        setRoomError("Vui lòng chọn một phòng trước khi xóa.");
        return;
      }
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xoa phong",
              message: "Ban co chac muon xoa phong nay khong?",
              confirmText: "Xoa phong",
              cancelText: "Huy",
            })
          : confirm("Ban co chac muon xoa phong nay khong?");
      if (!confirmed) return;

      const res = await callApi(`/room/${selectedRoomId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Da xoa phong.");
        selectedRoomId = null;
        clearRoomDetail();
        loadRooms();
      } else {
        setRoomError(res?.data?.message || "Không thể xóa phòng.");
      }
    });

  document.getElementById("new-facility-btn")?.addEventListener("click", () => {
    selectedFacilityId = null;
    clearFacilityForm();
    renderRoomFacilities();
  });

  document
    .getElementById("facility-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedRoomId) {
        setFacilityError("Vui lòng chọn phòng trước khi lưu thiết bị.");
        return;
      }

      const name = document.getElementById("facility-name").value.trim();
      const quantity = Number(
        document.getElementById("facility-quantity").value,
      );
      const status = document.getElementById("facility-status").value;

      if (!name || !(quantity > 0)) {
        setFacilityError("Vui lòng nhập tên thiết bị và số lượng hợp lệ.");
        return;
      }

      let res;
      if (selectedFacilityId) {
        res = await callApi(`/facilities/${selectedFacilityId}`, {
          method: "PUT",
          body: JSON.stringify({ name, quantity, status }),
        });
      } else {
        res = await callApi("/facilities", {
          method: "POST",
          body: JSON.stringify({
            roomId: selectedRoomId,
            name,
            quantity,
            status,
          }),
        });
      }

      if (res?.ok) {
        adminToast(res.data?.message || "Đã lưu thiết bị.");
        setFacilityError("");
        await loadRoomFacilities(selectedRoomId);
      } else {
        setFacilityError(res?.data?.message || "Không thể lưu thiết bị.");
      }
    });

  document
    .getElementById("delete-facility-btn")
    ?.addEventListener("click", async () => {
      if (!selectedFacilityId) {
        setFacilityError("Vui lòng chọn thiết bị trước khi xóa.");
        return;
      }
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xóa thiết bị",
              message: "Bạn có chắc muốn xóa thiết bị này không?",
              confirmText: "Xóa thiết bị",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn xóa thiết bị này không?");
      if (!confirmed) return;

      const res = await callApi(`/facilities/${selectedFacilityId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã xóa thiết bị.");
        selectedFacilityId = null;
        await loadRoomFacilities(selectedRoomId);
      } else {
        setFacilityError(res?.data?.message || "Không thể xóa thiết bị.");
      }
    });
}

function populateRoomBuildings() {
  const select = document.getElementById("room-building-id");
  if (!select) return;
  select.innerHTML = roomBuildings.length
    ? roomBuildings
        .map(
          (building) =>
            `<option value="${building.id}">${escapeHtml(building.label)}</option>`,
        )
        .join("")
    : '<option value="">Không có tòa nhà</option>';
}

async function loadRooms() {
  const tbody = document.getElementById("rooms-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="8" class="table-empty">Đang tải danh sách phòng...</td></tr>';

  const filters = getRoomFilters();
  const state = paginationState.rooms;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.status) query.set("status", filters.status);

  const res = await callApi(`/room?${query.toString()}`);
  adminRooms = applyServerPagination("rooms", res?.data);
  renderRoomsTable();

  if (!roomBuildings.length) {
    const allRoomsRes = await callApi("/room");
    const allRooms = Array.isArray(allRoomsRes?.data) ? allRoomsRes.data : [];
    roomBuildings = Array.from(
      new Map(
        allRooms.map((room) => [
          room.buildingId,
          {
            id: room.buildingId,
            label: `${room.buildingName} (${room.buildingCode})`,
          },
        ]),
      ).values(),
    );
    populateRoomBuildings();
  }

  if (selectedRoomId) {
    const exists = adminRooms.some((room) => room.id === selectedRoomId);
    if (exists) {
      await selectRoom(selectedRoomId);
    } else {
      selectedRoomId = null;
      clearRoomDetail();
    }
  } else {
    clearRoomDetail();
  }
}

function renderRoomsTable() {
  const tbody = document.getElementById("rooms-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "rooms",
    paginationState.rooms.totalItems || adminRooms.length,
  );

  if (!adminRooms.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="table-empty">Không có phòng phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminRooms
    .map(
      (room) => `
        <tr class="${selectedRoomId === room.id ? "is-selected" : ""}">
            <td><strong>${escapeHtml(room.roomCode)}</strong></td>
            <td>${escapeHtml(room.buildingName)} (${escapeHtml(room.buildingCode)})</td>
            <td>${escapeHtml(room.roomType)}</td>
            <td>${escapeHtml(room.genderAllowed || "-")}</td>
            <td>${escapeHtml(room.currentOccupancy)}/${escapeHtml(room.capacity)} (${escapeHtml(room.availableSlots)} cho trong)</td>
            <td>${escapeHtml(formatCurrency(room.price))}</td>
            <td>${adminBadge(room.status)}</td>
            <td><button type="button" class="secondary-btn" data-room-view="${room.id}">Chon</button></td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-room-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectRoom(Number(button.dataset.roomView)),
    );
  });
}

async function selectRoom(roomId) {
  const room = adminRooms.find((item) => item.id === roomId);
  if (!room) return;
  selectedRoomId = roomId;
  document.getElementById("room-detail-code").textContent =
    room.roomCode || "Da chon";
  document.getElementById("room-detail-building").textContent =
    `${room.buildingName} (${room.buildingCode})`;
  document.getElementById("room-detail-gender").textContent =
    room.genderAllowed || "-";
  document.getElementById("room-building-id").value = String(
    room.buildingId || "",
  );
  document.getElementById("room-code").value = room.roomCode || "";
  document.getElementById("room-type").value = room.roomType || "";
  document.getElementById("room-capacity").value = room.capacity ?? "";
  document.getElementById("room-occupancy").value = room.currentOccupancy ?? "";
  document.getElementById("room-price").value = room.price ?? "";
  document.getElementById("room-status").value = room.status || "Available";
  setRoomError("");
  renderRoomsTable();
  await loadRoomFacilities(roomId);
}

function clearRoomDetail() {
  document.getElementById("room-detail-code").textContent = "Chua chon";
  document.getElementById("room-detail-building").textContent = "-";
  document.getElementById("room-detail-gender").textContent = "-";
  if (roomBuildings.length)
    document.getElementById("room-building-id").value = String(
      roomBuildings[0].id,
    );
  document.getElementById("room-code").value = "";
  document.getElementById("room-type").value = "";
  document.getElementById("room-capacity").value = "";
  document.getElementById("room-occupancy").value = "";
  document.getElementById("room-price").value = "";
  document.getElementById("room-status").value = "Available";
  setRoomError("");
  document.getElementById("facility-room-code").textContent = "Chua chon phong";
  document.getElementById("room-facilities-list").innerHTML =
    '<div class="empty-state">Chon mot phong de xem thiet bi.</div>';
  clearFacilityForm();
}

async function loadRoomFacilities(roomId) {
  const container = document.getElementById("room-facilities-list");
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Đang tải thiết bị...</div>';
  const res = await callApi(`/facilities/room/${roomId}`);
  selectedRoomFacilities = Array.isArray(res?.data) ? res.data : [];
  selectedFacilityId = null;
  const room = adminRooms.find((item) => item.id === roomId);
  document.getElementById("facility-room-code").textContent =
    room?.roomCode || "Da chon phong";
  clearFacilityForm();
  renderRoomFacilities();
}

function renderRoomFacilities() {
  const container = document.getElementById("room-facilities-list");
  if (!container) return;
  if (!selectedRoomId) {
    container.innerHTML =
      '<div class="empty-state">Chon mot phong de xem thiet bi.</div>';
    return;
  }
  if (!selectedRoomFacilities.length) {
    container.innerHTML =
      '<div class="empty-state">Phong nay chua co thiet bi nao.</div>';
    return;
  }
  container.innerHTML = selectedRoomFacilities
    .map(
      (item) => `
        <article class="queue-item ${selectedFacilityId === item.id ? "selected-facility" : ""}">
            <div class="queue-head">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="pill neutral">SL: ${escapeHtml(item.quantity)}</span>
            </div>
            <div class="queue-meta">
                <span>Trang thai: ${escapeHtml(item.status)}</span>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="secondary-btn" data-facility-view="${item.id}">Chon</button>
            </div>
        </article>
    `,
    )
    .join("");

  container.querySelectorAll("[data-facility-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const facility = selectedRoomFacilities.find(
        (item) => item.id === Number(button.dataset.facilityView),
      );
      if (!facility) return;
      selectedFacilityId = facility.id;
      document.getElementById("facility-name").value = facility.name || "";
      document.getElementById("facility-quantity").value =
        facility.quantity ?? 1;
      document.getElementById("facility-status").value =
        facility.status || "Good";
      setFacilityError("");
      renderRoomFacilities();
    });
  });
}

function clearFacilityForm() {
  document.getElementById("facility-name").value = "";
  document.getElementById("facility-quantity").value = 1;
  document.getElementById("facility-status").value = "Good";
  setFacilityError("");
}

function getStudentFilters() {
  return {
    keyword:
      document.getElementById("student-search")?.value.trim().toLowerCase() ||
      "",
    active: document.getElementById("student-filter-active")?.value || "",
  };
}

function setStudentError(message = "") {
  const el = document.getElementById("student-form-error");
  if (el) el.textContent = message;
}

//8. Sinh viên
function bindStudentControls() {
  const rerenderStudents = () => {
    resetPage("students");
    loadStudents();
  };
  document
    .getElementById("student-search")
    ?.addEventListener("input", rerenderStudents);
  document
    .getElementById("student-filter-active")
    ?.addEventListener("change", rerenderStudents);

  document
    .getElementById("student-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedStudentId) {
        setStudentError("Vui lòng chọn một sinh viên trước khi cập nhật.");
        return;
      }
      const phone = document.getElementById("student-phone").value.trim();
      const permanentAddress = document
        .getElementById("student-address")
        .value.trim();
      const isActive =
        document.getElementById("student-is-active").value === "true";
      if (!phone || !permanentAddress) {
        setStudentError("Vui lòng nhập đầy đủ số điện thoại và địa chỉ.");
        return;
      }
      const res = await callApi(`/students/${selectedStudentId}`, {
        method: "PUT",
        body: JSON.stringify({ phone, permanentAddress, isActive }),
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Da cap nhat sinh vien.");
        setStudentError("");
        await loadStudents();
        await selectStudent(selectedStudentId);
      } else {
        setStudentError(res?.data?.message || "Không thể cập nhật sinh viên.");
      }
    });

  document
    .getElementById("delete-student-btn")
    ?.addEventListener("click", async () => {
      if (!selectedStudentId) {
        setStudentError("Vui lòng chọn một sinh viên trước khi xóa.");
        return;
      }
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xoa sinh vien",
              message: "Ban co chac muon xoa sinh vien nay khong?",
              confirmText: "Xoa sinh vien",
              cancelText: "Huy",
            })
          : confirm("Ban co chac muon xoa sinh vien nay khong?");
      if (!confirmed) return;

      const res = await callApi(`/students/${selectedStudentId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Da xoa sinh vien.");
        selectedStudentId = null;
        clearStudentDetail();
        loadStudents();
      } else {
        setStudentError(res?.data?.message || "Không thể xóa sinh viên.");
      }
    });
}

async function loadStudents() {
  const tbody = document.getElementById("students-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="table-empty">Đang tải danh sách sinh viên...</td></tr>';

  const filters = getStudentFilters();
  const state = paginationState.students;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.active !== "") query.set("isActive", filters.active);

  const res = await callApi(`/students?${query.toString()}`);
  adminStudents = applyServerPagination("students", res?.data);
  renderStudentsTable();

  if (selectedStudentId) {
    const exists = adminStudents.some(
      (student) => student.id === selectedStudentId,
    );
    if (exists) {
      await selectStudent(selectedStudentId);
    } else {
      selectedStudentId = null;
      clearStudentDetail();
    }
  }
}

function renderStudentsTable() {
  const tbody = document.getElementById("students-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "students",
    paginationState.students.totalItems || adminStudents.length,
  );

  if (!adminStudents.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="table-empty">Không có sinh viên phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminStudents
    .map(
      (student) => `
        <tr class="${selectedStudentId === student.id ? "is-selected" : ""}">
            <td><strong>${escapeHtml(student.fullName)}</strong></td>
            <td>${escapeHtml(student.citizenId)}</td>
            <td>${escapeHtml(student.gender)}</td>
            <td>${escapeHtml(student.roomCode || "-")}</td>
            <td>${escapeHtml(student.phone || "-")}</td>
            <td>${student.isActive ? '<span class="pill">Hoat dong</span>' : '<span class="pill neutral">Ngung hoat dong</span>'}</td>
            <td><button type="button" class="secondary-btn" data-student-view="${student.id}">Chon</button></td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-student-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectStudent(Number(button.dataset.studentView)),
    );
  });
}

async function selectStudent(studentId) {
  const res = await callApi(`/students/${studentId}`);
  const student = res?.ok ? res.data?.data : null;
  if (!student) {
    adminToast(res?.data?.message || "Không thể lấy chi tiết sinh viên.", true);
    return;
  }
  selectedStudentId = student.id;
  document.getElementById("student-detail-name").textContent =
    student.fullName || "Da chon";
  document.getElementById("student-detail-email").textContent =
    student.email || "-";
  document.getElementById("student-detail-created").textContent = formatDate(
    student.createdAt,
  );
  document.getElementById("student-phone").value = student.phone || "";
  document.getElementById("student-address").value =
    student.permanentAddress || "";
  document.getElementById("student-is-active").value = String(
    Boolean(student.isActive),
  );
  setStudentError("");
  renderStudentsTable();
}

function clearStudentDetail() {
  document.getElementById("student-detail-name").textContent = "Chua chon";
  document.getElementById("student-detail-email").textContent = "-";
  document.getElementById("student-detail-created").textContent = "-";
  document.getElementById("student-phone").value = "";
  document.getElementById("student-address").value = "";
  document.getElementById("student-is-active").value = "true";
  setStudentError("");
}

function bindRevenueControls() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  if (!document.getElementById("revenue-start-date").value) {
    document.getElementById("revenue-start-date").value = firstDay
      .toISOString()
      .slice(0, 10);
  }
  if (!document.getElementById("revenue-end-date").value) {
    document.getElementById("revenue-end-date").value = today
      .toISOString()
      .slice(0, 10);
  }
  document.getElementById("load-revenue-btn")?.addEventListener("click", () => {
    resetPage("revenue");
    loadRevenue();
  });
  document
    .getElementById("export-revenue-btn")
    ?.addEventListener("click", exportRevenue);
}

function getRevenuePayload() {
  const startDate = document.getElementById("revenue-start-date").value;
  const endDate = document.getElementById("revenue-end-date").value;
  const period = document.getElementById("revenue-period").value.trim();
  const roomCode = document.getElementById("revenue-room-code").value.trim();
  return {
    startDate: startDate ? new Date(startDate).toISOString() : null,
    endDate: endDate ? new Date(endDate).toISOString() : null,
    period: period || null,
    roomCode: roomCode || null,
  };
}

function setRevenueError(message = "") {
  const el = document.getElementById("revenue-form-error");
  if (el) el.textContent = message;
}

async function loadRevenue() {
  const tbody = document.getElementById("revenue-table-body");
  const payload = getRevenuePayload();
  if (!payload.startDate || !payload.endDate) {
    setRevenueError("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
    return;
  }
  tbody.innerHTML =
    '<tr><td colspan="9" class="table-empty">Đang tải báo cáo doanh thu...</td></tr>';
  const res = await callApi("/revenue/stats", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      page: paginationState.revenue.page,
      pageSize: paginationState.revenue.size,
    }),
  });
  if (!res?.ok || !res.data?.data) {
    setRevenueError(res?.data?.message || "Không thể tải báo cáo doanh thu.");
    tbody.innerHTML =
      '<tr><td colspan="9" class="table-empty">Không có dữ liệu doanh thu.</td></tr>';
    resetRevenueStats();
    adminRevenueDetails = [];
    updatePaginationUi("revenue", 0);
    return;
  }
  setRevenueError("");
  const data = res.data.data;
  document.getElementById("revenue-room-fee").textContent = formatCurrency(
    data.totalRoomFee,
  );
  document.getElementById("revenue-electric-fee").textContent = formatCurrency(
    data.totalElectricFee,
  );
  document.getElementById("revenue-water-fee").textContent = formatCurrency(
    data.totalWaterFee,
  );
  document.getElementById("revenue-grand-total").textContent = formatCurrency(
    data.grandTotal,
  );
  document.getElementById("revenue-total-invoices").textContent =
    data.totalInvoices ?? 0;
  document.getElementById("revenue-paid-invoices").textContent =
    data.paidInvoices ?? 0;
  document.getElementById("revenue-unpaid-invoices").textContent =
    data.unpaidInvoices ?? 0;
  adminRevenueDetails = applyServerPagination("revenue", data.details);
  renderRevenueTable();
}

function renderRevenueTable() {
  const tbody = document.getElementById("revenue-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "revenue",
    paginationState.revenue.totalItems || adminRevenueDetails.length,
  );

  if (!adminRevenueDetails.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="table-empty">Không có chi tiết doanh thu.</td></tr>';
    return;
  }

  tbody.innerHTML = adminRevenueDetails
    .map(
      (item) => `
        <tr>
            <td>${escapeHtml(item.period || "-")}</td>
            <td>${escapeHtml(item.roomCode || "-")}</td>
            <td>${escapeHtml(item.studentName || "-")}</td>
            <td>${escapeHtml(formatCurrency(item.roomFee))}</td>
            <td>${escapeHtml(formatCurrency(item.electricFee))}</td>
            <td>${escapeHtml(formatCurrency(item.waterFee))}</td>
            <td><strong>${escapeHtml(formatCurrency(item.totalAmount))}</strong></td>
            <td>${adminBadge(item.status)}</td>
            <td>${formatDate(item.issuedAt)}</td>
        </tr>
    `,
    )
    .join("");
}

function resetRevenueStats() {
  document.getElementById("revenue-room-fee").textContent = formatCurrency(0);
  document.getElementById("revenue-electric-fee").textContent =
    formatCurrency(0);
  document.getElementById("revenue-water-fee").textContent = formatCurrency(0);
  document.getElementById("revenue-grand-total").textContent =
    formatCurrency(0);
  document.getElementById("revenue-total-invoices").textContent = 0;
  document.getElementById("revenue-paid-invoices").textContent = 0;
  document.getElementById("revenue-unpaid-invoices").textContent = 0;
}

async function exportRevenue() {
  const payload = getRevenuePayload();
  if (!payload.startDate || !payload.endDate) {
    setRevenueError("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
    return;
  }
  const res = await callApiBlob("/revenue/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res?.ok || !res.blob) {
    setRevenueError("Không thể xuất file doanh thu.");
    return;
  }
  const url = URL.createObjectURL(res.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "BaoCaoDoanhThu.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setRevenueError("");
  adminToast("Da xuat file bao cao doanh thu.");
}
//7. Hoa don
async function loadInvoices() {
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="11" class="table-empty">Đang tải danh sách hóa đơn...</td></tr>';
  setInvoiceActionError("");

  const filters = getInvoiceFilters();
  const state = paginationState.invoices;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  if (filters.period) query.set("period", filters.period);
  if (filters.status) query.set("status", filters.status);

  const res = await callApi(`/invoices?${query.toString()}`);
  adminInvoices = applyServerPagination("invoices", res?.data);
  renderInvoicesTable();
}

function renderInvoicesTable() {
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "invoices",
    paginationState.invoices.totalItems || adminInvoices.length,
  );

  if (!adminInvoices.length) {
    tbody.innerHTML =
      '<tr><td colspan="11" class="table-empty">Không có hóa đơn phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminInvoices
    .map(
      (invoice) => `
        <tr>
            <td>${escapeHtml(invoice.id)}</td>
            <td>${escapeHtml(invoice.period || "-")}</td>
            <td>${escapeHtml(invoice.roomCode || "-")}</td>
            <td>${escapeHtml(invoice.studentName || "-")}</td>
            <td>${escapeHtml(formatCurrency(invoice.roomFee))}</td>
            <td>${escapeHtml(formatCurrency(invoice.electricFee))}</td>
            <td>${escapeHtml(formatCurrency(invoice.waterFee))}</td>
            <td><strong>${escapeHtml(formatCurrency(invoice.totalAmount))}</strong></td>
            <td>${adminBadge(invoice.status)}</td>
            <td>${formatDate(invoice.issuedAt)}</td>
            <td>
                <div class="invoice-status-actions">
                    <button type="button" class="secondary-btn" data-invoice-view="${invoice.id}">Chi tiết</button>
                    ${
                      invoice.status === "Unpaid"
                        ? `<button type="button" class="primary-btn" data-invoice-pay="${invoice.id}">Đánh dấu đã thu</button>`
                        : ""
                    }
                </div>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-invoice-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      const resDetail = await callApi(
        `/invoices/${button.dataset.invoiceView}`,
      );
      const invoice = resDetail?.data;
      if (!resDetail?.ok || !invoice) {
        adminToast(
          resDetail?.data?.message || "Không thể lấy chi tiết hóa đơn.",
          true,
        );
        return;
      }

      const details = [
        `Hóa đơn #${invoice.id}`,
        `Kỳ: ${invoice.period || "-"}`,
        `Phòng: ${invoice.roomCode || "-"}`,
        `Sinh viên: ${invoice.studentName || "-"}`,
        `Tiền phòng: ${formatCurrency(invoice.roomFee)}`,
        `Tiền điện: ${formatCurrency(invoice.electricFee)}`,
        `Tiền nước: ${formatCurrency(invoice.waterFee)}`,
        `Tổng tiền: ${formatCurrency(invoice.totalAmount)}`,
        `Trạng thái: ${invoice.status || "-"}`,
        `Ngày phát hành: ${formatDate(invoice.issuedAt)}`,
      ].join("\n");

      window.alert(details);
    });
  });

  tbody.querySelectorAll("[data-invoice-pay]").forEach((button) => {
    button.addEventListener("click", () =>
      withAction(button, async () => {
        const resPay = await callApi(
          `/invoices/${button.dataset.invoicePay}/pay`,
          { method: "PUT" },
        );
        if (resPay?.ok) {
          adminToast(resPay.data?.message || "Đã cập nhật hóa đơn đã thanh toán.");
          loadInvoices();
        } else {
          adminToast(
            resPay?.data?.message || "Không thể cập nhật hóa đơn.",
            true,
          );
        }
      }),
    );
  });
}

function bindNotificationForm() {
  const targetTypeEl = document.getElementById("notif-target-type");
  const userIdEl = document.getElementById("notif-user-id");
  const updateNotificationTargetUi = () => {
    if (!targetTypeEl || !userIdEl) return;
    const isSingleTarget = targetTypeEl.value === "single";
    userIdEl.disabled = !isSingleTarget;
    if (!isSingleTarget) userIdEl.value = "";
  };

  targetTypeEl?.addEventListener("change", updateNotificationTargetUi);
  updateNotificationTargetUi();

  document
    .getElementById("notification-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById("notif-form-error");
      errorEl.textContent = "";

      const targetType =
        document.getElementById("notif-target-type")?.value || "single";
      const sendToAllStudents = targetType === "all-students";
      const userId = Number(document.getElementById("notif-user-id").value);
      const title = document.getElementById("notif-title").value.trim();
      const message = document.getElementById("notif-message").value.trim();

      if (!sendToAllStudents && !userId) {
        errorEl.textContent = "Vui lòng nhập User ID hợp lệ.";
        return;
      }
      if (!title || !message) {
        errorEl.textContent = "Vui lòng nhập đủ tiêu đề và nội dung.";
        return;
      }

      const res = await callApi("/notifications", {
        method: "POST",
        body: JSON.stringify({
          userId: sendToAllStudents ? null : userId,
          sendToAllStudents,
          title,
          message,
        }),
      });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (sendToAllStudents
              ? "Đã gửi thông báo cho tất cả sinh viên."
              : "Đã gửi thông báo."),
        );
        event.target.reset();
        updateNotificationTargetUi();
        loadNotifications();
      } else {
        errorEl.textContent = res?.data?.message || "Không thể gửi thông báo.";
      }
    });
}

async function loadNotifications() {
  setStackLoading("notifications-list", "Đang tải thông báo...");
  const state = paginationState.notifications;
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.size),
  });
  const res = await callApi(`/notifications/my?${query.toString()}`);
  adminNotifications = applyServerPagination("notifications", res?.data);
  renderNotificationsList();
}

function renderNotificationsList() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  updatePaginationUi(
    "notifications",
    paginationState.notifications.totalItems || adminNotifications.length,
  );

  if (!adminNotifications.length) {
    container.innerHTML =
      '<div class="empty-state">Chua co thong bao nao.</div>';
    return;
  }

  container.innerHTML = adminNotifications
    .map(
      (item) => `
        <article class="queue-item">
            <div class="queue-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="pill neutral">Cần admin xử lý</span>
            </div>
            <div class="queue-meta">
                <span>${formatDate(item.createdAt)}</span>
                <span>${item.isRead ? "Đã đọc" : "Chưa đọc"}</span>
            </div>
            <p class="queue-body">${escapeHtml(item.message)}</p>
        </article>
    `,
    )
    .join("");
}
