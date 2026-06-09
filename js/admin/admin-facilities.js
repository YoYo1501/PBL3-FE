function getFacilityInventoryFilters() {
  return {
    keyword:
      document
        .getElementById("facility-inventory-search")
        ?.value.trim()
        .toLowerCase() || "",
    status: document.getElementById("facility-inventory-status")?.value || "",
  };
}

function setFacilityError(message = "") {
  const el = document.getElementById("facility-form-error");
  if (el) el.textContent = message;
}

function setFacilityDetailVisible(isVisible) {
  document
    .querySelector(".facility-admin-shell")
    ?.classList.toggle("has-selected-facility", Boolean(isVisible));
  document.body.classList.toggle("modal-open", Boolean(isVisible));
}

function openNewFacilityForm() {
  selectedFacilityId = null;
  clearFacilityForm();
  setFacilityDetailVisible(true);
}

function bindFacilityControls() {
  const rerenderFacilities = () => {
    resetPage("facilities");
    loadFacilitiesInventory();
  };

  document
    .getElementById("facility-inventory-search")
    ?.addEventListener("input", rerenderFacilities);
  document
    .getElementById("facility-inventory-status")
    ?.addEventListener("change", rerenderFacilities);
  window.addEventListener("admin:rooms-changed", loadFacilityRooms);

  document
    .getElementById("new-facility-open-btn")
    ?.addEventListener("click", openNewFacilityForm);
  document
    .getElementById("new-facility-btn")
    ?.addEventListener("click", openNewFacilityForm);

  document
    .getElementById("facility-detail-close-btn")
    ?.addEventListener("click", clearFacilityForm);

  document
    .getElementById("facility-detail-modal")
    ?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) clearFacilityForm();
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const modal = document.getElementById("facility-detail-modal");
    if (modal && getComputedStyle(modal).display !== "none") clearFacilityForm();
  });

  document
    .getElementById("facility-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const roomId = Number(document.getElementById("facility-room-id").value);
      const name = document.getElementById("facility-name").value.trim();
      const quantity = Number(
        document.getElementById("facility-quantity").value,
      );
      const status = document.getElementById("facility-status").value;

      if (!roomId) {
        setFacilityError("Vui lòng chọn phòng cho thiết bị.");
        return;
      }
      if (!name || !(quantity > 0)) {
        setFacilityError("Vui lòng nhập tên và số lượng thiết bị hợp lệ.");
        return;
      }

      const payload = { name, quantity, status };
      const res = selectedFacilityId
        ? await callApi(`/facilities/${selectedFacilityId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await callApi("/facilities", {
            method: "POST",
            body: JSON.stringify({ roomId, ...payload }),
          });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (selectedFacilityId
              ? "Đã cập nhật thiết bị."
              : "Đã thêm thiết bị."),
        );
        selectedFacilityId = res.data?.data?.id || selectedFacilityId;
        setFacilityError("");
        await loadFacilitiesInventory();
        if (selectedFacilityId) selectFacility(selectedFacilityId);
      } else {
        setFacilityError(res?.data?.message || "Không thể lưu thiết bị.");
      }
    });

  document
    .getElementById("delete-facility-btn")
    ?.addEventListener("click", async () => {
      if (!selectedFacilityId) {
        setFacilityError("Vui lòng chọn một thiết bị trước khi xóa.");
        return;
      }

      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Xóa thiết bị",
              message: "Bạn có chắc muốn xóa thiết bị này không?",
              confirmText: "Xóa",
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
        clearFacilityForm();
        loadFacilitiesInventory();
      } else {
        setFacilityError(res?.data?.message || "Không thể xóa thiết bị.");
      }
    });
}

async function loadFacilityRooms() {
  const select = document.getElementById("facility-room-id");
  if (!select) return;

  const res = await callApi("/room");
  facilityRooms = Array.isArray(res?.data) ? res.data : [];
  populateFacilityRooms();
}

function populateFacilityRooms() {
  const select = document.getElementById("facility-room-id");
  if (!select) return;
  select.innerHTML = facilityRooms.length
    ? facilityRooms
        .map(
          (room) =>
            `<option value="${escapeHtml(room.id)}">${escapeHtml(room.roomCode || "-")} - ${escapeHtml(room.buildingName || "Tòa")}</option>`,
        )
        .join("")
    : '<option value="">Chưa có dữ liệu phòng</option>';
}

async function loadFacilitiesInventory() {
  const tbody = document.getElementById("facilities-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="5" class="table-empty">Đang tải danh sách thiết bị...</td></tr>';

  const res = await callApi("/facilities");
  const filters = getFacilityInventoryFilters();
  let items = Array.isArray(res?.data) ? res.data : [];

  if (filters.keyword) {
    items = items.filter((item) => {
      const haystack = `${item.name || ""} ${item.roomCode || ""}`.toLowerCase();
      return haystack.includes(filters.keyword);
    });
  }
  if (filters.status) {
    items = items.filter((item) => item.status === filters.status);
  }

  items.sort((a, b) => {
    const roomCompare = String(a.roomCode || "").localeCompare(
      String(b.roomCode || ""),
    );
    if (roomCompare !== 0) return roomCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  const state = paginationState.facilities;
  state.totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / state.size));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.size;
  adminFacilities = items.slice(start, start + state.size);
  renderFacilitiesInventory();
}

function renderFacilitiesInventory() {
  const tbody = document.getElementById("facilities-table-body");
  if (!tbody) return;
  updatePaginationUi(
    "facilities",
    paginationState.facilities.totalItems || adminFacilities.length,
  );

  if (!adminFacilities.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="table-empty">Không có thiết bị phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminFacilities
    .map(
      (item) => `
        <tr class="${selectedFacilityId === item.id ? "is-selected" : ""}" data-facility-view="${item.id}">
            <td class="facility-room-cell"><span class="facility-room-pill">${escapeHtml(item.roomCode || "-")}</span></td>
            <td class="facility-name-cell"><span class="facility-row-icon">${facilityDeviceIconSvg()}</span>${escapeHtml(item.name || "-")}</td>
            <td><span class="facility-row-icon orange">${facilityQuantityIconSvg()}</span>${escapeHtml(item.quantity ?? "-")}</td>
            <td>${facilityStatusBadge(item.status)}</td>
            <td class="facility-date-cell">${facilityDateIconSvg()}${formatDate(item.createdAt)}</td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("tr[data-facility-view]").forEach((row) => {
    row.addEventListener("click", () =>
      selectFacility(Number(row.dataset.facilityView)),
    );
  });
}

function selectFacility(facilityId) {
  const facility = adminFacilities.find((item) => item.id === facilityId);
  if (!facility) return;
  selectedFacilityId = facility.id;
  setFacilityDetailVisible(true);
  document.getElementById("facility-detail-name").textContent =
    facility.name || "Đã chọn";
  document.getElementById("facility-detail-created").textContent = formatDate(
    facility.createdAt,
  );
  const roomSelect = document.getElementById("facility-room-id");
  if (
    facility.roomId &&
    !Array.from(roomSelect.options).some(
      (option) => Number(option.value) === Number(facility.roomId),
    )
  ) {
    roomSelect.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHtml(facility.roomId)}">${escapeHtml(facility.roomCode || "Phòng")}</option>`,
    );
  }
  roomSelect.value = facility.roomId || "";
  roomSelect.disabled = true;
  document.getElementById("facility-name").value = facility.name || "";
  document.getElementById("facility-quantity").value = facility.quantity ?? 1;
  document.getElementById("facility-status").value = facility.status || "Good";
  setFacilityError("");
  renderFacilitiesInventory();
}

function clearFacilityForm() {
  selectedFacilityId = null;
  setFacilityDetailVisible(false);
  document.getElementById("facility-detail-name").textContent = "Chưa chọn";
  document.getElementById("facility-detail-created").textContent = "-";
  document.getElementById("facility-room-id").disabled = false;
  if (facilityRooms.length) {
    document.getElementById("facility-room-id").value = facilityRooms[0].id;
  } else {
    document.getElementById("facility-room-id").value = "";
  }
  document.getElementById("facility-name").value = "";
  document.getElementById("facility-quantity").value = 1;
  document.getElementById("facility-status").value = "Good";
  setFacilityError("");
  renderFacilitiesInventory();
}

function normalizeFacilityStatusLabel(status = "") {
  switch (status) {
    case "Good":
      return "Hoạt động tốt";
    case "Damaged":
      return "Hư hỏng";
    case "UnderMaintenance":
      return "Đang bảo trì";
    default:
      return status || "-";
  }
}

function facilityStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  const className =
    normalized === "damaged"
      ? "damaged"
      : normalized === "undermaintenance"
        ? "maintenance"
        : "good";
  const icon =
    normalized === "damaged"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v5M12 16h.01"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-5"></path></svg>';

  return `<span class="facility-status-pill ${className}">${icon}${escapeHtml(normalizeFacilityStatusLabel(status))}</span>`;
}

function facilityDeviceIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M19.78 4.22l-2.12 2.12M6.34 17.66l-2.12 2.12"></path></svg>';
}

function facilityQuantityIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01"></path></svg>';
}

function facilityDateIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>';
}
