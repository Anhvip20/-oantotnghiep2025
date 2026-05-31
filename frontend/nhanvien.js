
const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) window.location.href = "login.html";

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

const showAddBtn =
    document.getElementById("showAddNhanVienBtn");

const formCard =
    document.getElementById("nhanVienFormCard");

if (user.role !== "admin") {

    if (showAddBtn)
        showAddBtn.style.display = "none";

    if (formCard)
        formCard.style.display = "none";
}

document.getElementById("logoutBtn")
    .addEventListener("click", () => {

        localStorage.removeItem("user");
        window.location.href = "login.html";
    });

if (showAddBtn) {

    showAddBtn.addEventListener("click", () => {

        if (formCard.style.display === "none") {

            formCard.style.display = "block";

            showAddBtn.textContent =
                "Đóng form thêm nhân viên";

        } else {

            formCard.style.display = "none";

            showAddBtn.textContent =
                "Thêm nhân viên";

            resetNhanVienForm();
        }
    });
}

let editingNhanVienId = null;

async function loadNhanVien() {

    const box =
        document.getElementById("nhanVienList");

    box.innerHTML = "Đang tải...";

    try {

        const response =
            await fetch(`${API_BASE}/nhanvien`);

        const data = await response.json();

        if (!Array.isArray(data)
            || data.length === 0) {

            box.innerHTML =
                "Không có dữ liệu nhân viên";

            return;
        }

        box.innerHTML = data.map(item => `

            <div class="item">

                <strong>${item.ten}</strong><br>

                Email: ${item.email}<br>

                Vai trò: ${item.role}<br><br>

                ${user.role === "admin" ? `

                    <button onclick="editNhanVien(
                        ${item.id},
                        '${escapeText(item.ten)}',
                        '${escapeText(item.email)}',
                        '${escapeText(item.matkhau || "")}',
                        '${escapeText(item.role)}'
                    )">

                        Sửa

                    </button>

                    <button class="danger"
                        onclick="deleteNhanVien(${item.id})">

                        Xóa

                    </button>

                ` : ""}

            </div>

        `).join("");

    } catch (error) {

        box.innerHTML =
            "Lỗi tải nhân viên";

        console.error(
            "Lỗi loadNhanVien:",
            error
        );
    }
}

const searchInput =
    document.getElementById("searchNhanVien");

if (searchInput) {

    searchInput.addEventListener("input",
        function () {

            const keyword =
                this.value.toLowerCase();

            const items =
                document.querySelectorAll(
                    "#nhanVienList .item"
                );

            items.forEach(item => {

                const text =
                    item.textContent.toLowerCase();

                item.style.display =
                    text.includes(keyword)
                        ? "block"
                        : "none";
            });
        });
}

function editNhanVien(
    id,
    ten,
    email,
    matkhau,
    role
) {

    editingNhanVienId = id;

    if (formCard.style.display === "none")
        formCard.style.display = "block";

    document.getElementById("tenNhanVien")
        .value = ten;

    document.getElementById("emailNhanVien")
        .value = email;

    document.getElementById("matkhauNhanVien")
        .value = matkhau;

    document.getElementById("roleNhanVien")
        .value = role;

    document.getElementById("nhanVienFormTitle")
        .textContent =
        `Đang sửa nhân viên ID ${id}`;

    document.getElementById("addNhanVienBtn")
        .textContent =
        "Cập nhật nhân viên";

    document.getElementById("cancelNhanVienBtn")
        .style.display =
        "inline-block";

    setTimeout(() =>
        document.getElementById("tenNhanVien")
            .focus(), 300);
}

window.editNhanVien = editNhanVien;

document.getElementById("addNhanVienBtn")
    .addEventListener("click", saveNhanVien);

document.getElementById("cancelNhanVienBtn")
    .addEventListener("click",
        cancelEditNhanVien);

async function saveNhanVien() {

    const ten =
        document.getElementById("tenNhanVien")
            .value.trim();

    const email =
        document.getElementById("emailNhanVien")
            .value.trim();

    const matkhau =
        document.getElementById("matkhauNhanVien")
            .value.trim();

    const role =
        document.getElementById("roleNhanVien")
            .value;

    const message =
        document.getElementById("nhanVienMessage");

    if (!ten || !email || !matkhau) {

        message.textContent =
            "Vui lòng nhập đủ thông tin nhân viên";

        return;
    }

    try {

        let response;

        if (editingNhanVienId) {

            response = await fetch(
                `${API_BASE}/nhanvien/${editingNhanVienId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        ten,
                        email,
                        matkhau,
                        role
                    })
                });

        } else {

            response = await fetch(
                `${API_BASE}/nhanvien`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        ten,
                        email,
                        matkhau,
                        role
                    })
                });
        }

        const data =
            await response.json();

        if (!response.ok) {

            message.textContent =
                data.message
                || "Lưu nhân viên thất bại";

            return;
        }

        message.textContent =
            editingNhanVienId
                ? "Cập nhật nhân viên thành công"
                : "Thêm nhân viên thành công";

        resetNhanVienForm();

        loadNhanVien();

    } catch (error) {

        message.textContent =
            "Lỗi kết nối server";

        console.error(
            "Lỗi saveNhanVien:",
            error
        );
    }
}

async function deleteNhanVien(id) {

    const ok =
        confirm(
            `Bạn có chắc muốn xóa nhân viên ID ${id} không?`
        );

    if (!ok) return;

    try {

        const response =
            await fetch(
                `${API_BASE}/nhanvien/${id}`,
                {
                    method: "DELETE"
                });

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.message
                || "Xóa nhân viên thất bại"
            );

            return;
        }

        alert("Xóa nhân viên thành công");

        loadNhanVien();

    } catch (error) {

        alert("Lỗi kết nối server");

        console.error(
            "Lỗi deleteNhanVien:",
            error
        );
    }
}

function resetNhanVienForm() {

    editingNhanVienId = null;

    document.getElementById("tenNhanVien")
        .value = "";

    document.getElementById("emailNhanVien")
        .value = "";

    document.getElementById("matkhauNhanVien")
        .value = "";

    document.getElementById("roleNhanVien")
        .value = "staff";

    document.getElementById("addNhanVienBtn")
        .textContent = "Thêm nhân viên";

    document.getElementById("cancelNhanVienBtn")
        .style.display = "none";

    document.getElementById("nhanVienFormTitle")
        .textContent =
        "Thêm nhân viên mới";
}

function cancelEditNhanVien() {

    resetNhanVienForm();

    document.getElementById("nhanVienMessage")
        .textContent =
        "Đã hủy chỉnh sửa";
}

function escapeText(text) {

    return String(text)
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;");
}

const toggleSidebar =
    document.getElementById("toggleSidebar");

const sidebar =
    document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {

    sidebar.classList.toggle("collapsed");

});

loadNhanVien();

