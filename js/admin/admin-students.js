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

function setStudentDetailVisible(isVisible) {
  document
    .querySelector(".student-admin-shell")
    ?.classList.toggle("has-selected-student", Boolean(isVisible));
  document.body.classList.toggle("modal-open", Boolean(isVisible));
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
    .getElementById("student-detail-close-btn")
    ?.addEventListener("click", clearStudentDetail);

  document
    .getElementById("student-detail-modal")
    ?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) clearStudentDetail();
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const modal = document.getElementById("student-detail-modal");
    if (modal && getComputedStyle(modal).display !== "none") {
      clearStudentDetail();
    }
  });

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
        setStudentError(
          res?.data?.message || "Không thể cập nhật sinh viên.",
        );
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
    '<tr><td colspan="6" class="table-empty">Đang tải danh sách sinh viên...</td></tr>';

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
      '<tr><td colspan="6" class="table-empty">Không có sinh viên phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminStudents
    .map(
      (student) => `
        <tr class="${selectedStudentId === student.id ? "is-selected" : ""}" data-student-view="${student.id}">
            <td class="student-name-cell"><span class="student-row-icon">${studentIconSvg()}</span><strong>${escapeHtml(student.fullName || "-")}</strong></td>
            <td>${escapeHtml(student.citizenId || "-")}</td>
            <td class="student-gender-cell"><span class="student-gender-icon ${isFemaleGender(student.gender) ? "female" : "male"}">${genderIconSvg(student.gender)}</span>${escapeHtml(normalizeGenderLabel(student.gender))}</td>
            <td>${escapeHtml(student.roomCode || "Chưa có phòng")}</td>
            <td class="student-phone-cell">${phoneIconSvg()}${escapeHtml(student.phone || "-")}</td>
            <td>${student.isActive ? '<span class="student-status-pill">Hoạt động</span>' : '<span class="student-status-pill inactive">Ngừng hoạt động</span>'}</td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("tr[data-student-view]").forEach((row) => {
    row.addEventListener("click", () =>
      selectStudent(Number(row.dataset.studentView)),
    );
  });
}

async function selectStudent(studentId) {
  const res = await callApi(`/students/${studentId}`);
  const student = res?.data?.data || res?.data;
  if (!res?.ok || !student) {
    adminToast(
      res?.data?.message || "Không thể lấy chi tiết sinh viên.",
      true,
    );
    return;
  }

  selectedStudentId = student.id;
  setStudentDetailVisible(true);
  document.getElementById("student-detail-name").textContent =
    student.fullName || "Đã chọn";
  document.getElementById("student-detail-citizen-id").textContent =
    student.citizenId || "-";
  document.getElementById("student-detail-gender").textContent =
    normalizeGenderLabel(student.gender);
  document.getElementById("student-detail-room").textContent =
    student.roomCode || "ChÆ°a cÃ³ phÃ²ng";
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
  selectedStudentId = null;
  setStudentDetailVisible(false);
  document.getElementById("student-detail-name").textContent = "Chưa chọn";
  document.getElementById("student-detail-citizen-id").textContent = "-";
  document.getElementById("student-detail-gender").textContent = "-";
  document.getElementById("student-detail-room").textContent = "-";
  document.getElementById("student-detail-email").textContent = "-";
  document.getElementById("student-detail-created").textContent = "-";
  document.getElementById("student-phone").value = "";
  document.getElementById("student-address").value = "";
  document.getElementById("student-is-active").value = "true";
  setStudentError("");
  renderStudentsTable();
}

function isFemaleGender(gender = "") {
  const value = String(gender).trim().toLowerCase();
  return value === "nữ" || value === "nu" || value === "female";
}

function normalizeGenderLabel(gender = "") {
  if (isFemaleGender(gender)) return "Nữ";
  const value = String(gender).trim().toLowerCase();
  if (value === "nam" || value === "male") return "Nam";
  return gender || "-";
}

function studentIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
}

function genderIconSvg(gender = "") {
  return isFemaleGender(gender)
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5"></circle><path d="M12 13v8M8 17h8"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="14" r="5"></circle><path d="M14 10l6-6M15 4h5v5"></path></svg>';
}

function phoneIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.16 8.81 19.8 19.8 0 0 1 2 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.89.66 2.78a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.3-1.23a2 2 0 0 1 2.11-.45c.89.31 1.82.53 2.78.66A2 2 0 0 1 22 16.92z"></path></svg>';
}
