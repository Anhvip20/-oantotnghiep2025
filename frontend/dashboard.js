const API_BASE = "http://localhost:3000";
const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

if (user.role !== "admin") {
    const navNhanVien = document.getElementById("navNhanVien");
    if (navNhanVien) navNhanVien.style.display = "none";

    const tongNhanVienCard = document.getElementById("tongNhanVienCard");
    const nhanVienMoiCard = document.getElementById("nhanVienMoiCard");
    if (tongNhanVienCard) tongNhanVienCard.style.display = "none";
    if (nhanVienMoiCard) nhanVienMoiCard.style.display = "none";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "login.html";
});

async function loadThongKe() {
    try {
        const response = await fetch(`${API_BASE}/thongke`);
        const data = await response.json();
        document.getElementById("tongNhanVien").textContent = data.tongNhanVien ?? 0;
        document.getElementById("tongCongViec").textContent = data.tongCongViec ?? 0;
        document.getElementById("dangLam").textContent = data.dangLam ?? 0;
    } catch (error) {
        console.error("Lỗi loadThongKe:", error);
    }
}

async function loadNhanVienMoi() {
    const box = document.getElementById("nhanVienMoi");
    box.innerHTML = "Đang tải...";
    try {
        const response = await fetch(`${API_BASE}/nhanvien`);
        const data = await response.json();
        const top3 = data.slice(0, 3);
        if (!Array.isArray(top3) || top3.length === 0) {
            box.innerHTML = "Không có dữ liệu";
            return;
        }
        box.innerHTML = top3.map(item => `
            <div class="item">
                <strong>${item.ten}</strong><br>
                Email: ${item.email}<br>
                Vai trò: ${item.role}
            </div>
        `).join("");
    } catch (error) {
        box.innerHTML = "Lỗi tải dữ liệu";
        console.error(error);
    }
}

async function loadCongViecCuaToi() {
    const box = document.getElementById("congViecCuaToi");
    box.innerHTML = "Đang tải...";
    try {
        const response = await fetch(`${API_BASE}/congviec`);
        const data = await response.json();
        let tasks = data;
        const taskTitle = document.getElementById("taskTitle");

        if (user.role === "admin") {
            taskTitle.textContent = "Công việc gần đây";
        }
        if (user.role !== "admin") {
            tasks = data.filter(item => item.tenNhanVien === user.ten);
        }
        const top3 = tasks.slice(0, 5);
        if (!Array.isArray(top3) || top3.length === 0) {
            box.innerHTML = "Không có công việc nào";
            return;
        }
        box.innerHTML = top3.map(item => `
            <div class="item">
                <strong>${item.tieuDe}</strong><br>
                Trạng thái: ${item.trangThai}<br>
                Hạn: ${formatDate(item.han)}<br>
            </div>
        `).join("");
    } catch (error) {
        box.innerHTML = "Lỗi tải dữ liệu";
        console.error(error);
    }
}

async function loadThongBao() {
    if (!user) return;
    try {
        const response = await fetch(`${API_BASE}/thongbao/${user.id}`);
        const data = await response.json();
        const unreadCount = data.filter(item => item.daDoc == 0).length;
        const badge = document.getElementById("notificationCount");
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? "inline-block" : "none";

        const list = document.getElementById("notificationList");
        if (!Array.isArray(data) || data.length === 0) {
            list.innerHTML = "Không có thông báo";
            return;
        }

        list.innerHTML = data.map(item => `
            <div class="notification-item ${item.daDoc == 0 ? "unread" : ""}">
                <div class="notification-text">
                    ${item.noiDung}
                </div>
                <div class="notification-footer">
                    <span class="notification-time">
                        ${new Date(item.thoiGian).toLocaleString("vi-VN")}
                    </span>
                    ${item.daDoc == 1 ? `<span style="color:green;font-size:12px;">Đã đọc</span>` :
                `<button class="read-btn" onclick="markAsRead(${item.id})">Đánh dấu đã đọc</button>`}
                </div>
            </div>
        `).join("");

    } catch (error) {
        console.error("Lỗi loadThongBao:", error);
    }
}

async function markAsRead(id) {
    try {
        console.log("Đang đọc thông báo ID:", id);

        const response = await fetch(`${API_BASE}/thongbao/dadoc/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });
        const result = await response.json();
        console.log(result);

        await fetch(`${API_BASE}/thongbao/notify-admin/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nhanvienId: user.id, tenNhanVien: user.ten })
        });

        await loadThongBao();

    } catch (error) {
        console.error("Lỗi markAsRead:", error);
    }
}
window.markAsRead = markAsRead;

document.getElementById("notificationBtn").addEventListener("click", () => {
    const dropdown = document.getElementById("notificationDropdown");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
});
document.getElementById("closeNotificationBtn").addEventListener("click", () => {
    document.getElementById("notificationDropdown").style.display = "none";
});

function formatDate(dateValue) {
    if (!dateValue) return "";
    const d = new Date(dateValue);
    return d.toISOString().split("T")[0];
}

loadThongKe();
loadNhanVienMoi();
loadCongViecCuaToi();
loadThongBao();