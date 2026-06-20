const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const chatHint = document.getElementById("chatHint");
const logoutBtn = document.getElementById("logoutBtn");
const toggleSidebar = document.getElementById("toggleSidebar");
const sidebar = document.querySelector(".sidebar");

let isSending = false;
const chatStorageKey = `officeChatHistory:${user?.id || "guest"}`;
const welcomeMessage =
    "Xin chào. Tôi là trợ lý AI hỗ trợ quản lý công việc. Bạn có thể hỏi về nhân viên, công việc, tiến độ, hạn hoàn thành hoặc nhờ tôi tóm tắt tình hình hiện tại.";

if (!user) {
    window.location.href = "login.html";
}

if (user?.role !== "admin") {
    const navNhanVien = document.getElementById("navNhanVien");

    if (navNhanVien) {
        navNhanVien.style.display = "none";
    }
}

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

logoutBtn.addEventListener("click", async () => {
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

sendChatBtn.addEventListener("click", sendChat);
clearChatBtn.addEventListener("click", async () => {
    const ok = await showConfirmDialog({
        title: "Xóa hội thoại?",
        message: "Toàn bộ nội dung chat hiện tại sẽ được làm mới.",
        confirmText: "Xóa",
        cancelText: "Hủy",
        type: "danger"
    });

    if (ok) clearChat();
});

chatInput.addEventListener("input", updateInputHint);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
    }
});

document.querySelectorAll(".suggest-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        chatInput.value = btn.textContent.trim();
        updateInputHint();
        sendChat();
    });
});

toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});

loadChatHistory();
updateInputHint();

function appendMessage(role, text, shouldSave = true) {
    const messageEl = document.createElement("div");

    messageEl.className = `chat-message ${role}`;

    const title = role === "user" ? "Bạn" : "Trợ lý AI";
    const safeText = formatMessage(String(text || ""));

    messageEl.innerHTML = `
        <div class="chat-role">${title}</div>
        <div class="chat-text">${safeText}</div>
    `;

    chatBox.appendChild(messageEl);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (shouldSave && !messageEl.classList.contains("loading-message")) {
        saveChatMessage(role, text);
    }

    return messageEl;
}

function getChatHistory() {
    try {
        const data = JSON.parse(localStorage.getItem(chatStorageKey) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

function saveChatMessage(role, text) {
    const history = getChatHistory();

    history.push({
        role,
        text: String(text || ""),
        time: new Date().toISOString()
    });

    localStorage.setItem(chatStorageKey, JSON.stringify(history.slice(-60)));
}

function loadChatHistory() {
    const history = getChatHistory();

    chatBox.innerHTML = "";

    if (history.length === 0) {
        appendMessage("bot", welcomeMessage);
        return;
    }

    history.forEach(item => {
        appendMessage(item.role, item.text, false);
    });
}

function formatMessage(text) {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function updateInputHint() {
    const currentLength = chatInput.value.length;
    const maxLength = Number(chatInput.getAttribute("maxlength")) || 500;

    chatHint.textContent =
        `Enter để gửi, Shift + Enter để xuống dòng • ${currentLength}/${maxLength}`;
}

function setSendingState(active) {
    isSending = active;
    sendChatBtn.disabled = active;
    chatInput.disabled = active;
    sendChatBtn.textContent = active ? "Đang gửi..." : "Gửi";

    if (active) {
        chatHint.textContent = "AI đang đọc câu hỏi và tạo câu trả lời...";
    } else {
        updateInputHint();
        chatInput.focus();
    }
}

async function sendChat() {
    if (isSending) return;

    const message = chatInput.value.trim();

    if (!message) {
        chatInput.focus();
        return;
    }

    appendMessage("user", message);
    chatInput.value = "";
    setSendingState(true);

    const thinkingMessage = appendMessage("bot", "Đang trả lời...");
    thinkingMessage.classList.add("loading-message");

    try {
        const reply = await getChatReply(message);
        thinkingMessage.remove();
        appendMessage("bot", reply || "Không có phản hồi.");
    } catch (error) {
        thinkingMessage.remove();
        appendMessage("bot", "Không kết nối được server. Bạn kiểm tra backend đã chạy chưa nhé.");
        console.error("Chat error:", error);
    } finally {
        setSendingState(false);
    }
}

async function getChatReply(message) {
    try {
        const aiResponse = await fetch(`${API_BASE}/chat-ai`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        const aiData = await safeJson(aiResponse);

        if (aiResponse.ok) {
            return aiData.reply;
        }
    } catch (error) {
        console.warn("AI chat unavailable, using system fallback:", error);
    }

    const fallbackResponse = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
    });

    const fallbackData = await safeJson(fallbackResponse);

    if (!fallbackResponse.ok) {
        throw new Error(fallbackData.error || "Chat API error");
    }

    return `${fallbackData.reply || "Không có phản hồi."}\n\n(Đang dùng chế độ dữ liệu hệ thống vì AI tạm thời không khả dụng.)`;
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return {};
    }
}

function clearChat() {
    chatBox.innerHTML = "";
    localStorage.removeItem(chatStorageKey);

    appendMessage(
        "bot",
        "Hội thoại đã được xóa. Bạn có thể hỏi lại từ đầu, ví dụ: công việc nào đang quá hạn, nhân viên nào đang nhiều việc, hoặc tóm tắt tiến độ hôm nay."
    );
}
