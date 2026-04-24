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
    .getElementById("reload-facilities-btn")
    ?.addEventListener("click", () => {
      loadFacilityRooms();
      loadFacilitiesInventory();
    });

  document.getElementById("new-facility-btn")?.addEventListener("click", () => {
    selectedFacilityId = null;
    clearFacilityForm();
    renderFacilitiesInventory();
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
    '<tr><td colspan="6" class="table-empty">Đang tải danh sách thiết bị...</td></tr>';

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
      '<tr><td colspan="6" class="table-empty">Không có thiết bị phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminFacilities
    .map(
      (item) => `
        <tr class="${selectedFacilityId === item.id ? "is-selected" : ""}">
            <td>${escapeHtml(item.roomCode || "-")}</td>
            <td>${escapeHtml(item.name || "-")}</td>
            <td>${escapeHtml(item.quantity ?? "-")}</td>
            <td>${adminBadge(item.status)}</td>
            <td>${formatDate(item.createdAt)}</td>
            <td>
                <button type="button" class="secondary-btn" data-facility-view="${item.id}">Chọn</button>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-facility-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectFacility(Number(button.dataset.facilityView)),
    );
  });
}

function selectFacility(facilityId) {
  const facility = adminFacilities.find((item) => item.id === facilityId);
  if (!facility) return;
  selectedFacilityId = facility.id;
  document.getElementById("facility-detail-name").textContent =
    facility.name || "Đã chọn";
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
  document.getElementById("facility-detail-name").textContent = "Chưa chọn";
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
}
