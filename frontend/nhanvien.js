const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) window.location.href = "login.html";

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

const showAddBtn = document.getElementById("showAddNhanVienBtn");
const formCard = document.getElementById("nhanVienFormCard");
const searchInput = document.getElementById("searchNhanVien");
const workloadFilter = document.getElementById("workloadFilter");
const employeeSummary = document.getElementById("employeeSummary");

let editingNhanVienId = null;
let allNhanVien = [];
let allCongViec = [];

if (user.role !== "admin") {
    if (showAddBtn) showAddBtn.style.display = "none";
    if (formCard) formCard.style.display = "none";
}

document.getElementById("logoutBtn")
    .addEventListener("click", async () => {
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
    });

if (showAddBtn) {
    showAddBtn.addEventListener("click", () => {
        formCard.style.display = "block";
        showAddBtn.style.display = "none";
        resetNhanVienForm();
    });
}

function escapeText(text) {
    return String(text ?? "")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;");
}

function isValidEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    const allowedTlds = new Set([
        "com",
        "vn",
        "com.vn",
        "edu.vn",
        "gov.vn",
        "net",
        "org",
        "info",
        "io",
        "co",
        "me",
        "dev",
        "ai",
        "app"
    ]);

    if (!/^[a-z0-9._%+-]+@([a-z0-9-]+\.)+[a-z]{2,}$/.test(value)) {
        return false;
    }

    const [local, domain] = value.split("@");

    if (!local || !domain || local.includes("..") || domain.includes("..")) {
        return false;
    }

    const labels = domain.split(".");

    if (labels.some(label =>
        !label
        || label.startsWith("-")
        || label.endsWith("-")
    )) {
        return false;
    }

    const lastTwoLabels = labels.slice(-2).join(".");
    const lastLabel = labels[labels.length - 1];

    return allowedTlds.has(lastTwoLabels) || allowedTlds.has(lastLabel);
}

function isValidName(name) {
    const normalizedName = String(name || "").trim().replace(/\s+/g, " ");

    return normalizedName.length >= 2
        && normalizedName.length <= 80
        && /^[A-Za-zÀ-ỹ\s'-]+$/.test(normalizedName);
}

function isValidPhone(phone) {
    return /^(03|05|07|08|09)\d{8}$/.test(String(phone || "").trim());
}

function formatDate(dateValue) {
    if (!dateValue) return "";

    const d = new Date(dateValue);

    if (Number.isNaN(d.getTime())) {
        return String(dateValue).split("T")[0];
    }

    return d.toISOString().split("T")[0];
}

function isOverdue(task) {
    if (!task.han || task.trangThai === "Hoàn thành") return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(task.han);
    deadline.setHours(0, 0, 0, 0);

    return deadline < today;
}

function getEmployeeTasks(employee) {
    return allCongViec.filter(task =>
        String(task.nhanVienId) === String(employee.id)
        || task.tenNhanVien === employee.ten
    );
}

function getWorkloadStats(employee) {
    const tasks = getEmployeeTasks(employee);
    const overdue = tasks.filter(isOverdue).length;
    const done = tasks.filter(task => task.trangThai === "Hoàn thành").length;
    const doing = tasks.filter(task => task.trangThai === "Đang làm").length;
    const unfinished = tasks.filter(task => task.trangThai !== "Hoàn thành").length;

    return {
        tasks,
        total: tasks.length,
        unfinished,
        doing,
        done,
        overdue
    };
}

function getWorkloadLevel(stats) {
    if (stats.overdue > 0) {
        return {
            key: "overdue",
            label: "Có việc quá hạn",
            className: "workload-overdue"
        };
    }

    if (stats.unfinished <= 1) {
        return {
            key: "free",
            label: "Đang rảnh",
            className: "workload-free"
        };
    }

    if (stats.unfinished <= 3) {
        return {
            key: "normal",
            label: "Bình thường",
            className: "workload-normal"
        };
    }

    return {
        key: "busy",
        label: "Đang bận",
        className: "workload-busy"
    };
}

function getEmployeeAvatar(employee) {
    if (employee.gioiTinh === "Nữ") {
        return "👩‍💼";
    }

    if (employee.gioiTinh === "Nam") {
        return "👨‍💼";
    }

    return "👤";
}

function getFilteredNhanVien() {
    const keyword = (searchInput?.value || "").trim().toLowerCase();
    const selectedWorkload = workloadFilter?.value || "all";

    return allNhanVien.filter(employee => {
        const stats = getWorkloadStats(employee);
        const workload = getWorkloadLevel(stats);
        const text = [
            employee.ten,
            employee.email,
            employee.soDienThoai,
            employee.gioiTinh,
            employee.role,
            workload.label
        ].join(" ").toLowerCase();

        const matchKeyword = !keyword || text.includes(keyword);
        const matchWorkload =
            selectedWorkload === "all"
            || workload.key === selectedWorkload;

        return matchKeyword && matchWorkload;
    });
}

function renderTaskList(employee, stats) {
    if (!stats.tasks.length) {
        return `
            <div id="tasks-${employee.id}" class="employee-task-list">
                Nhân viên này chưa có công việc nào.
            </div>
        `;
    }

    return `
        <div id="tasks-${employee.id}" class="employee-task-list">
            <strong>Công việc của ${escapeText(employee.ten)}</strong>
            <ul>
                ${stats.tasks.map(task => `
                    <li>
                        ${escapeText(task.tieuDe)}
                        <span class="task-status">
                            (${isOverdue(task) ? "Quá hạn" : escapeText(task.trangThai)})
                        </span>
                        ${task.ngayGiao ? `- Giao: ${formatDate(task.ngayGiao)}` : ""}
                        ${task.han ? `- Hạn: ${formatDate(task.han)}` : ""}
                    </li>
                `).join("")}
            </ul>
        </div>
    `;
}

function renderNhanVien() {
    const box = document.getElementById("nhanVienList");
    const data = getFilteredNhanVien();

    if (employeeSummary) {
        employeeSummary.textContent =
            `Hiển thị ${data.length}/${allNhanVien.length} nhân viên`;
    }

    if (!data.length) {
        box.innerHTML = "Không có nhân viên phù hợp";
        return;
    }

    box.innerHTML = data.map(item => {
        const stats = getWorkloadStats(item);
        const workload = getWorkloadLevel(stats);

        return `
            <div class="item">
                <div class="employee-head">
                    <div class="employee-main">
                        <div class="employee-avatar">
                            ${getEmployeeAvatar(item)}
                        </div>

                        <div>
                            <div class="employee-name">${escapeText(item.ten)}</div>
                            <div class="employee-meta">
                                Email: ${escapeText(item.email)}<br>
                                Số điện thoại: ${escapeText(item.soDienThoai || "Chưa cập nhật")}<br>
                                Giới tính: ${escapeText(item.gioiTinh || "Chưa cập nhật")}<br>
                                Vai trò: ${escapeText(item.role)}
                            </div>
                        </div>
                    </div>

                    <span class="workload-badge ${workload.className}">
                        ${workload.label}
                    </span>
                </div>

                <div class="workload-stats">
                    <div class="stat-pill">
                        <span>Tổng việc</span>
                        <strong>${stats.total}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Chưa xong</span>
                        <strong>${stats.unfinished}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Đang làm</span>
                        <strong>${stats.doing}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Quá hạn</span>
                        <strong>${stats.overdue}</strong>
                    </div>
                </div>

                <button class="secondary" onclick="toggleNhanVienTasks(${item.id})">
                    Xem công việc
                </button>

                ${user.role === "admin" ? `
                    <button onclick="editNhanVien(
                        ${item.id},
                        '${escapeText(item.ten)}',
                        '${escapeText(item.email)}',
                        '${escapeText(item.soDienThoai || "")}',
                        '${escapeText(item.gioiTinh || "Nam")}',
                        '${escapeText(item.matkhau || "")}',
                        '${escapeText(item.role)}'
                    )">
                        Sửa
                    </button>

                    <button class="danger" onclick="deleteNhanVien(${item.id})">
                        Xóa
                    </button>
                ` : ""}

                ${renderTaskList(item, stats)}
            </div>
        `;
    }).join("");
}

async function loadNhanVien() {
    const box = document.getElementById("nhanVienList");
    box.innerHTML = "Đang tải...";

    try {
        const [nhanVienResponse, congViecResponse] = await Promise.all([
            fetch(`${API_BASE}/nhanvien`),
            fetch(`${API_BASE}/congviec`)
        ]);

        allNhanVien = await nhanVienResponse.json();
        allCongViec = await congViecResponse.json();

        if (!Array.isArray(allNhanVien) || allNhanVien.length === 0) {
            box.innerHTML = "Không có dữ liệu nhân viên";
            return;
        }

        if (!Array.isArray(allCongViec)) {
            allCongViec = [];
        }

        renderNhanVien();
    } catch (error) {
        box.innerHTML = "Lỗi tải nhân viên";
        console.error("Lỗi loadNhanVien:", error);
    }
}

window.toggleNhanVienTasks = function (id) {
    const taskList = document.getElementById(`tasks-${id}`);
    taskList?.classList.toggle("open");
};

function editNhanVien(id, ten, email, soDienThoai, gioiTinh, matkhau, role) {
    editingNhanVienId = id;

    if (formCard.style.display === "none")
        formCard.style.display = "block";

    if (showAddBtn) {
        showAddBtn.style.display = "none";
    }

    document.getElementById("tenNhanVien").value = ten;
    document.getElementById("emailNhanVien").value = email;
    document.getElementById("soDienThoaiNhanVien").value = soDienThoai;
    document.getElementById("gioiTinhNhanVien").value = gioiTinh || "Nam";
    document.getElementById("matkhauNhanVien").value = matkhau;
    document.getElementById("roleNhanVien").value = role;

    document.getElementById("nhanVienFormTitle").textContent =
        `Đang sửa nhân viên ID ${id}`;

    document.getElementById("addNhanVienBtn").textContent =
        "Cập nhật nhân viên";

    setTimeout(() =>
        document.getElementById("tenNhanVien").focus(), 300);
}

window.editNhanVien = editNhanVien;

document.getElementById("addNhanVienBtn")
    .addEventListener("click", saveNhanVien);

document.getElementById("cancelNhanVienBtn")
    .addEventListener("click", cancelEditNhanVien);

searchInput?.addEventListener("input", renderNhanVien);
workloadFilter?.addEventListener("change", renderNhanVien);

async function saveNhanVien() {
    const ten = document.getElementById("tenNhanVien").value.trim().replace(/\s+/g, " ");
    const email = document.getElementById("emailNhanVien").value.trim().toLowerCase();
    const soDienThoai = document.getElementById("soDienThoaiNhanVien").value.trim();
    const gioiTinh = document.getElementById("gioiTinhNhanVien").value;
    const matkhau = document.getElementById("matkhauNhanVien").value.trim();
    const role = document.getElementById("roleNhanVien").value;
    const message = document.getElementById("nhanVienMessage");

    if (!ten || !email || !soDienThoai || !gioiTinh || !matkhau) {
        message.textContent = "Vui lòng nhập đủ thông tin nhân viên";
        return;
    }

    if (!isValidName(ten)) {
        message.textContent = "Tên nhân viên chỉ được chứa chữ cái và khoảng trắng";
        return;
    }

    if (!isValidEmail(email)) {
        message.textContent = "Email không đúng định dạng";
        return;
    }

    if (!isValidPhone(soDienThoai)) {
        message.textContent = "Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09";
        return;
    }

    if (!["Nam", "Nữ"].includes(gioiTinh)) {
        message.textContent = "Giới tính không hợp lệ";
        return;
    }

    try {
        let response;

        if (editingNhanVienId) {
            response = await fetch(
                `${API_BASE}/nhanvien/${editingNhanVienId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ten, email, soDienThoai, gioiTinh, matkhau, role })
                });
        } else {
            response = await fetch(
                `${API_BASE}/nhanvien`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ten, email, soDienThoai, gioiTinh, matkhau, role })
                });
        }

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "Lưu nhân viên thất bại";
            return;
        }

        const successMessage =
            editingNhanVienId
                ? "Cập nhật nhân viên thành công"
                : "Thêm nhân viên thành công";

        closeNhanVienForm();
        showToast(successMessage);
        loadNhanVien();
    } catch (error) {
        message.textContent = "Lỗi kết nối server";
        console.error("Lỗi saveNhanVien:", error);
    }
}

async function deleteNhanVien(id) {
    const ok = await showConfirmDialog({
        title: "Xóa nhân viên?",
        message: `Nhân viên ID ${id} sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`,
        confirmText: "Xóa",
        cancelText: "Hủy",
        type: "danger"
    });

    if (!ok) return;

    try {
        const response = await fetch(
            `${API_BASE}/nhanvien/${id}`,
            { method: "DELETE" });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Xóa nhân viên thất bại");
            return;
        }

        showToast("Xóa nhân viên thành công");
        loadNhanVien();
    } catch (error) {
        alert("Lỗi kết nối server");
        console.error("Lỗi deleteNhanVien:", error);
    }
}

function resetNhanVienForm() {
    editingNhanVienId = null;

    document.getElementById("tenNhanVien").value = "";
    document.getElementById("emailNhanVien").value = "";
    document.getElementById("soDienThoaiNhanVien").value = "";
    document.getElementById("gioiTinhNhanVien").value = "Nam";
    document.getElementById("matkhauNhanVien").value = "";
    document.getElementById("roleNhanVien").value = "staff";
    document.getElementById("addNhanVienBtn").textContent = "Thêm nhân viên";
    document.getElementById("nhanVienFormTitle").textContent =
        "Thêm nhân viên mới";
    document.getElementById("nhanVienMessage").textContent = "";
}

function closeNhanVienForm() {
    resetNhanVienForm();

    if (formCard) {
        formCard.style.display = "none";
    }

    if (showAddBtn && user.role === "admin") {
        showAddBtn.style.display = "inline-block";
    }
}

function cancelEditNhanVien() {
    closeNhanVienForm();
}

const toggleSidebar = document.getElementById("toggleSidebar");
const sidebar = document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});

loadNhanVien();
