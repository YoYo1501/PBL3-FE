
function getRoomFilters() {
  return {
    keyword:
      document.getElementById("room-search")?.value.trim().toLowerCase() || "",
    status: document.getElementById("room-filter-status")?.value || "",
  };
}

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

function setRoomError(message = "") {
  const el = document.getElementById("room-form-error");
  if (el) el.textContent = message;
}

function setFacilityError(message = "") {
  const el = document.getElementById("facility-form-error");
  if (el) el.textContent = message;
}

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
  document
    .getElementById("reload-facilities-btn")
    ?.addEventListener("click", loadFacilitiesInventory);

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
        setRoomError("Số người hiện tại không được lớn hơn sức chứa.");
        return;
      }

      const payload = { roomType, capacity, currentOccupancy, status, price };
      const res = selectedRoomId
        ? await callApi(`/room/${selectedRoomId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await callApi("/room", {
            method: "POST",
            body: JSON.stringify({ buildingId, roomCode, ...payload }),
          });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (selectedRoomId ? "Đã cập nhật phòng." : "Đã tạo phòng."),
        );
        setRoomError("");
        await loadRooms();
        const savedRoomId = res.data?.data?.id || selectedRoomId;
        if (savedRoomId) await selectRoom(savedRoomId);
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
              title: "Xóa phòng",
              message: "Bạn có chắc muốn xóa phòng này không?",
              confirmText: "Xóa",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn xóa phòng này không?");
      if (!confirmed) return;

      const res = await callApi(`/room/${selectedRoomId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã xóa phòng.");
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
            body: JSON.stringify({ roomId: selectedRoomId, ...payload }),
          });

      if (res?.ok) {
        adminToast(
          res.data?.message ||
            (selectedFacilityId
              ? "Đã cập nhật thiết bị."
              : "Đã thêm thiết bị."),
        );
        setFacilityError("");
        await loadRoomFacilities(selectedRoomId);
        if (res.data?.data?.id) selectedFacilityId = res.data.data.id;
        renderRoomFacilities();
        loadFacilitiesInventory();
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
        await loadRoomFacilities(selectedRoomId);
        loadFacilitiesInventory();
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
            `<option value="${escapeHtml(building.id)}">${escapeHtml(building.label)}</option>`,
        )
        .join("")
    : '<option value="">Chưa có dữ liệu tòa nhà</option>';
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

  if (!roomBuildings.length) {
    const allRoomsRes = await callApi("/room");
    const allRooms = Array.isArray(allRoomsRes?.data) ? allRoomsRes.data : [];
    roomBuildings = Array.from(
      new Map(
        allRooms
          .filter((room) => room.buildingId)
          .map((room) => [
            room.buildingId,
            {
              id: room.buildingId,
              label: `${room.buildingName || "Tòa"} (${room.buildingCode || room.buildingId})`,
            },
          ]),
      ).values(),
    );
    populateRoomBuildings();
  }

  renderRoomsTable();

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
        <tr>
            <td>${escapeHtml(item.roomCode || "-")}</td>
            <td>${escapeHtml(item.name || "-")}</td>
            <td>${escapeHtml(item.quantity ?? "-")}</td>
            <td>${adminBadge(item.status)}</td>
            <td>${formatDate(item.createdAt)}</td>
            <td>
                <button type="button" class="secondary-btn" data-inventory-facility="${item.id}" data-inventory-room="${item.roomId}">Chọn</button>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-inventory-facility]").forEach((button) => {
    button.addEventListener("click", async () => {
      const roomId = Number(button.dataset.inventoryRoom);
      const facilityId = Number(button.dataset.inventoryFacility);
      if (!roomId || !facilityId) return;
      await selectRoom(roomId);
      selectFacility(facilityId);
    });
  });
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
            <td>${escapeHtml(room.buildingName || "-")} (${escapeHtml(room.buildingCode || "-")})</td>
            <td>${escapeHtml(room.roomType || "-")}</td>
            <td>${escapeHtml(room.genderAllowed || "-")}</td>
            <td>${escapeHtml(room.currentOccupancy)}/${escapeHtml(room.capacity)} (${escapeHtml(room.availableSlots)} chỗ trống)</td>
            <td>${escapeHtml(formatCurrency(room.price))}</td>
            <td>${adminBadge(room.status)}</td>
            <td><button type="button" class="secondary-btn" data-room-view="${room.id}">Chọn</button></td>
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
  let room = adminRooms.find((item) => item.id === roomId);
  if (!room) {
    const res = await callApi(`/room/${roomId}`);
    room = res?.ok ? res.data : null;
  }
  if (!room) {
    adminToast("Không thể lấy chi tiết phòng.", true);
    return;
  }

  selectedRoomId = room.id;
  document.getElementById("room-detail-code").textContent =
    room.roomCode || "Đã chọn";
  document.getElementById("room-detail-building").textContent =
    `${room.buildingName || "-"} (${room.buildingCode || "-"})`;
  document.getElementById("room-detail-gender").textContent =
    room.genderAllowed || "-";
  document.getElementById("room-building-id").value = room.buildingId || "";
  document.getElementById("room-code").value = room.roomCode || "";
  document.getElementById("room-type").value = room.roomType || "";
  document.getElementById("room-capacity").value = room.capacity ?? "";
  document.getElementById("room-occupancy").value = room.currentOccupancy ?? 0;
  document.getElementById("room-price").value = room.price ?? "";
  document.getElementById("room-status").value = room.status || "Available";
  document.getElementById("facility-room-code").textContent =
    room.roomCode || "Đã chọn phòng";
  setRoomError("");
  clearFacilityForm();
  renderRoomsTable();
  await loadRoomFacilities(room.id);
}

function clearRoomDetail() {
  document.getElementById("room-detail-code").textContent = "Chưa chọn";
  document.getElementById("room-detail-building").textContent = "-";
  document.getElementById("room-detail-gender").textContent = "-";
  if (roomBuildings.length)
    document.getElementById("room-building-id").value = roomBuildings[0].id;
  document.getElementById("room-code").value = "";
  document.getElementById("room-type").value = "";
  document.getElementById("room-capacity").value = "";
  document.getElementById("room-occupancy").value = "";
  document.getElementById("room-price").value = "";
  document.getElementById("room-status").value = "Available";
  document.getElementById("facility-room-code").textContent = "Chưa chọn phòng";
  setRoomError("");
  selectedRoomFacilities = [];
  selectedFacilityId = null;
  clearFacilityForm();
  renderRoomFacilities();
}

async function loadRoomFacilities(roomId) {
  const container = document.getElementById("room-facilities-list");
  if (container)
    container.innerHTML =
      '<div class="empty-state">Đang tải thiết bị phòng...</div>';
  const res = await callApi(`/facilities/room/${roomId}`);
  selectedRoomFacilities = Array.isArray(res?.data) ? res.data : [];
  selectedFacilityId = null;
  renderRoomFacilities();
}

function renderRoomFacilities() {
  const container = document.getElementById("room-facilities-list");
  if (!container) return;

  if (!selectedRoomId) {
    container.innerHTML =
      '<div class="empty-state">Chọn một phòng để xem thiết bị.</div>';
    return;
  }

  if (!selectedRoomFacilities.length) {
    container.innerHTML =
      '<div class="empty-state">Phòng này chưa có thiết bị nào.</div>';
    return;
  }

  container.innerHTML = selectedRoomFacilities
    .map(
      (item) => `
        <article class="queue-item ${selectedFacilityId === item.id ? "selected-facility" : ""}">
            <div class="queue-head">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="pill neutral">${escapeHtml(item.status)}</span>
            </div>
            <div class="queue-meta">
                <span>Số lượng: ${escapeHtml(item.quantity)}</span>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <div class="queue-actions">
                <button type="button" class="secondary-btn" data-facility-view="${item.id}">Chọn</button>
            </div>
        </article>
    `,
    )
    .join("");

  container.querySelectorAll("[data-facility-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectFacility(Number(button.dataset.facilityView)),
    );
  });
}

function selectFacility(facilityId) {
  const facility = selectedRoomFacilities.find((item) => item.id === facilityId);
  if (!facility) return;
  selectedFacilityId = facility.id;
  document.getElementById("facility-name").value = facility.name || "";
  document.getElementById("facility-quantity").value = facility.quantity ?? 1;
  document.getElementById("facility-status").value = facility.status || "Good";
  setFacilityError("");
  renderRoomFacilities();
}

function clearFacilityForm() {
  document.getElementById("facility-name").value = "";
  document.getElementById("facility-quantity").value = 1;
  document.getElementById("facility-status").value = "Good";
  setFacilityError("");
}
