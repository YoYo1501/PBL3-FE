// 6. FORCE CHANGE PASSWORD
// BE field names: oldPassword, newPassword, confirmPassword
// Validation: ít nhất 1 chữ hoa, 1 chữ thường, 1 số
// ======================================================================
function initForceChangePassword() {
    const btn = document.getElementById('fcp-submit-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const oldPw     = document.getElementById('fcp-old').value;
        const newPw     = document.getElementById('fcp-new').value;
        const confirmPw = document.getElementById('fcp-confirm').value;
        const errEl     = document.getElementById('fcp-error');

        errEl.textContent = '';
        if (!oldPw)                { errEl.textContent = 'Nhập mật khẩu cũ.'; return; }
        if (!newPw)                { errEl.textContent = 'Nhập mật khẩu mới.'; return; }
        if (newPw.length < 8)     { errEl.textContent = 'Mật khẩu mới phải ít nhất 8 ký tự.'; return; }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPw)) {
            errEl.textContent = 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số.'; return;
        }
        if (newPw !== confirmPw)   { errEl.textContent = 'Mật khẩu xác nhận không khớp.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({
                oldPassword:     oldPw,
                newPassword:     newPw,
                confirmPassword: confirmPw
            })
        });
        btn.disabled = false;

        if (res?.ok) {
            localStorage.setItem('mustChangePassword', 'false');
            sessionStorage.setItem('mustChangePassword', 'false');
            document.getElementById('force-change-pw-modal').classList.remove('open');
            showToast('🎉 Đổi mật khẩu thành công! Chào mừng bạn.');
        } else {
            errEl.textContent = res?.data?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.';
        }
    });
}

// ======================================================================
// 7. PROFILE – GET /api/profile & PUT /api/profile & PUT /api/profile/change-password
// ======================================================================
async function loadProfile() {
    const res = await callApi('/profile');
    if (!res?.ok || !res.data?.data) {
        // Hiển thị thông tin từ localStorage nếu API lỗi
        document.getElementById('sv-fullname').textContent = localStorage.getItem('fullName') || '—';
        return;
    }

    const p = res.data.data; // UserProfileResponse

    // Thông tin chung
    document.getElementById('sv-fullname').textContent   = p.fullName         || '—';
    document.getElementById('sv-citizenid').textContent  = p.citizenId        || '—';
    document.getElementById('sv-gender').textContent     = p.gender           || '—';
    document.getElementById('sv-email').textContent      = p.email            || '—';

    // Thông tin liên hệ (form)
    const phoneEl   = document.getElementById('edit-phone');
    const addrEl    = document.getElementById('edit-address');
    const relNEl    = document.getElementById('edit-relative-name');
    const relPhEl   = document.getElementById('edit-relative-phone');
    const relRelEl  = document.getElementById('edit-relationship');

    if (phoneEl)  phoneEl.value  = p.phone            || '';
    if (addrEl)   addrEl.value   = p.permanentAddress || '';
    if (relNEl)   relNEl.value   = p.relativeName     || '';
    if (relPhEl)  relPhEl.value  = p.relativePhone    || '';
    if (relRelEl) relRelEl.value = p.relationship     || '';

    // Cập nhật header name
    localStorage.setItem('fullName', p.fullName || '');
    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = p.fullName || '—';
    const avatar = document.getElementById('header-avatar');
    if (avatar) avatar.textContent = (p.fullName || 'S').charAt(0).toUpperCase();

    // Bind nút lưu thông tin liên hệ (chỉ bind 1 lần)
    bindSaveContact();
    // Bind đổi mật khẩu
    bindChangePassword();
}

function bindSaveContact() {
    const btn = document.getElementById('save-contact-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl = document.getElementById('contact-error');
        errEl.textContent = '';
        const dto = {
            phone:            document.getElementById('edit-phone').value.trim(),
            permanentAddress: document.getElementById('edit-address').value.trim(),
            relativeName:     document.getElementById('edit-relative-name').value.trim(),
            relativePhone:    document.getElementById('edit-relative-phone').value.trim(),
            relationship:     document.getElementById('edit-relationship').value.trim(),
        };
        if (!dto.phone) { errEl.textContent = 'Số điện thoại không được để trống.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile', { method: 'PUT', body: JSON.stringify(dto) });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Cập nhật thông tin thành công!');
        } else {
            let msg = 'Cập nhật thất bại.';
            if (res?.data?.message) {
                msg = res.data.message;
            } else if (res?.data?.errors) {
                msg = Object.values(res.data.errors).flat().join(' ');
            }
            errEl.textContent = msg;
        }
    });
}

function bindChangePassword() {
    const btn = document.getElementById('change-pw-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
        const errEl    = document.getElementById('pw-error');
        errEl.textContent = '';
        const current  = document.getElementById('pw-current').value;
        const newPw    = document.getElementById('pw-new').value;
        const confirm  = document.getElementById('pw-confirm').value;
        if (!current || !newPw || !confirm) { errEl.textContent = 'Vui lòng điền đầy đủ.'; return; }
        if (newPw !== confirm)              { errEl.textContent = 'Mật khẩu mới không khớp.'; return; }
        if (newPw.length < 8)              { errEl.textContent = 'Mật khẩu mới phải có ít nhất 8 ký tự.'; return; }

        btn.disabled = true;
        const res = await callApi('/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({ oldPassword: current, newPassword: newPw, confirmPassword: confirm })
        });
        btn.disabled = false;

        if (res?.ok) {
            showToast('Đổi mật khẩu thành công!');
            document.getElementById('pw-current').value = '';
            document.getElementById('pw-new').value     = '';
            document.getElementById('pw-confirm').value = '';
            updatePasswordStrength('');
        } else {
            let msg = 'Đổi mật khẩu thất bại.';
            if (res?.data?.message) {
                msg = res.data.message;
            } else if (res?.data?.errors) {
                msg = Object.values(res.data.errors).flat().join(' ');
            }
            errEl.textContent = msg;
        }
    });
}

// ======================================================================
