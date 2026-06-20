const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

const navNhanVien = document.getElementById("navNhanVien");

if (user.role !== "admin") {
    if (navNhanVien) navNhanVien.style.display = "none";
}

document.getElementById("tenNguoiDung").textContent =
    user.ten || "Không có tên";

document.getElementById("userId").textContent =
    user.id || "";

document.getElementById("userTen").textContent =
    user.ten || "";

document.getElementById("userEmail").textContent =
    user.email || "";

document.getElementById("userPhone").textContent =
    user.soDienThoai || "Chưa cập nhật";

document.getElementById("userGender").textContent =
    user.gioiTinh || "Chưa cập nhật";

document.getElementById("userRole").textContent =
    user.role || "";

async function logout() {
    const ok = await showConfirmDialog({
        title: "Đăng xuất tài khoản?",
        message: "Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.",
        confirmText: "Đăng xuất",
        cancelText: "Ở lại",
        type: "danger"
    });

    if (!ok) return;

    localStorage.removeItem("user");
    window.location.href = "login.html";
}

const toggleSidebar =
    document.getElementById("toggleSidebar");

const sidebar =
    document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {

    sidebar.classList.toggle("collapsed");

});

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("logoutBtnMain").addEventListener("click", logout);
