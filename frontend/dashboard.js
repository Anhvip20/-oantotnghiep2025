const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

if (user.role !== "admin") {

    const navNhanVien =
        document.getElementById("navNhanVien");

    if (navNhanVien) {
        navNhanVien.style.display = "none";
    }
}

document.getElementById("logoutBtn")
    .addEventListener("click", () => {

        localStorage.removeItem("user");
        window.location.href = "login.html";
    });

async function loadThongKe() {

    try {

        const response =
            await fetch(`${API_BASE}/thongke`);

        const data = await response.json();

        document.getElementById("tongNhanVien")
            .textContent = data.tongNhanVien ?? 0;

        document.getElementById("tongCongViec")
            .textContent = data.tongCongViec ?? 0;

        document.getElementById("dangLam")
            .textContent = data.dangLam ?? 0;

    } catch (error) {

        console.error("Lỗi loadThongKe:", error);
    }
}

async function loadNhanVienMoi() {

    const box =
        document.getElementById("nhanVienMoi");

    if (!box) return;

    box.innerHTML = "Đang tải...";

    try {

        const response =
            await fetch(`${API_BASE}/nhanvien`);

        const data = await response.json();

        const top3 = data.slice(0, 3);

        if (!Array.isArray(top3)
            || top3.length === 0) {

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

    const box =
        document.getElementById("congViecCuaToi");

    if (!box) return;

    box.innerHTML = "Đang tải...";

    try {

        const response =
            await fetch(`${API_BASE}/congviec`);

        const data = await response.json();

        let tasks = data;

        const taskTitle =
            document.getElementById("taskTitle");

        if (user.role === "admin") {

            taskTitle.textContent =
                "Công việc gần đây";

        } else {

            tasks = data.filter(item =>
                item.tenNhanVien === user.ten
            );
        }

        const topTasks = tasks.slice(0, 5);

        if (!Array.isArray(topTasks)
            || topTasks.length === 0) {

            box.innerHTML =
                "Không có công việc nào";

            return;
        }

        box.innerHTML = topTasks.map(item => `

            <div class="item">

                <strong>${item.tieuDe}</strong><br>

                Trạng thái:
                ${item.trangThai}<br>

                Hạn:
                ${formatDate(item.han)}

            </div>

        `).join("");

    } catch (error) {

        box.innerHTML = "Lỗi tải dữ liệu";

        console.error(error);
    }
}

async function loadThongBao() {

    try {

        const response =
            await fetch(`${API_BASE}/thongbao/${user.id}`);

        const data = await response.json();

        const list =
            document.getElementById("notificationList");

        const count =
            document.getElementById("notificationCount");

        if (!Array.isArray(data)) return;

        const unread =
            data.filter(tb => !tb.daDoc);

        count.textContent = unread.length;

        if (data.length === 0) {

            list.innerHTML =
                "<p>Không có thông báo</p>";

            return;
        }

        list.innerHTML = data.map(tb => `

                <div class="notification-item ${tb.daDoc ? "" : "unread"}">

                    <div class="notification-text">
                        ${tb.noiDung}
                    </div>

                    <span class="notification-time">
                        ${new Date(tb.thoiGian).toLocaleString("vi-VN")}
                    </span>

                    ${!tb.daDoc ? `

                        <button
                            class="read-btn"
                            onclick="markAsRead(${tb.id})">

                            Đánh dấu đã đọc

                        </button>

                    ` : `

                        <span class="notification-time">
                            Đã đọc
                        </span>

                    `}

                </div>

        `).join("");

    } catch (error) {

        console.error(
            "Lỗi loadThongBao:",
            error
        );
    }
}

async function markAsRead(id) {
    try {
        const response = await fetch(`${API_BASE}/thongbao/dadoc/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Không thể đánh dấu đã đọc");
            return;
        }

        await loadThongBao();

    } catch (error) {
        console.error("Lỗi markAsRead:", error);
        alert("Lỗi kết nối server");
    }
}

window.markAsRead = markAsRead;
function formatDate(dateValue) {

    if (!dateValue) return "";

    const d = new Date(dateValue);

    return d.toISOString()
        .split("T")[0];
}

const notificationSidebar =
    document.querySelector(".notification-sidebar");

const notificationDropdown =
    document.getElementById("notificationDropdown");

notificationSidebar
    .addEventListener("click", () => {

        notificationDropdown.style.display =
            notificationDropdown.style.display === "block"
                ? "none"
                : "block";
    });

document.getElementById("closeNotificationBtn")
    .addEventListener("click", () => {

        notificationDropdown.style.display = "none";
    });

const toggleSidebar =
    document.getElementById("toggleSidebar");

const sidebar =
    document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {

    sidebar.classList.toggle("collapsed");

});

loadThongKe();
loadNhanVienMoi();
loadCongViecCuaToi();
loadThongBao();

