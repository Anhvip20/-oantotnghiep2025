
document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:3000";

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const role = String(user.role).trim().toLowerCase();

    document.getElementById("userInfo").textContent =
        `${user.ten} (${user.role})`;

    const showAddBtn = document.getElementById("showAddCongViecBtn");
    const formCard = document.getElementById("congViecFormCard");
    const cancelBtn = document.getElementById("cancelCongViecBtn");
    const addBtn = document.getElementById("addCongViecBtn");
    const congViecList = document.getElementById("congViecList");
    const navNhanVien = document.getElementById("navNhanVien");
    const logoutBtn = document.getElementById("logoutBtn");
    const searchInput = document.getElementById("searchCongViec");
    const statusFilter = document.getElementById("statusFilter");
    const filterSummary = document.getElementById("filterSummary");

    let allCongViec = [];
    let allNhanVien = [];

    logoutBtn?.addEventListener("click", async () => {
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
            document.getElementById("congViecFormTitle").textContent = "Thêm công việc";
        });

        cancelBtn?.addEventListener("click", () => {
            formCard.style.display = "none";
            showAddBtn.style.display = "inline-block";
            resetCongViecForm();
        });
    }

    let editingCongViecId = null;

    function safeText(text) {
        return text
            ? String(text)
                .replace(/'/g, "\\'")
                .replace(/"/g, "&quot;")
            : "";
    }

    function formatDate(dateValue) {
        if (!dateValue) return "";

        const d = new Date(dateValue);

        if (Number.isNaN(d.getTime())) {
            return String(dateValue).split("T")[0];
        }

        return d.toISOString().split("T")[0];
    }

    function isOverdue(item) {
        if (!item.han || ["Hoàn thành", "Chờ duyệt"].includes(item.trangThai)) return false;

        return isPastDeadline(item);
    }

    function isPastDeadline(item) {
        if (!item.han) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const deadline = new Date(item.han);
        deadline.setHours(0, 0, 0, 0);

        return deadline < today;
    }

    function getStatusClass(item) {
        if (isOverdue(item)) return "status-overdue";
        if (item.trangThai === "Đang làm") return "status-doing";
        if (item.trangThai === "Chờ duyệt") return "status-review";
        if (item.trangThai === "Hoàn thành") return "status-done";
        return "status-todo";
    }

    function getStatusLabel(item) {
        return isOverdue(item) ? "Quá hạn" : item.trangThai;
    }

    function parseDateOnly(value) {
        if (!value) return null;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;

        date.setHours(0, 0, 0, 0);
        return date;
    }

    function isUnfinishedTask(item) {
        return item.trangThai !== "Hoàn thành";
    }

    function isRangeOverlap(startA, endA, startB, endB) {
        return startA <= endB && endA >= startB;
    }

    function getEmployeeWorkloadStatus(employeeId) {
        const ngayGiao = document.getElementById("ngayGiao")?.value;
        const han = document.getElementById("han")?.value;
        const newStart = parseDateOnly(ngayGiao);
        const newEnd = parseDateOnly(han);

        const employeeTasks = allCongViec.filter(item =>
            String(item.nhanVienId) === String(employeeId)
            && String(item.id) !== String(editingCongViecId || "")
            && isUnfinishedTask(item)
        );

        if (!newStart || !newEnd || newStart > newEnd) {
            return {
                type: "pending",
                label: "Chưa kiểm tra",
                detail: `${employeeTasks.length} việc chưa hoàn thành`,
                overlapCount: 0,
                activeCount: employeeTasks.length,
                score: 10 + employeeTasks.length
            };
        }

        const overlapTasks = employeeTasks.filter(item => {
            const taskStart = parseDateOnly(item.ngayGiao);
            const taskEnd = parseDateOnly(item.han);

            return taskStart
                && taskEnd
                && isRangeOverlap(newStart, newEnd, taskStart, taskEnd);
        });

        if (overlapTasks.length > 0) {
            return {
                type: "conflict",
                label: "Trùng lịch",
                detail: `${overlapTasks.length} việc trùng thời gian`,
                overlapCount: overlapTasks.length,
                activeCount: employeeTasks.length,
                score: 200 + overlapTasks.length + employeeTasks.length
            };
        }

        if (employeeTasks.length >= 3) {
            return {
                type: "overload",
                label: "Quá tải",
                detail: `${employeeTasks.length} việc chưa hoàn thành`,
                overlapCount: 0,
                activeCount: employeeTasks.length,
                score: 100 + employeeTasks.length
            };
        }

        return {
            type: "fit",
            label: "Phù hợp",
            detail: `${employeeTasks.length} việc chưa hoàn thành`,
            overlapCount: 0,
            activeCount: employeeTasks.length,
            score: employeeTasks.length
        };
    }

    function renderEmployeeAdvice(assessments) {
        let advice = document.getElementById("employeeAdvice");

        if (!advice) {
            const select = document.getElementById("nhanVienId");
            advice = document.createElement("div");
            advice.id = "employeeAdvice";
            advice.className = "employee-advice";
            select?.insertAdjacentElement("afterend", advice);
        }

        const ngayGiao = document.getElementById("ngayGiao")?.value;
        const han = document.getElementById("han")?.value;

        if (!ngayGiao || !han) {
            advice.innerHTML = "Chọn ngày giao và hạn để hệ thống kiểm tra nhân viên phù hợp.";
            advice.className = "employee-advice pending";
            return;
        }

        if (parseDateOnly(ngayGiao) > parseDateOnly(han)) {
            advice.innerHTML = "Ngày giao không được lớn hơn hạn hoàn thành.";
            advice.className = "employee-advice conflict";
            return;
        }

        const fitCount = assessments.filter(item => item.status.type === "fit").length;
        const conflictCount = assessments.filter(item => item.status.type === "conflict").length;
        const overloadCount = assessments.filter(item => item.status.type === "overload").length;

        advice.className = "employee-advice";
        advice.innerHTML = `
            <div class="advice-summary">
                <span class="advice-chip fit">${fitCount} phù hợp</span>
                <span class="advice-chip conflict">${conflictCount} trùng lịch</span>
                <span class="advice-chip overload">${overloadCount} quá tải</span>
            </div>
            <div class="advice-list">
                ${assessments.slice(0, 6).map(item => `
                    <div class="advice-item ${item.status.type}">
                        <strong>${safeText(item.employee.ten)}</strong>
                        <span>${item.status.label} - ${item.status.detail}</span>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function refreshEmployeeWorkloadOptions(selectedId = "") {
        const select = document.getElementById("nhanVienId");
        if (!select) return;

        const assessments = allNhanVien
            .map(employee => ({
                employee,
                status: getEmployeeWorkloadStatus(employee.id)
            }))
            .sort((a, b) =>
                a.status.score - b.status.score
                || String(a.employee.ten).localeCompare(String(b.employee.ten), "vi")
            );

        select.innerHTML =
            `<option value="">-- Chọn nhân viên --</option>` +
            assessments.map(item => `
                <option
                    value="${item.employee.id}"
                    data-workload="${item.status.type}"
                    ${String(item.employee.id) === String(selectedId) ? "selected" : ""}
                >
                    ${item.employee.ten} - ${item.status.label} (${item.status.detail})
                </option>
            `).join("");

        renderEmployeeAdvice(assessments);
    }

    async function confirmRiskyAssignmentIfNeeded(nhanVienId) {
        const status = getEmployeeWorkloadStatus(nhanVienId);

        if (!["conflict", "overload"].includes(status.type)) {
            return true;
        }

        const title = status.type === "conflict"
            ? "Nhân viên bị trùng lịch"
            : "Nhân viên đang quá tải";

        const message = status.type === "conflict"
            ? `Nhân viên này có ${status.overlapCount} công việc trùng thời gian với công việc mới. Bạn vẫn muốn giao?`
            : `Nhân viên này đang có ${status.activeCount} công việc chưa hoàn thành. Bạn vẫn muốn giao?`;

        return showConfirmDialog({
            title,
            message,
            confirmText: "Vẫn giao",
            cancelText: "Chọn lại",
            type: "danger"
        });
    }

    function renderNhanVienStatusAction(item) {
        if (role === "admin") return "";

        if (item.trangThai === "Hoàn thành") {
            return `
                <div class="status-complete">
                    Công việc đã hoàn thành.
                </div>
            `;
        }

        if (item.trangThai === "Chờ duyệt") {
            return `
                <div class="status-review-note">
                    Công việc đang chờ quản lý duyệt.
                </div>
            `;
        }

        if (isOverdue(item)) {
            return `
                <div class="status-lock">
                    Công việc đã quá hạn, bạn không thể cập nhật trạng thái.
                </div>
            `;
        }

        return `
            <div class="staff-status-update">
                <label for="status-${item.id}">Cập nhật trạng thái</label>
                <select id="status-${item.id}">
                    <option value="Chưa làm" ${item.trangThai === "Chưa làm" ? "selected" : ""}>Chưa làm</option>
                    <option value="Đang làm" ${item.trangThai === "Đang làm" ? "selected" : ""}>Đang làm</option>
                    <option value="Chờ duyệt" ${item.trangThai === "Chờ duyệt" ? "selected" : ""}>Gửi chờ duyệt</option>
                </select>
                <button class="secondary" onclick="updateTrangThaiCongViec(${item.id})">
                    Cập nhật
                </button>
            </div>
        `;
    }

    function renderAdminReviewAction(item) {
        if (role !== "admin" || item.trangThai !== "Chờ duyệt") return "";

        return `
            <div class="review-actions">
                <button class="success-btn" onclick="duyetCongViec(${item.id})">
                    Duyệt hoàn thành
                </button>
                <button class="warning-btn" onclick="yeuCauLamLai(${item.id})">
                    Yêu cầu làm lại
                </button>
            </div>
        `;
    }

    function renderHistoryPanel(item) {
        return `
            <div id="history-${item.id}" class="history-panel"></div>
        `;
    }

    function getFilteredCongViec() {
        const keyword = (searchInput?.value || "").trim().toLowerCase();
        const selectedStatus = statusFilter?.value || "all";

        return allCongViec.filter(item => {
            const text = [
                item.tieuDe,
                item.moTa,
                item.trangThai,
                item.tenNhanVien,
                formatDate(item.ngayGiao),
                formatDate(item.han)
            ].join(" ").toLowerCase();

            const matchKeyword = !keyword || text.includes(keyword);
            const matchStatus =
                selectedStatus === "all"
                || (selectedStatus === "overdue" && isOverdue(item))
                || item.trangThai === selectedStatus;

            return matchKeyword && matchStatus;
        });
    }

    function renderCongViec() {
        if (!congViecList) return;

        const data = getFilteredCongViec();

        if (filterSummary) {
            filterSummary.textContent =
                `Hiển thị ${data.length}/${allCongViec.length} công việc`;
        }

        if (!data.length) {
            congViecList.innerHTML = "Không có công việc phù hợp";
            return;
        }

        congViecList.innerHTML = data.map(item => `
            <div class="item">
                <strong>${safeText(item.tieuDe)}</strong><br>

                <div class="task-meta">
                    Mô tả: ${safeText(item.moTa)}<br>
                    Trạng thái:
                    <span class="status-badge ${getStatusClass(item)}">
                        ${safeText(getStatusLabel(item))}
                    </span><br>
                    Ngày giao: ${formatDate(item.ngayGiao) || "Chưa có"}<br>
                    Hạn: ${formatDate(item.han)}<br>
                    Nhân viên: ${safeText(item.tenNhanVien) || "Chưa gán"}
                </div>

                ${role === "admin" ? `
                    <button onclick="editCongViec(
                        '${item.id}',
                        '${safeText(item.tieuDe)}',
                        '${safeText(item.moTa)}',
                        '${safeText(item.trangThai)}',
                        '${formatDate(item.ngayGiao)}',
                        '${formatDate(item.han)}',
                        '${item.nhanVienId || 0}'
                    )">Sửa</button>

                    <button class="danger" onclick="deleteCongViec(${item.id})">
                        Xóa
                    </button>

                    ${renderAdminReviewAction(item)}
                ` : renderNhanVienStatusAction(item)}

                <button class="history-btn" onclick="toggleLichSuCongViec(${item.id})">
                    Lịch sử
                </button>

                ${renderHistoryPanel(item)}
            </div>
        `).join("");
    }

    async function loadNhanVienDropdown(selectedId = "") {
        try {
            const res = await fetch(`${API_BASE}/nhanvien`);
            const data = await res.json();

            allNhanVien = Array.isArray(data)
                ? data.filter(item => String(item.role).trim().toLowerCase() !== "admin")
                : [];

            refreshEmployeeWorkloadOptions(selectedId);

        } catch (err) {
            console.error("Lỗi loadNhanVienDropdown:", err);
        }
    }

    async function loadCongViec() {
        if (!congViecList) return;

        congViecList.innerHTML = "Đang tải...";

        try {
            const res = await fetch(`${API_BASE}/congviec`);
            let data = await res.json();

            if (role !== "admin") {
                data = data.filter(item =>
                    String(item.nhanVienId) === String(user.id)
                    || item.tenNhanVien === user.ten
                );
            }

            if (!Array.isArray(data) || !data.length) {
                allCongViec = [];
                renderCongViec();
                congViecList.innerHTML = "Không có dữ liệu công việc";
                return;
            }

            allCongViec = data;
            renderCongViec();
            refreshEmployeeWorkloadOptions(document.getElementById("nhanVienId")?.value || "");

        } catch (err) {
            congViecList.innerHTML = "Lỗi tải công việc";
            console.error(err);
        }
    }

    searchInput?.addEventListener("input", renderCongViec);
    statusFilter?.addEventListener("change", renderCongViec);

    document.getElementById("ngayGiao")?.addEventListener("change", () => {
        refreshEmployeeWorkloadOptions(document.getElementById("nhanVienId")?.value || "");
    });

    document.getElementById("han")?.addEventListener("change", () => {
        refreshEmployeeWorkloadOptions(document.getElementById("nhanVienId")?.value || "");
    });

    addBtn?.addEventListener("click", async () => {
        if (role !== "admin") return;

        const tieuDe = document.getElementById("tieuDe").value.trim();
        const moTa = document.getElementById("moTa").value.trim();
        const trangThai = document.getElementById("trangThai").value;
        const ngayGiao = document.getElementById("ngayGiao").value;
        const han = document.getElementById("han").value;
        const nhanVienId = parseInt(document.getElementById("nhanVienId").value, 10);
        const message = document.getElementById("taskMessage");

        if (!tieuDe || !ngayGiao || !han || !nhanVienId) {
            message.textContent = "Vui lòng nhập đủ tiêu đề, ngày giao, hạn và chọn nhân viên";
            return;
        }

        if (parseDateOnly(ngayGiao) > parseDateOnly(han)) {
            message.textContent = "Ngày giao không được lớn hơn hạn hoàn thành";
            return;
        }

        const canAssign = await confirmRiskyAssignmentIfNeeded(nhanVienId);
        if (!canAssign) return;

        try {
            let response;

            if (editingCongViecId) {
                response = await fetch(`${API_BASE}/congviec/${editingCongViecId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tieuDe,
                        moTa,
                        trangThai,
                        ngayGiao,
                        han,
                        nhanVienId,
                        nguoiThucHienId: user.id
                    })
                });
            } else {
                response = await fetch(`${API_BASE}/congviec`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tieuDe,
                        moTa,
                        trangThai,
                        ngayGiao,
                        han,
                        nhanVienId,
                        nguoiThucHienId: user.id
                    })
                });
            }

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message || "Lưu công việc thất bại";
                return;
            }

            const successMessage =
                editingCongViecId
                    ? "Cập nhật công việc thành công"
                    : "Thêm công việc thành công";

            resetCongViecForm();
            showToast(successMessage);
            loadCongViec();

            if (showAddBtn) showAddBtn.style.display = "inline-block";

        } catch (err) {
            message.textContent = "Lỗi kết nối server";
            console.error(err);
        }
    });

    window.editCongViec = function (id, tieuDe, moTa, trangThai, ngayGiao, han, nhanVienId) {
        if (role !== "admin") return;

        editingCongViecId = id;

        formCard.style.display = "block";

        if (showAddBtn) {
            showAddBtn.style.display = "none";
        }

        document.getElementById("congViecFormTitle").textContent =
            `Đang sửa công việc ID ${id}`;

        document.getElementById("tieuDe").value = tieuDe;
        document.getElementById("moTa").value = moTa;
        document.getElementById("trangThai").value = trangThai;
        document.getElementById("ngayGiao").value = ngayGiao;
        document.getElementById("han").value = han;

        loadNhanVienDropdown(nhanVienId);

        addBtn.textContent = "Cập nhật công việc";
        cancelBtn.style.display = "inline-block";

        formCard.scrollIntoView({ behavior: "smooth" });
    };

    window.deleteCongViec = async function (id) {
        if (role !== "admin") return;

        const ok = await showConfirmDialog({
            title: "Xóa công việc?",
            message: `Công việc ID ${id} sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`,
            confirmText: "Xóa",
            cancelText: "Hủy",
            type: "danger"
        });

        if (!ok) return;

        try {
            const response = await fetch(`${API_BASE}/congviec/${id}`, {
                method: "DELETE"
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Xóa thất bại");
                return;
            }

            showToast("Xóa công việc thành công");
            loadCongViec();

        } catch (err) {
            alert("Lỗi kết nối server");
            console.error(err);
        }
    };

    async function updateTrangThaiByAdmin(id, trangThaiMoi) {
        if (role !== "admin") return;

        const item = allCongViec.find(task => String(task.id) === String(id));
        if (!item) return;

        try {
            const response = await fetch(`${API_BASE}/congviec/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tieuDe: item.tieuDe,
                    moTa: item.moTa,
                    trangThai: trangThaiMoi,
                    ngayGiao: formatDate(item.ngayGiao),
                    han: formatDate(item.han),
                    nhanVienId: item.nhanVienId,
                    nguoiThucHienId: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Cập nhật trạng thái thất bại");
                return;
            }

            showToast(
                trangThaiMoi === "Hoàn thành"
                    ? "Đã duyệt hoàn thành công việc"
                    : "Đã yêu cầu nhân viên làm lại"
            );
            loadCongViec();
        } catch (err) {
            alert("Lỗi kết nối server");
            console.error(err);
        }
    }

    window.duyetCongViec = async function (id) {
        const ok = await showConfirmDialog({
            title: "Duyệt hoàn thành?",
            message: "Công việc sẽ được ghi nhận là đã hoàn thành sau khi duyệt.",
            confirmText: "Duyệt",
            cancelText: "Hủy",
            type: "default"
        });

        if (!ok) return;

        updateTrangThaiByAdmin(id, "Hoàn thành");
    };

    window.yeuCauLamLai = async function (id) {
        const ok = await showConfirmDialog({
            title: "Yêu cầu làm lại?",
            message: "Công việc sẽ quay về trạng thái Đang làm để nhân viên tiếp tục xử lý.",
            confirmText: "Yêu cầu làm lại",
            cancelText: "Hủy",
            type: "danger"
        });

        if (!ok) return;

        updateTrangThaiByAdmin(id, "Đang làm");
    };

    window.updateTrangThaiCongViec = async function (id) {
        if (role === "admin") return;

        const select = document.getElementById(`status-${id}`);
        const trangThai = select?.value;

        if (!trangThai) return;

        try {
            const response = await fetch(`${API_BASE}/congviec/${id}/trangthai`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trangThai,
                    nhanVienId: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Cập nhật trạng thái thất bại");
                return;
            }

            showToast("Cập nhật trạng thái thành công");
            loadCongViec();
        } catch (err) {
            alert("Lỗi kết nối server");
            console.error(err);
        }
    };

    window.toggleLichSuCongViec = async function (id) {
        const panel = document.getElementById(`history-${id}`);
        if (!panel) return;

        if (panel.classList.contains("open")) {
            panel.classList.remove("open");
            panel.innerHTML = "";
            return;
        }

        panel.classList.add("open");
        panel.innerHTML = "Đang tải lịch sử...";

        try {
            const response = await fetch(`${API_BASE}/congviec/${id}/lichsu`);
            const data = await response.json();

            if (!response.ok) {
                panel.innerHTML = data.message || "Không tải được lịch sử";
                return;
            }

            if (!Array.isArray(data) || !data.length) {
                panel.innerHTML = "Chưa có lịch sử thay đổi.";
                return;
            }

            panel.innerHTML = `
                <strong>Lịch sử thay đổi</strong>
                <ul>
                    ${data.map(item => `
                        <li>
                            <div class="history-action">${safeText(item.hanhDong)}</div>
                            <div>${safeText(item.noiDung)}</div>
                            <small>
                                ${item.tenNhanVien ? safeText(item.tenNhanVien) : "Hệ thống"}
                                - ${formatDate(item.thoiGian)}
                            </small>
                        </li>
                    `).join("")}
                </ul>
            `;
        } catch (err) {
            panel.innerHTML = "Lỗi kết nối server";
            console.error(err);
        }
    };

    function resetCongViecForm() {
        editingCongViecId = null;

        if (formCard) formCard.style.display = "none";

        document.getElementById("congViecFormTitle").textContent = "Thêm công việc";
        document.getElementById("tieuDe").value = "";
        document.getElementById("moTa").value = "";
        document.getElementById("trangThai").value = "Chưa làm";
        document.getElementById("ngayGiao").value = "";
        document.getElementById("han").value = "";
        document.getElementById("nhanVienId").value = "";

        addBtn.textContent = "Thêm công việc";

        if (showAddBtn) showAddBtn.style.display = "inline-block";
    }

    loadNhanVienDropdown();
    loadCongViec();
});

const toggleSidebar =
    document.getElementById("toggleSidebar");

const sidebar =
    document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {

    sidebar.classList.toggle("collapsed");

});
