
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

      const payload = {
        phone: document.getElementById("student-phone").value.trim(),
        permanentAddress: document
          .getElementById("student-address")
          .value.trim(),
        isActive: document.getElementById("student-is-active").value === "true",
      };

      if (!payload.phone || !payload.permanentAddress) {
        setStudentError("Vui lòng nhập số điện thoại và địa chỉ.");
        return;
      }

      const res = await callApi(`/students/${selectedStudentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã cập nhật sinh viên.");
        setStudentError("");
        await loadStudents();
        if (selectedStudentId) await selectStudent(selectedStudentId);
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
              title: "Xóa sinh viên",
              message: "Bạn có chắc muốn xóa sinh viên này không?",
              confirmText: "Xóa",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn xóa sinh viên này không?");
      if (!confirmed) return;

      const res = await callApi(`/students/${selectedStudentId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã xóa sinh viên.");
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
            <td>${student.isActive ? '<span class="pill">Hoạt động</span>' : '<span class="pill neutral">Ngừng hoạt động</span>'}</td>
            <td><button type="button" class="secondary-btn" data-student-view="${student.id}">Chọn</button></td>
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
  const student = res?.data?.data || res?.data;
  if (!res?.ok || !student) {
    adminToast(res?.data?.message || "Không thể lấy chi tiết sinh viên.", true);
    return;
  }

  selectedStudentId = student.id;
  document.getElementById("student-detail-name").textContent =
    student.fullName || "Đã chọn";
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
  document.getElementById("student-detail-name").textContent = "Chưa chọn";
  document.getElementById("student-detail-email").textContent = "-";
  document.getElementById("student-detail-created").textContent = "-";
  document.getElementById("student-phone").value = "";
  document.getElementById("student-address").value = "";
  document.getElementById("student-is-active").value = "true";
  setStudentError("");
}
