const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

const elements = {
    dashboardUserName: document.getElementById("dashboardUserName"),
    navNhanVien: document.getElementById("navNhanVien"),
    tongNhanVienCard: document.getElementById("tongNhanVienCard"),
    workloadCard: document.getElementById("workloadCard"),
    performanceCard: document.getElementById("performanceCard"),
    tongNhanVien: document.getElementById("tongNhanVien"),
    tongCongViec: document.getElementById("tongCongViec"),
    hoanThanh: document.getElementById("hoanThanh"),
    quaHan: document.getElementById("quaHan"),
    tiLeHoanThanh: document.getElementById("tiLeHoanThanh"),
    completionRate: document.getElementById("completionRate"),
    statusSummary: document.getElementById("statusSummary"),
    priorityAlerts: document.getElementById("priorityAlerts"),
    alertCount: document.getElementById("alertCount"),
    performanceList: document.getElementById("performanceList"),
    reportPeriod: document.getElementById("reportPeriod"),
    reportTotal: document.getElementById("reportTotal"),
    reportDone: document.getElementById("reportDone"),
    reportLate: document.getElementById("reportLate"),
    timeReportChart: document.getElementById("timeReportChart"),
    workloadList: document.getElementById("workloadList"),
    taskTitle: document.getElementById("taskTitle"),
    priorityTaskCount: document.getElementById("priorityTaskCount"),
    congViecCuaToi: document.getElementById("congViecCuaToi"),
    notificationList: document.getElementById("notificationList"),
    notificationCount: document.getElementById("notificationCount"),
    notificationSidebar: document.querySelector(".notification-sidebar"),
    notificationDropdown: document.getElementById("notificationDropdown"),
    closeNotificationBtn: document.getElementById("closeNotificationBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    toggleSidebar: document.getElementById("toggleSidebar"),
    sidebar: document.querySelector(".sidebar")
};

let dashboardTasks = [];
let dashboardEmployees = [];

elements.dashboardUserName.textContent = user?.ten || "người dùng";

if (user.role !== "admin") {
    if (elements.navNhanVien) {
        elements.navNhanVien.style.display = "none";
    }

    if (elements.tongNhanVienCard) {
        elements.tongNhanVienCard.style.display = "none";
    }

    if (elements.workloadCard) {
        elements.workloadCard.style.display = "none";
        elements.workloadCard.closest(".dashboard-grid")?.classList.add("single-column");
    }

    elements.taskTitle.textContent = "Việc cần ưu tiên của tôi";
}

elements.logoutBtn.addEventListener("click", async () => {
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

elements.toggleSidebar.addEventListener("click", () => {
    elements.sidebar.classList.toggle("collapsed");
});

elements.reportPeriod.addEventListener("change", () => {
    renderTimeReport(dashboardTasks, elements.reportPeriod.value);
});

elements.notificationSidebar.addEventListener("click", () => {
    elements.notificationDropdown.style.display = "block";
});

elements.closeNotificationBtn.addEventListener("click", () => {
    elements.notificationDropdown.style.display = "none";
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        elements.notificationDropdown.style.display = "none";
    }
});

elements.notificationDropdown.addEventListener("click", (e) => {
    if (e.target === elements.notificationDropdown) {
        elements.notificationDropdown.style.display = "none";
    }
});

elements.notificationList.addEventListener("click", (e) => {
    const btn = e.target.closest(".read-btn");

    if (!btn) return;

    markAsRead(btn.dataset.id);
});

loadDashboard();
loadThongBao();

async function loadDashboard() {
    try {
        const [employeeResponse, taskResponse] = await Promise.all([
            fetch(`${API_BASE}/nhanvien`),
            fetch(`${API_BASE}/congviec`)
        ]);

        const employees = await employeeResponse.json();
        const tasks = await taskResponse.json();

        if (!employeeResponse.ok || !taskResponse.ok) {
            throw new Error("Không tải được dữ liệu dashboard");
        }

        dashboardEmployees = Array.isArray(employees) ? employees : [];
        dashboardTasks = user.role === "admin"
            ? normalizeTasks(tasks)
            : normalizeTasks(tasks).filter(task => isMyTask(task));

        renderStats(dashboardEmployees, dashboardTasks);
        renderStatusSummary(dashboardTasks);
        renderPriorityAlerts(dashboardTasks);
        renderPriorityTasks(dashboardTasks);
        renderPerformance(dashboardEmployees, dashboardTasks);
        renderTimeReport(dashboardTasks, elements.reportPeriod.value);

        if (user.role === "admin") {
            renderWorkload(dashboardEmployees, dashboardTasks);
        }
    } catch (error) {
        console.error("Lỗi loadDashboard:", error);
        elements.priorityAlerts.innerHTML = "<p>Không tải được dữ liệu dashboard.</p>";
        elements.congViecCuaToi.innerHTML = "<p>Không tải được dữ liệu công việc.</p>";
    }
}

function normalizeTasks(tasks) {
    if (!Array.isArray(tasks)) return [];

    return tasks.map(task => ({
        ...task,
        trangThai: String(task.trangThai || "").trim()
    }));
}

function renderStats(employees, tasks) {
    const staffCount = employees.filter(item => item.role === "staff").length;
    const completedCount = tasks.filter(isCompleted).length;
    const overdueCount = tasks.filter(isOverdue).length;
    const completionPercent = getPercent(completedCount, tasks.length);

    elements.tongNhanVien.textContent = staffCount;
    elements.tongCongViec.textContent = tasks.length;
    elements.hoanThanh.textContent = completedCount;
    elements.quaHan.textContent = overdueCount;
    elements.tiLeHoanThanh.textContent = `${completionPercent}%`;
}

function renderStatusSummary(tasks) {
    const total = tasks.length;
    const counts = {
        "Chưa làm": tasks.filter(item => item.trangThai === "Chưa làm").length,
        "Đang làm": tasks.filter(item => item.trangThai === "Đang làm").length,
        "Chờ duyệt": tasks.filter(item => item.trangThai === "Chờ duyệt").length,
        "Hoàn thành": tasks.filter(isCompleted).length,
        "Quá hạn": tasks.filter(isOverdue).length
    };

    const completionPercent = getPercent(counts["Hoàn thành"], total);

    elements.completionRate.textContent = `${completionPercent}% hoàn thành`;

    const rows = [
        { label: "Chưa làm", count: counts["Chưa làm"], className: "todo" },
        { label: "Đang làm", count: counts["Đang làm"], className: "doing" },
        { label: "Chờ duyệt", count: counts["Chờ duyệt"], className: "review" },
        { label: "Hoàn thành", count: counts["Hoàn thành"], className: "done" },
        { label: "Quá hạn", count: counts["Quá hạn"], className: "late" }
    ];

    elements.statusSummary.innerHTML = rows.map(row => {
        const percent = getPercent(row.count, total);

        return `
            <div class="status-row">
                <div class="status-meta">
                    <span>${row.label}</span>
                    <strong>${row.count}</strong>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${row.className}" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

function renderPriorityAlerts(tasks) {
    const alerts = [];
    const overdueTasks = tasks.filter(isOverdue);
    const upcomingTasks = tasks
        .filter(task => !isCompleted(task) && !isOverdue(task))
        .filter(task => {
            const days = getDaysUntilDue(task.han);
            return days >= 0 && days <= 3;
        });

    if (overdueTasks.length > 0) {
        alerts.push({
            type: "danger",
            title: `${overdueTasks.length} công việc quá hạn`,
            text: "Cần kiểm tra tiến độ và xử lý trước."
        });
    }

    if (upcomingTasks.length > 0) {
        alerts.push({
            type: "warning",
            title: `${upcomingTasks.length} công việc sắp đến hạn`,
            text: "Nên ưu tiên theo dõi trong 3 ngày tới."
        });
    }

    if (alerts.length === 0) {
        elements.alertCount.textContent = "0 mục";
        elements.priorityAlerts.innerHTML = "<p>Không có cảnh báo quan trọng.</p>";
        return;
    }

    elements.alertCount.textContent = `${alerts.length} mục`;
    elements.priorityAlerts.innerHTML = alerts.map(alert => `
        <div class="item alert-item ${alert.type}">
            <strong>${alert.title}</strong>
            <span>${alert.text}</span>
        </div>
    `).join("");
}

function renderPerformance(employees, tasks) {
    const staff = user.role === "admin"
        ? employees.filter(item => item.role === "staff")
        : [{ id: user.id, ten: user.ten, email: user.email, role: user.role }];

    const rows = staff.map(employee => {
        const assignedTasks = tasks.filter(task =>
            Number(task.nhanVienId) === Number(employee.id)
            || task.tenNhanVien === employee.ten
        );
        const completedTasks = assignedTasks.filter(isCompleted);
        const overdueTasks = assignedTasks.filter(isOverdue);
        const performance = getPercent(completedTasks.length, assignedTasks.length);

        return {
            ...employee,
            total: assignedTasks.length,
            completed: completedTasks.length,
            overdue: overdueTasks.length,
            performance
        };
    }).sort((a, b) => b.performance - a.performance || b.completed - a.completed);

    if (rows.length === 0) {
        elements.performanceList.innerHTML = "<p>Chưa có dữ liệu hiệu suất.</p>";
        return;
    }

    elements.performanceList.innerHTML = rows.slice(0, 6).map(item => `
        <div class="performance-item">
            <div class="performance-heading">
                <div>
                    <strong>${escapeHtml(item.ten || "Nhân viên")}</strong>
                    <span>${item.completed}/${item.total} việc hoàn thành · ${item.overdue} quá hạn</span>
                </div>
                <strong>${item.performance}%</strong>
            </div>
            <div class="progress-track">
                <div class="progress-fill performance" style="width: ${item.performance}%"></div>
            </div>
        </div>
    `).join("");
}

function renderTimeReport(tasks, periodType) {
    const groups = buildReportGroups(periodType);
    const now = new Date();

    tasks.forEach(task => {
        const reportDate = getReportDate(task);

        if (!reportDate) return;

        const key = getReportKey(reportDate, periodType);
        const group = groups.find(item => item.key === key);

        if (!group) return;

        group.total += 1;

        if (isCompleted(task)) {
            group.done += 1;
        }

        if (isOverdue(task)) {
            group.late += 1;
        }
    });

    const currentKey = getReportKey(now, periodType);
    const currentGroup = groups.find(item => item.key === currentKey) || {
        total: 0,
        done: 0,
        late: 0
    };

    elements.reportTotal.textContent = currentGroup.total;
    elements.reportDone.textContent = currentGroup.done;
    elements.reportLate.textContent = currentGroup.late;

    const maxTotal = Math.max(...groups.map(item => item.total), 1);

    elements.timeReportChart.innerHTML = groups.map(group => {
        const percent = getPercent(group.total, maxTotal);

        return `
            <div class="time-chart-row">
                <span class="time-label">${group.label}</span>
                <div class="time-bar-wrap">
                    <div class="time-bar" style="width: ${percent}%"></div>
                </div>
                <span class="time-count">${group.total} việc</span>
                <span class="time-chip done">${group.done} HT</span>
                <span class="time-chip late">${group.late} QH</span>
            </div>
        `;
    }).join("");
}

function renderPriorityTasks(tasks) {
    const priorityTasks = [...tasks]
        .filter(task => !isCompleted(task))
        .sort((a, b) => {
            const aOverdue = isOverdue(a) ? -1 : 0;
            const bOverdue = isOverdue(b) ? -1 : 0;

            if (aOverdue !== bOverdue) return aOverdue - bOverdue;

            return getTimeValue(a.han) - getTimeValue(b.han);
        })
        .slice(0, 5);

    elements.priorityTaskCount.textContent = `${priorityTasks.length} việc`;

    if (priorityTasks.length === 0) {
        elements.congViecCuaToi.innerHTML = "<p>Không có công việc cần ưu tiên.</p>";
        return;
    }

    elements.congViecCuaToi.innerHTML = priorityTasks.map(task => `
        <div class="item task-item">
            <div>
                <strong>${escapeHtml(task.tieuDe)}</strong>
                <span>${escapeHtml(task.tenNhanVien || "Chưa giao nhân viên")}</span>
            </div>
            <div>
                <span class="status-pill ${getStatusClass(task)}">${getTaskStatusText(task)}</span>
                <small>Hạn: ${formatDate(task.han)}</small>
            </div>
        </div>
    `).join("");
}

function renderWorkload(employees, tasks) {
    const staff = employees.filter(item => item.role === "staff");
    const workload = staff.map(employee => {
        const employeeTasks = tasks.filter(task => Number(task.nhanVienId) === Number(employee.id));
        const activeTasks = employeeTasks.filter(task => !isCompleted(task));
        const overdueTasks = employeeTasks.filter(isOverdue);

        return {
            ...employee,
            activeCount: activeTasks.length,
            overdueCount: overdueTasks.length
        };
    })
        .sort((a, b) => b.activeCount - a.activeCount || b.overdueCount - a.overdueCount)
        .slice(0, 5);

    if (workload.length === 0) {
        elements.workloadList.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
        return;
    }

    const maxActive = Math.max(...workload.map(item => item.activeCount), 1);

    elements.workloadList.innerHTML = workload.map(item => {
        const percent = getPercent(item.activeCount, maxActive);
        const label = item.overdueCount > 0
            ? `${item.overdueCount} quá hạn`
            : `${item.activeCount} việc đang xử lý`;

        return `
            <div class="workload-item">
                <div class="workload-heading">
                    <strong>${escapeHtml(item.ten)}</strong>
                    <span>${label}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill workload" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

async function loadThongBao() {
    try {
        const response = await fetch(`${API_BASE}/thongbao/${user.id}`);
        const data = await response.json();

        if (!Array.isArray(data)) return;

        const unread = data.filter(tb => !tb.daDoc);
        const unreadCount = unread.length;
        elements.notificationCount.textContent = unreadCount;
        elements.notificationCount.classList.toggle("empty", unreadCount === 0);

        if (data.length === 0) {
            elements.notificationList.innerHTML = "<p>Không có thông báo</p>";
            return;
        }

        elements.notificationList.innerHTML = data.map(tb => `
            <div class="notification-item ${tb.daDoc ? "" : "unread"}">
                <div class="notification-text">${escapeHtml(tb.noiDung)}</div>
                <span class="notification-time">${new Date(tb.thoiGian).toLocaleString("vi-VN")}</span>
                ${!tb.daDoc ? `
                    <button class="read-btn" data-id="${tb.id}">Đánh dấu đã đọc</button>
                ` : `
                    <span class="notification-time">Đã đọc</span>
                `}
            </div>
        `).join("");

    } catch (error) {
        console.error("Lỗi loadThongBao:", error);
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

function buildReportGroups(periodType) {
    const now = new Date();
    const currentYear = now.getFullYear();

    if (periodType === "quarter") {
        return [1, 2, 3, 4].map(quarter => ({
            key: `${currentYear}-Q${quarter}`,
            label: `Quý ${quarter}`,
            total: 0,
            done: 0,
            late: 0
        }));
    }

    if (periodType === "year") {
        return Array.from({ length: 5 }, (_, index) => {
            const year = currentYear - 4 + index;

            return {
                key: String(year),
                label: String(year),
                total: 0,
                done: 0,
                late: 0
            };
        });
    }

    return Array.from({ length: 12 }, (_, index) => ({
        key: `${currentYear}-${String(index + 1).padStart(2, "0")}`,
        label: `T${index + 1}`,
        total: 0,
        done: 0,
        late: 0
    }));
}

function getReportKey(date, periodType) {
    const year = date.getFullYear();

    if (periodType === "quarter") {
        return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    }

    if (periodType === "year") {
        return String(year);
    }

    return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getReportDate(task) {
    const source = task.ngayGiao || task.han;

    if (!source) return null;

    const date = new Date(source);

    return isNaN(date.getTime()) ? null : date;
}

function isMyTask(task) {
    return Number(task.nhanVienId) === Number(user.id) || task.tenNhanVien === user.ten;
}

function isCompleted(task) {
    return task.trangThai === "Hoàn thành";
}

function isOverdue(task) {
    if (!task.han || isCompleted(task)) return false;

    return getTimeValue(task.han) < getTodayStart().getTime();
}

function getDaysUntilDue(dateValue) {
    if (!dateValue) return Number.POSITIVE_INFINITY;

    const due = new Date(dateValue);

    if (isNaN(due.getTime())) return Number.POSITIVE_INFINITY;

    const msPerDay = 24 * 60 * 60 * 1000;

    return Math.ceil((startOfDay(due).getTime() - getTodayStart().getTime()) / msPerDay);
}

function getTodayStart() {
    return startOfDay(new Date());
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getTimeValue(dateValue) {
    if (!dateValue) return Number.MAX_SAFE_INTEGER;

    const date = new Date(dateValue);

    return isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function getTaskStatusText(task) {
    return isOverdue(task) ? "Quá hạn" : task.trangThai;
}

function getStatusClass(task) {
    if (isOverdue(task)) return "late";

    if (task.trangThai === "Hoàn thành") return "done";
    if (task.trangThai === "Chờ duyệt") return "review";
    if (task.trangThai === "Đang làm") return "doing";

    return "todo";
}

function getPercent(value, total) {
    if (!total) return 0;

    return Math.round((value / total) * 100);
}

function formatDate(dateValue) {
    if (!dateValue) return "Chưa có";

    const d = new Date(dateValue);

    if (isNaN(d.getTime())) {
        return String(dateValue).split("T")[0];
    }

    return d.toISOString().split("T")[0];
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
