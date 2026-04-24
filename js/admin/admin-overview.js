
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
    })),
    ...reqList.slice(0, 3).map((item) => ({
      title: item.title,
      meta: `${item.studentName} - ${item.requestType}`,
      type: "Yêu cầu sinh viên",
    })),
    ...transferList.slice(0, 3).map((item) => ({
      title: `${item.fromRoomCode} -> ${item.toRoomCode}`,
      meta: item.reason || "Không có lý do",
      type: "Chuyển phòng",
    })),
    ...renewalList.slice(0, 3).map((item) => ({
      title: item.contractCode,
      meta: item.packageName,
      type: "Gia hạn",
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
      : '<div class="empty-state">Hiện không có mục nào đang chờ xử lý.</div>';

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
    : '<div class="empty-state">Chưa lấy được dữ liệu phòng.</div>';
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
