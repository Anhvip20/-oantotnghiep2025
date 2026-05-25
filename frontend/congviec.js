document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:3000";
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return window.location.href = "login.html";

    const role = String(user.role).trim().toLowerCase();
    document.getElementById("userInfo").textContent = `${user.ten} (${user.role})`;


    const showAddBtn = document.getElementById("showAddCongViecBtn");
    const formCard = document.getElementById("congViecFormCard");
    const cancelBtn = document.getElementById("cancelCongViecBtn");
    const addBtn = document.getElementById("addCongViecBtn");
    const congViecList = document.getElementById("congViecList");
    const navNhanVien = document.getElementById("navNhanVien");
    const logoutBtn = document.getElementById("logoutBtn");


    logoutBtn?.addEventListener("click", () => {
        localStorage.removeItem("user");
        window.location.href = "login.html";
    });

    if (role !== "admin") {
        if (navNhanVien) navNhanVien.style.display = "none";
        if (showAddBtn) showAddBtn.style.display = "none";
        if (formCard) formCard.style.display = "none";
    }

    if (role === "admin" && showAddBtn && formCard) {
        formCard.style.display = "none";
        showAddBtn.addEventListener("click", () => {
            formCard.style.display = "block";
            showAddBtn.style.display = "none";
        });
        cancelBtn?.addEventListener("click", () => {
            formCard.style.display = "none";
            showAddBtn.style.display = "inline-block";
            resetCongViecForm();
        });
    }

    let editingCongViecId = null;

    function safeText(text) { return text ? String(text).replace(/'/g, "\\'").replace(/"/g, "&quot;") : ""; }

    async function loadNhanVienDropdown(selectedId = "") {
        const select = document.getElementById("nhanVienId");
        try {
            const res = await fetch(`${API_BASE}/nhanvien`);
            const data = await res.json();
            select.innerHTML = `<option value="">-- Chọn nhân viên --</option>` +
                data.map(i => `<option value="${i.id}" ${String(i.id) === String(selectedId) ? "selected" : ""}>${i.ten} - ${i.email}</option>`).join("");
        } catch (err) { console.error("Lỗi loadNhanVienDropdown:", err); }
    }

    async function loadCongViec() {
        if (!congViecList) return;
        congViecList.innerHTML = "Đang tải...";
        try {
            const res = await fetch(`${API_BASE}/congviec`);
            const data = await res.json();
            if (!Array.isArray(data) || !data.length) { congViecList.innerHTML = "Không có dữ liệu công việc"; return; }

            congViecList.innerHTML = data.map(item => `
                <div class="item">
                    <strong>${safeText(item.tieuDe)}</strong><br>
                    Mô tả: ${safeText(item.moTa)}<br>
                    Trạng thái: ${safeText(item.trangThai)}<br>
                    Hạn: ${safeText(item.han) || ""}<br>
                    Nhân viên: ${safeText(item.tenNhanVien) || "Chưa gán"}<br><br>
                    ${role === "admin" ? `
                        <button onclick="editCongViec('${item.id}','${safeText(item.tieuDe)}','${safeText(item.moTa)}','${safeText(item.trangThai)}','${item.han}','${item.nhanVienId || 0}')">Sửa</button>
                        <button class="danger" onclick="deleteCongViec(${item.id})">Xóa</button>
                    ` : ""}
                </div>
            `).join("");
        } catch (err) {
            congViecList.innerHTML = "Lỗi tải công việc";
            console.error(err);
        }
    }

    document.getElementById("searchCongViec")?.addEventListener("input", function () {
        const keyword = this.value.toLowerCase();
        document.querySelectorAll("#congViecList .item").forEach(item => item.style.display = item.textContent.toLowerCase().includes(keyword) ? "block" : "none");
    });


    addBtn?.addEventListener("click", async () => {
        if (role !== "admin") return;
        const tieuDe = document.getElementById("tieuDe").value.trim();
        const moTa = document.getElementById("moTa").value.trim();
        const trangThai = document.getElementById("trangThai").value;
        const han = document.getElementById("han").value;
        const nhanVienId = parseInt(document.getElementById("nhanVienId").value, 10);
        const message = document.getElementById("taskMessage");

        if (!tieuDe || !han || !nhanVienId) { message.textContent = "Vui lòng nhập đủ tiêu đề, hạn và chọn nhân viên"; return; }

        try {
            let response;
            if (editingCongViecId) {
                response = await fetch(`${API_BASE}/congviec/${editingCongViecId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tieuDe, moTa, trangThai, han, nhanVienId })
                });
            } else {
                response = await fetch(`${API_BASE}/congviec`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tieuDe, moTa, trangThai, han, nhanVienId })
                });
            }
            const data = await response.json();
            if (!response.ok) { message.textContent = data.message || "Lưu công việc thất bại"; return; }
            message.textContent = editingCongViecId ? "Cập nhật công việc thành công" : "Thêm công việc thành công";
            resetCongViecForm();
            loadCongViec();
            if (showAddBtn) showAddBtn.style.display = "inline-block";
        } catch (err) { message.textContent = "Lỗi kết nối server"; console.error(err); }
    });

    window.editCongViec = function (id, tieuDe, moTa, trangThai, han, nhanVienId) {
        if (role !== "admin") return;
        editingCongViecId = id;
        formCard.style.display = "block";
        document.getElementById("congViecFormTitle").textContent = `Đang sửa công việc ID ${id}`;
        document.getElementById("tieuDe").value = tieuDe;
        document.getElementById("moTa").value = moTa;
        document.getElementById("trangThai").value = trangThai;
        document.getElementById("han").value = han;
        loadNhanVienDropdown(nhanVienId);
        addBtn.textContent = "Cập nhật công việc";
        cancelBtn.style.display = "inline-block";
        formCard.scrollIntoView({ behavior: "smooth" });
    };

    window.deleteCongViec = async function (id) {
        if (role !== "admin") return;
        const ok = confirm(`Bạn có chắc muốn xóa công việc ID ${id}?`);
        if (!ok) return;
        try {
            const response = await fetch(`${API_BASE}/congviec/${id}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) { alert(data.message || "Xóa thất bại"); return; }
            alert("Xóa công việc thành công");
            loadCongViec();
        } catch (err) { alert("Lỗi kết nối server"); console.error(err); }
    };

    function resetCongViecForm() {
        editingCongViecId = null;
        if (formCard) formCard.style.display = "none";
        document.getElementById("tieuDe").value = "";
        document.getElementById("moTa").value = "";
        document.getElementById("trangThai").value = "Chưa làm";
        document.getElementById("han").value = "";
        document.getElementById("nhanVienId").value = "";
        addBtn.textContent = "Thêm công việc";
        if (showAddBtn) showAddBtn.style.display = "inline-block";
    }

    loadNhanVienDropdown();
    loadCongViec();
});
