let roomOverviewFilter = "";

const roomOverviewFilterLabels = {
  available: "Ph\u00f2ng c\u00f2n ch\u1ed7",
  full: "Ph\u00f2ng \u0111\u00e3 \u0111\u1ea7y",
  male: "Ph\u00f2ng nam",
  female: "Ph\u00f2ng n\u1eef",
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

function setRoomCreateError(message = "") {
  const el = document.getElementById("room-create-form-error");
  if (el) el.textContent = message;
}

function setRoomDetailVisible(isVisible) {
  document
    .querySelector(".room-admin-shell")
    ?.classList.toggle("has-selected-room", Boolean(isVisible));
  document.body.classList.toggle("modal-open", Boolean(isVisible));
}

function setRoomCreateVisible(isVisible) {
  document
    .getElementById("room-create-modal")
    ?.classList.toggle("is-open", Boolean(isVisible));
  const detailOpen = document
    .querySelector(".room-admin-shell")
    ?.classList.contains("has-selected-room");
  document.body.classList.toggle("modal-open", Boolean(isVisible || detailOpen));
}

function openNewRoomForm() {
  clearRoomDetail();
  clearCreateRoomForm();
  setRoomCreateVisible(true);
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

  document
    .getElementById("new-room-open-btn")
    ?.addEventListener("click", openNewRoomForm);
  document
    .getElementById("room-detail-close-btn")
    ?.addEventListener("click", clearRoomDetail);
  document
    .getElementById("room-create-close-btn")
    ?.addEventListener("click", closeCreateRoomForm);
  document
    .getElementById("room-create-cancel-btn")
    ?.addEventListener("click", closeCreateRoomForm);
  document.addEventListener("click", (event) => {
    if (
      event.target.closest("#room-create-close-btn") ||
      event.target.closest("#room-create-cancel-btn")
    ) {
      closeCreateRoomForm();
    }
  });

  document
    .getElementById("room-detail-modal")
    ?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) clearRoomDetail();
    });
  document
    .getElementById("room-create-modal")
    ?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCreateRoomForm();
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const createModal = document.getElementById("room-create-modal");
    if (createModal?.classList.contains("is-open")) {
      closeCreateRoomForm();
      return;
    }
    const detailModal = document.getElementById("room-detail-modal");
    if (detailModal && getComputedStyle(detailModal).display !== "none") clearRoomDetail();
  });

  document
    .getElementById("room-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedRoomId) {
        setRoomError("Vui l\u00f2ng ch\u1ecdn m\u1ed9t ph\u00f2ng tr\u01b0\u1edbc khi c\u1eadp nh\u1eadt.");
        return;
      }

      const roomType = document.getElementById("room-type").value.trim();
      const capacity = Number(document.getElementById("room-capacity").value);
      const currentOccupancy = Number(
        document.getElementById("room-occupancy").value,
      );
      const price = Number(document.getElementById("room-price").value);
      const status = document.getElementById("room-status").value;

      if (
        !roomType ||
        !(capacity > 0) ||
        price < 0
      ) {
        setRoomError("Vui l\u00f2ng nh\u1eadp \u0111\u1ea7y \u0111\u1ee7 th\u00f4ng tin ph\u00f2ng h\u1ee3p l\u1ec7.");
        return;
      }
      if (selectedRoomId && capacity < currentOccupancy) {
        setRoomError("S\u1ee9c ch\u1ee9a kh\u00f4ng \u0111\u01b0\u1ee3c nh\u1ecf h\u01a1n s\u1ed1 ng\u01b0\u1eddi \u0111ang l\u01b0u tr\u00fa.");
        return;
      }
      if (selectedRoomId && status === "Locked" && currentOccupancy > 0) {
        setRoomError("Ph\u00f2ng \u0111ang c\u00f3 ng\u01b0\u1eddi l\u01b0u tr\u00fa, kh\u00f4ng \u0111\u01b0\u1ee3c kh\u00f3a.");
        return;
      }

      const payload = { roomType, capacity, status, price };
      const res = await callApi(`/room/${selectedRoomId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        adminToast(
          res.data?.message || "\u0110\u00e3 c\u1eadp nh\u1eadt ph\u00f2ng.",
        );
        setRoomError("");
        await loadRooms();
        await selectRoom(selectedRoomId);
        window.dispatchEvent(new Event("admin:rooms-changed"));
      } else {
        setRoomError(res?.data?.message || "Kh\u00f4ng th\u1ec3 l\u01b0u ph\u00f2ng.");
      }
    });

  document
    .getElementById("room-create-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const buildingId = Number(
        document.getElementById("create-room-building-id").value,
      );
      const roomCode = document.getElementById("create-room-code").value.trim();
      const roomType = document.getElementById("create-room-type").value.trim();
      const capacity = Number(document.getElementById("create-room-capacity").value);
      const price = Number(document.getElementById("create-room-price").value);
      const status = document.getElementById("create-room-status").value;

      if (!buildingId || !roomCode || !roomType || !(capacity > 0) || price < 0) {
        setRoomCreateError("Vui l\u00f2ng nh\u1eadp \u0111\u1ea7y \u0111\u1ee7 th\u00f4ng tin ph\u00f2ng h\u1ee3p l\u1ec7.");
        return;
      }

      const res = await callApi("/room", {
        method: "POST",
        body: JSON.stringify({ buildingId, roomCode, roomType, capacity, status, price }),
      });

      if (res?.ok) {
        adminToast(res.data?.message || "\u0110\u00e3 t\u1ea1o ph\u00f2ng.");
        setRoomCreateError("");
        closeCreateRoomForm();
        await loadRooms();
        const savedRoomId = res.data?.data?.id;
        if (savedRoomId) await selectRoom(savedRoomId);
        window.dispatchEvent(new Event("admin:rooms-changed"));
      } else {
        setRoomCreateError(res?.data?.message || "Kh\u00f4ng th\u1ec3 t\u1ea1o ph\u00f2ng.");
      }
    });

  document
    .getElementById("delete-room-btn")
    ?.addEventListener("click", async () => {
      if (!selectedRoomId) {
        setRoomError("Vui l\u00f2ng ch\u1ecdn m\u1ed9t ph\u00f2ng tr\u01b0\u1edbc khi x\u00f3a.");
        return;
      }
      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "X\u00f3a ph\u00f2ng",
              message: "B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a ph\u00f2ng n\u00e0y kh\u00f4ng?",
              confirmText: "X\u00f3a",
              cancelText: "H\u1ee7y",
            })
          : confirm("B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a ph\u00f2ng n\u00e0y kh\u00f4ng?");
      if (!confirmed) return;

      const res = await callApi(`/room/${selectedRoomId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "\u0110\u00e3 x\u00f3a ph\u00f2ng.");
        selectedRoomId = null;
        clearRoomDetail();
        loadRooms();
        window.dispatchEvent(new Event("admin:rooms-changed"));
      } else {
        setRoomError(res?.data?.message || "Kh\u00f4ng th\u1ec3 x\u00f3a ph\u00f2ng.");
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
      ? `\u0110ang l\u1ecdc: ${roomOverviewFilterLabels[roomOverviewFilter]}`
      : "\u0110ang l\u1ecdc ph\u00f2ng";
  }
}

function populateRoomBuildings() {
  const options = roomBuildings.length
    ? roomBuildings
        .map(
          (building) =>
            `<option value="${escapeHtml(building.id)}">${escapeHtml(building.label)}</option>`,
        )
        .join("")
    : '<option value="">Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u t\u00f2a nh\u00e0</option>';

  const detailSelect = document.getElementById("room-building-id");
  if (detailSelect) detailSelect.innerHTML = options;

  const createSelect = document.getElementById("create-room-building-id");
  if (createSelect) createSelect.innerHTML = options;
}

async function loadRooms() {
  const tbody = document.getElementById("rooms-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="table-empty">\u0110ang t\u1ea3i danh s\u00e1ch ph\u00f2ng...</td></tr>';

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
                label: `${room.buildingName || "T\u00f2a"} (${room.buildingCode || room.buildingId})`,
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
              label: `${room.buildingName || "T\u00f2a"} (${room.buildingCode || room.buildingId})`,
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
      return room.genderAllowed === "Nu" || room.genderAllowed === "N\u1eef" || room.genderAllowed === "Nữ";
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
      '<tr><td colspan="7" class="table-empty">Kh\u00f4ng c\u00f3 ph\u00f2ng ph\u00f9 h\u1ee3p b\u1ed9 l\u1ecdc hi\u1ec7n t\u1ea1i.</td></tr>';
    return;
  }

  tbody.innerHTML = adminRooms
    .map(
      (room) => `
        <tr class="${selectedRoomId === room.id ? "is-selected" : ""}" data-room-view="${room.id}">
            <td class="room-code-cell"><span class="room-code-pill">${escapeHtml(room.roomCode || "-")}</span></td>
            <td><span class="room-row-icon orange">${roomBuildingIconSvg()}</span>${escapeHtml(room.buildingName || room.buildingCode || "-")}</td>
            <td><span class="room-row-icon green">${roomTypeIconSvg()}</span>${escapeHtml(room.roomType || "-")}</td>
            <td><span class="room-row-icon purple">${roomGenderIconSvg(room.genderAllowed)}</span>${escapeHtml(normalizeRoomGender(room.genderAllowed))}</td>
            <td class="room-capacity-cell"><span class="room-row-icon cyan">${roomCapacityIconSvg()}</span>${escapeHtml(room.currentOccupancy ?? 0)}/${escapeHtml(room.capacity ?? 0)} (${escapeHtml(room.availableSlots ?? Math.max((room.capacity ?? 0) - (room.currentOccupancy ?? 0), 0))} ch\u1ed7 tr\u1ed1ng)</td>
            <td class="room-price-cell"><span class="room-row-icon amber">${roomPriceIconSvg()}</span>${escapeHtml(formatCurrency(room.price))}</td>
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
    adminToast("Kh\u00f4ng th\u1ec3 l\u1ea5y chi ti\u1ebft ph\u00f2ng.", true);
    return;
  }

  selectedRoomId = room.id;
  setRoomDetailVisible(true);
  document.getElementById("room-detail-code").textContent =
    room.roomCode || "\u0110\u00e3 ch\u1ecdn";
  document.getElementById("room-detail-building").textContent =
    `${room.buildingName || "-"} (${room.buildingCode || "-"})`;
  document.getElementById("room-detail-gender").textContent =
    room.genderAllowed || "-";
  document.getElementById("room-building-id").value = room.buildingId || "";
  document.getElementById("room-building-id").disabled = true;
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
  selectedRoomId = null;
  setRoomDetailVisible(false);
  document.getElementById("room-detail-code").textContent = "Ch\u01b0a ch\u1ecdn";
  document.getElementById("room-detail-building").textContent = "-";
  document.getElementById("room-detail-gender").textContent = "-";
  if (roomBuildings.length)
    document.getElementById("room-building-id").value = roomBuildings[0].id;
  document.getElementById("room-building-id").disabled = false;
  document.getElementById("room-code").value = "";
  document.getElementById("room-type").value = "";
  document.getElementById("room-capacity").value = "";
  document.getElementById("room-occupancy").value = "";
  document.getElementById("room-price").value = "";
  document.getElementById("room-status").value = "Available";
  setRoomError("");
  renderRoomsTable();
}

function clearCreateRoomForm() {
  if (roomBuildings.length) {
    const buildingSelect = document.getElementById("create-room-building-id");
    if (buildingSelect) buildingSelect.value = roomBuildings[0].id;
  }
  document.getElementById("create-room-code").value = "";
  document.getElementById("create-room-type").value = "";
  document.getElementById("create-room-capacity").value = "";
  document.getElementById("create-room-price").value = "";
  document.getElementById("create-room-status").value = "Available";
  setRoomCreateError("");
}

function closeCreateRoomForm() {
  setRoomCreateVisible(false);
  clearCreateRoomForm();
}

function normalizeRoomGender(gender = "") {
  const value = String(gender).trim().toLowerCase();
  if (value === "nu" || value === "n\u1eef" || value === "nữ" || value === "female") return "N\u1eef";
  if (value === "nam" || value === "male") return "Nam";
  return gender || "-";
}

function roomIconSvg(content) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

function roomBuildingIconSvg() {
  return roomIconSvg('<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"></path><path d="M9 7h1M14 7h1M9 12h1M14 12h1M9 17h1M14 17h1"></path>');
}

function roomTypeIconSvg() {
  return roomIconSvg('<path d="M16 21v-2a4 4 0 0 0-8 0v2"></path><circle cx="12" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 3-3.87"></path>');
}

function roomGenderIconSvg(gender = "") {
  return normalizeRoomGender(gender) === "N\u1eef"
    ? roomIconSvg('<circle cx="12" cy="8" r="5"></circle><path d="M12 13v8M8 17h8"></path>')
    : roomIconSvg('<circle cx="10" cy="14" r="5"></circle><path d="M14 10 21 3"></path><path d="M16 3h5v5"></path>');
}

function roomCapacityIconSvg() {
  return roomIconSvg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>');
}

function roomPriceIconSvg() {
  return roomIconSvg('<circle cx="12" cy="12" r="10"></circle><path d="M12 6v12M16 9a4 4 0 0 0-4-2 4 4 0 0 0 0 8 4 4 0 0 1 0 0"></path>');
}

function getRoomStatusLabel(status = "") {
  const labels = {
    Available: "C\u00f2n tr\u1ed1ng",
    Full: "\u0110\u00e3 \u0111\u1ea7y",
    Locked: "\u0110\u00e3 kh\u00f3a",
  };
  return labels[status] || status || "-";
}

function roomStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  const className =
    normalized === "locked" ? "locked" : normalized === "full" ? "full" : "available";
  return `<span class="room-status-pill ${className}">${escapeHtml(getRoomStatusLabel(status))}</span>`;
}

