let roomOverviewFilter = "";

const roomOverviewFilterLabels = {
  available: "Phòng còn chỗ",
  full: "Phòng đã đầy",
  male: "Phòng nam",
  female: "Phòng nữ",
};

function getRoomFilters() {
  return {
    keyword:
      document.getElementById("room-search")?.value.trim().toLowerCase() || "",
    status: document.getElementById("room-filter-status")?.value || "",
    overview: roomOverviewFilter,
  };
}

function setRoomError(message = "") {
  const el = document.getElementById("room-form-error");
  if (el) el.textContent = message;
}

function bindRoomControls() {
  const rerenderRooms = () => {
    clearRoomOverviewFilter(false);
    resetPage("rooms");
    loadRooms();
  };
  document
    .getElementById("room-search")
    ?.addEventListener("input", rerenderRooms);
  document
    .getElementById("room-filter-status")
    ?.addEventListener("change", rerenderRooms);
  document
    .getElementById("room-overview-filter-clear")
    ?.addEventListener("click", () => clearRoomOverviewFilter(true));

  document.getElementById("new-room-btn")?.addEventListener("click", () => {
    selectedRoomId = null;
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
        window.dispatchEvent(new Event("admin:rooms-changed"));
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
        window.dispatchEvent(new Event("admin:rooms-changed"));
      } else {
        setRoomError(res?.data?.message || "Không thể xóa phòng.");
      }
    });
}

function applyRoomOverviewFilter(filterKey) {
  if (!roomOverviewFilterLabels[filterKey]) return;

  roomOverviewFilter = filterKey;
  selectedRoomId = null;

  const searchInput = document.getElementById("room-search");
  const statusSelect = document.getElementById("room-filter-status");
  if (searchInput) searchInput.value = "";
  if (statusSelect) statusSelect.value = "";

  resetPage("rooms");
  updateRoomOverviewFilterNote();
  loadRooms();
}

function clearRoomOverviewFilter(shouldReload = true) {
  if (!roomOverviewFilter && !shouldReload) {
    updateRoomOverviewFilterNote();
    return;
  }

  roomOverviewFilter = "";
  updateRoomOverviewFilterNote();

  if (shouldReload) {
    resetPage("rooms");
    loadRooms();
  }
}

function updateRoomOverviewFilterNote() {
  const note = document.getElementById("room-overview-filter-note");
  const label = document.getElementById("room-overview-filter-label");
  if (!note) return;

  note.hidden = !roomOverviewFilter;
  if (label) {
    label.textContent = roomOverviewFilter
      ? `Đang lọc: ${roomOverviewFilterLabels[roomOverviewFilter]}`
      : "Đang lọc phòng";
  }
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
    '<tr><td colspan="7" class="table-empty">Đang tải danh sách phòng...</td></tr>';

  const filters = getRoomFilters();
  const state = paginationState.rooms;
  updateRoomOverviewFilterNote();

  if (filters.overview) {
    const res = await callApi("/room");
    const rooms = Array.isArray(res?.data) ? res.data : [];
    const filteredRooms = applyRoomClientFilters(rooms, filters);
    state.totalItems = filteredRooms.length;
    const totalPages = Math.max(1, Math.ceil(filteredRooms.length / state.size));
    if (state.page > totalPages) state.page = totalPages;
    adminRooms = filteredRooms.slice(
      (state.page - 1) * state.size,
      state.page * state.size,
    );

    if (!roomBuildings.length) {
      roomBuildings = Array.from(
        new Map(
          rooms
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
    clearRoomDetail();
    return;
  }

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

function applyRoomClientFilters(rooms, filters) {
  return rooms.filter((room) => {
    if (filters.status && room.status !== filters.status) return false;
    if (filters.keyword) {
      const searchable = [
        room.roomCode,
        room.roomType,
        room.buildingName,
        room.buildingCode,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(filters.keyword)) return false;
    }

    if (filters.overview === "available") return (room.availableSlots ?? 0) > 0;
    if (filters.overview === "full") return (room.availableSlots ?? 0) <= 0;
    if (filters.overview === "male") return room.genderAllowed === "Nam";
    if (filters.overview === "female") {
      return room.genderAllowed === "Nu" || room.genderAllowed === "Nữ";
    }

    return true;
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
      '<tr><td colspan="7" class="table-empty">Không có phòng phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminRooms
    .map(
      (room) => `
        <tr class="${selectedRoomId === room.id ? "is-selected" : ""}" data-room-view="${room.id}">
            <td class="room-code-cell"><span class="room-code-pill">${escapeHtml(room.roomCode || "-")}</span></td>
            <td>${escapeHtml(room.buildingName || room.buildingCode || "-")}</td>
            <td>${escapeHtml(room.roomType || "-")}</td>
            <td>${escapeHtml(normalizeRoomGender(room.genderAllowed))}</td>
            <td class="room-capacity-cell">${escapeHtml(room.currentOccupancy ?? 0)}/${escapeHtml(room.capacity ?? 0)} (${escapeHtml(room.availableSlots ?? Math.max((room.capacity ?? 0) - (room.currentOccupancy ?? 0), 0))} chỗ trống)</td>
            <td class="room-price-cell">${escapeHtml(formatCurrency(room.price))}</td>
            <td>${roomStatusBadge(room.status)}</td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("tr[data-room-view]").forEach((row) => {
    row.addEventListener("click", () =>
      selectRoom(Number(row.dataset.roomView)),
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
  setRoomError("");
  renderRoomsTable();
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
  setRoomError("");
}

function normalizeRoomGender(gender = "") {
  const value = String(gender).trim().toLowerCase();
  if (value === "nu" || value === "nữ" || value === "female") return "Nữ";
  if (value === "nam" || value === "male") return "Nam";
  return gender || "-";
}

function roomStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  const className =
    normalized === "locked" ? "locked" : normalized === "full" ? "full" : "available";
  return `<span class="room-status-pill ${className}">${escapeHtml(status || "-")}</span>`;
}
