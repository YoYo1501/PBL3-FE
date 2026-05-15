
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
      meta: `${item.registrationCode} - ${item.roomCode || "Chưa có phòng"}`,
      type: "Đăng ký mới",
      target: "section-registrations",
    })),
    ...reqList.slice(0, 3).map((item) => ({
      title: item.title,
      meta: `${item.studentName} - ${item.requestType}`,
      type: "Yêu cầu sinh viên",
      target: "section-requests",
    })),
    ...transferList.slice(0, 3).map((item) => ({
      title: `${item.fromRoomCode} -> ${item.toRoomCode}`,
      meta: item.reason || "Không có lý do",
      type: "Chuyển phòng",
      target: "section-transfers",
    })),
    ...renewalList.slice(0, 3).map((item) => ({
      title: item.contractCode,
      meta: item.packageName,
      type: "Gia hạn",
      target: "section-renewals",
    })),
  ];

  document.getElementById("overview-pending-feed").innerHTML =
    pendingFeed.length
      ? pendingFeed
          .map(
            (item) => {
                let iconSvg = '';
                let iconClass = '';
                if(item.type === 'Đăng ký mới') {
                    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                    iconClass = 'icon-blue';
                } else if(item.type === 'Yêu cầu sinh viên') {
                    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 9.36l-7.1 7.1a1 1 0 0 1-1.41-1.41l7.1-7.1a6 6 0 0 1 9.36-7.94l-3.77 3.77a1 1 0 0 0 0 1.4z"></path></svg>';
                    iconClass = 'icon-purple';
                } else if(item.type === 'Chuyển phòng') {
                    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>';
                    iconClass = 'icon-green';
                } else {
                    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
                    iconClass = 'icon-orange';
                }

                return `
                <div class="queue-item overview-link-item" data-overview-target="${item.target}" role="button" tabindex="0">
                    <div class="queue-item-icon ${iconClass}">${iconSvg}</div>
                    <div class="queue-item-content">
                        <strong>${escapeHtml(item.title)}</strong>
                        <p class="queue-body">${escapeHtml(item.meta)}</p>
                    </div>
                    <div class="queue-item-actions">
                        <span class="badge ${iconClass}">${escapeHtml(item.type)}</span>
                        <svg class="queue-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
                `;
            }
          )
          .join("")
      : '<div class="empty-state">Hiện không có mục nào đang chờ xử lý.</div>';

  const roomSummary = summarizeRooms(roomList);
  document.getElementById("overview-room-feed").innerHTML = roomSummary.length
    ? roomSummary
        .map(
          (item) => {
            let iconSvg = '';
            let iconClass = '';
            if(item.title.includes('còn chỗ')) {
                iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
                iconClass = 'icon-blue';
            } else if(item.title.includes('đầy')) {
                iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
                iconClass = 'icon-orange';
            } else if(item.title.includes('nam')) {
                iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                iconClass = 'icon-green';
            } else {
                iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"></circle><path d="M12 11v10"></path><path d="M8 15h8"></path></svg>';
                iconClass = 'icon-red';
            }

            return `
            <div class="queue-item overview-link-item" data-overview-target="section-rooms" role="button" tabindex="0">
                <div class="queue-item-icon ${iconClass}">${iconSvg}</div>
                <div class="queue-item-content">
                    <strong>${escapeHtml(item.title)}</strong>
                    <p class="queue-body">${escapeHtml(item.description)}</p>
                </div>
                <div class="queue-item-actions">
                    <span class="queue-value">${escapeHtml(item.value)}</span>
                    <svg class="queue-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>
            `;
          }
        )
        .join("")
    : '<div class="empty-state">Chưa lấy được dữ liệu phòng.</div>';
}

function bindOverviewShortcuts() {
  const loaders = {
    "section-registrations": () => loadRegistrations(),
    "section-requests": () => loadRequests(),
    "section-transfers": () => loadTransfers(),
    "section-renewals": () => loadRenewals(),
    "section-rooms": () => loadRooms(),
  };

  const openTarget = (target) => {
    if (!target) return;
    if (typeof showAdminSection === "function") showAdminSection(target);
    loaders[target]?.();
  };

  document.getElementById("section-overview")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-overview-target]");
    if (!item) return;
    openTarget(item.dataset.overviewTarget);
  });

  document.getElementById("section-overview")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-overview-target]");
    if (!item) return;
    event.preventDefault();
    openTarget(item.dataset.overviewTarget);
  });
}

function summarizeRooms(rooms) {
  if (!rooms.length) return [];
  const available = rooms.filter((room) => room.availableSlots > 0).length;
  const full = rooms.filter((room) => (room.availableSlots ?? 0) <= 0).length;
  const male = rooms.filter((room) => room.genderAllowed === "Nam").length;
  const female = rooms.filter((room) => room.genderAllowed === "Nu" || room.genderAllowed === "Nữ").length;

  return [
    {
      title: "Phòng còn chỗ",
      value: `${available}`,
      description: "Các phòng còn thể nhận thêm sinh viên.",
    },
    {
      title: "Phòng đã đầy",
      value: `${full}`,
      description: "Cần theo dõi để cân đối khi có yêu cầu chuyển.",
    },
    {
      title: "Phòng nam",
      value: `${male}`,
      description: "Tổng số phòng đang dành cho sinh viên nam.",
    },
    {
      title: "Phòng nữ",
      value: `${female}`,
      description: "Tổng số phòng đang dành cho sinh viên nữ.",
    },
  ];
}
