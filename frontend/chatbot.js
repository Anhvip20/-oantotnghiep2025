const API_BASE = "http://localhost:3000";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

if (user.role !== "admin") {
    const navNhanVien = document.getElementById("navNhanVien");

    if (navNhanVien) {
        navNhanVien.style.display = "none";
    }
}

document.getElementById("userInfo").textContent =
    `${user?.ten || "Không có tên"} (${user?.role || ""})`;

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "login.html";
});

document.getElementById("sendChatBtn").addEventListener("click", sendChat);
document.getElementById("clearChatBtn").addEventListener("click", clearChat);

document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
    }
});

document.querySelectorAll(".suggest-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.getElementById("chatInput").value =
            btn.textContent.trim();

        sendChat();
    });
});

appendMessage(
    "bot",
    "Xin chào. Tôi là chatbot hỗ trợ công việc. Bạn có thể hỏi về nhân viên, công việc hoặc yêu cầu tóm tắt tình hình hiện tại."
);

function appendMessage(role, text) {
    const chatBox = document.getElementById("chatBox");
    const messageEl = document.createElement("div");

    messageEl.className = `chat-message ${role}`;

    const title = role === "user" ? "Bạn" : "Chatbot";
    const safeText = formatBotText(String(text || ""));

    messageEl.innerHTML = `
        <div class="chat-role">${title}</div>
        <div class="chat-text">${safeText}</div>
    `;

    chatBox.appendChild(messageEl);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatBotText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
}

async function sendChat() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();

    if (!message) return;

    appendMessage("user", message);
    input.value = "";

    try {
        let data;
        let response;

        response = await fetch(`${API_BASE}/chat-ai`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        data = await response.json();

        if (!response.ok) {
            response = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            });

            data = await response.json();

            const fallbackReply =
                (data.reply || "Không có phản hồi.") +
                "<br><br><em>(Đang dùng chế độ dữ liệu hệ thống vì AI tạm thời không khả dụng.)</em>";

            appendMessage("bot", fallbackReply);
            return;
        }

        appendMessage("bot", data.reply || "Không có phản hồi.");

    } catch (error) {
        try {
            const fallbackResponse = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            });

            const fallbackData = await fallbackResponse.json();

            const fallbackReply =
                (fallbackData.reply || "Không có phản hồi.") +
                "<br><br><em>(Đang dùng chế độ dữ liệu hệ thống vì AI bị lỗi kết nối.)</em>";

            appendMessage("bot", fallbackReply);

        } catch (fallbackError) {
            appendMessage("bot", "Không kết nối được server.");

            console.error("Chat error:", error);
            console.error("Fallback error:", fallbackError);
        }
    }
}

function clearChat() {
    const chatBox = document.getElementById("chatBox");

    chatBox.innerHTML = "";

    appendMessage(
        "bot",
        "Hội thoại đã được xóa. Bạn có thể hỏi lại từ đầu."
    );
}

const toggleSidebar =
    document.getElementById("toggleSidebar");

const sidebar =
    document.querySelector(".sidebar");

toggleSidebar.addEventListener("click", () => {

    sidebar.classList.toggle("collapsed");

});