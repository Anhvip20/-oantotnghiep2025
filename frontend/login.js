const API_BASE = "http://localhost:3000";

const passwordInput = document.getElementById("matkhau");
const toggleBtn = document.getElementById("togglePassword");

toggleBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password"
        ? "text"
        : "password";

    passwordInput.setAttribute("type", type);
    toggleBtn.textContent = type === "password" ? "Hiện" : "Ẩn";
});

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

document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim().toLowerCase();
    const matkhau = passwordInput.value.trim();
    const message = document.getElementById("message");

    if (!email || !matkhau) {
        message.textContent = "Vui lòng nhập email và mật khẩu";
        return;
    }

    if (!isValidEmail(email)) {
        message.textContent = "Email không đúng định dạng";
        return;
    }

    message.textContent = "Đang đăng nhập...";

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, matkhau })
        });

        if (!response.ok) {
            let data;

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            message.textContent = data.message || "Đăng nhập thất bại";
            return;
        }

        const data = await response.json();

        if (!data.user) {
            message.textContent =
                "Đăng nhập thất bại: không nhận được thông tin user";
            return;
        }

        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Lỗi kết nối server:", error);
        message.textContent = "Lỗi kết nối server. Vui lòng thử lại.";
    }
});
