function getApiErrorMessage(res, fallback) {
  if (res?.data?.message) return res.data.message;
  if (res?.data?.errors) {
    return Object.values(res.data.errors).flat().join(" ");
  }
  return fallback;
}

async function loadAdminProfile() {
  const res = await callApi("/profile");
  const profile = res?.data?.data;
  if (!res?.ok || !profile) {
    document.getElementById("admin-profile-error").textContent =
      getApiErrorMessage(res, "Không thể tải thông tin tài khoản.");
    return;
  }

  document.getElementById("admin-profile-name").value = profile.fullName || "";
  document.getElementById("admin-profile-email").value = profile.email || "";
  document.getElementById("admin-profile-phone").value = profile.phone || "";
  document.getElementById("admin-profile-error").textContent = "";

  if (profile.fullName) {
    localStorage.setItem("fullName", profile.fullName);
    sessionStorage.setItem("fullName", profile.fullName);
    document.getElementById("admin-name").textContent = profile.fullName;
  }
}

function bindAdminProfileControls() {
  document
    .getElementById("reload-admin-profile-btn")
    ?.addEventListener("click", loadAdminProfile);

  document
    .getElementById("admin-profile-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById("admin-profile-error");
      const phone = document.getElementById("admin-profile-phone").value.trim();
      errorEl.textContent = "";

      if (!/^(03|05|07|08|09)\d{8}$/.test(phone)) {
        errorEl.textContent =
          "Số điện thoại phải bắt đầu bằng 03, 05, 07, 08, 09 và có đúng 10 chữ số.";
        return;
      }

      const res = await callApi("/profile", {
        method: "PUT",
        body: JSON.stringify({ phone }),
      });

      if (res?.ok) {
        adminToast(res.data?.message || "Đã cập nhật số điện thoại.");
        loadAdminProfile();
      } else {
        errorEl.textContent = getApiErrorMessage(
          res,
          "Không thể cập nhật số điện thoại.",
        );
      }
    });

  document
    .getElementById("admin-password-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById("admin-password-error");
      const oldPassword = document.getElementById("admin-current-password").value;
      const newPassword = document.getElementById("admin-new-password").value;
      const confirmPassword = document.getElementById(
        "admin-confirm-password",
      ).value;
      errorEl.textContent = "";

      if (!oldPassword || !newPassword || !confirmPassword) {
        errorEl.textContent = "Vui lòng nhập đầy đủ thông tin mật khẩu.";
        return;
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
        errorEl.textContent =
          "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.";
        return;
      }
      if (newPassword !== confirmPassword) {
        errorEl.textContent = "Mật khẩu xác nhận không khớp.";
        return;
      }

      const res = await callApi("/profile/change-password", {
        method: "PUT",
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });

      if (res?.ok) {
        adminToast(res.data?.message || "Đã đổi mật khẩu.");
        event.target.reset();
      } else {
        errorEl.textContent = getApiErrorMessage(
          res,
          "Không thể đổi mật khẩu.",
        );
      }
    });
}
