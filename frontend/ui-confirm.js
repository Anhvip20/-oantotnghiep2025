(function () {
    let activeDialog = null;

    function ensureStyles() {
        if (document.getElementById("uiConfirmStyles")) return;

        const style = document.createElement("style");
        style.id = "uiConfirmStyles";
        style.textContent = `
            .ui-confirm-overlay {
                position: fixed;
                inset: 0;
                z-index: 5000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(15, 23, 42, 0.42);
                backdrop-filter: blur(3px);
            }

            .ui-confirm-dialog {
                width: min(440px, 100%);
                border-radius: 16px;
                background: #ffffff;
                border: 1px solid rgba(226, 232, 240, 0.95);
                box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
                overflow: hidden;
                transform: translateY(4px);
                animation: uiConfirmIn 0.18s ease forwards;
            }

            .ui-confirm-body {
                padding: 24px 24px 18px;
            }

            .ui-confirm-icon {
                width: 46px;
                height: 46px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 14px;
                font-size: 22px;
                background: #eef2ff;
                color: #5b4be7;
            }

            .ui-confirm-icon.danger {
                background: #fee2e2;
                color: #dc2626;
            }

            .ui-confirm-title {
                margin: 0;
                color: #111827;
                font-size: 20px;
                line-height: 1.3;
            }

            .ui-confirm-message {
                margin: 8px 0 0;
                color: #64748b;
                font-size: 14px;
                line-height: 1.55;
            }

            .ui-confirm-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 16px 24px 22px;
                background: #fbfcff;
                border-top: 1px solid #e2e8f0;
            }

            .ui-confirm-actions button {
                min-width: 92px;
                padding: 10px 16px;
                border-radius: 10px;
                border: 0;
                font-family: inherit;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
            }

            .ui-confirm-actions button:hover {
                transform: translateY(-1px);
                opacity: 0.94;
            }

            .ui-confirm-cancel {
                background: #eef2ff;
                color: #475569;
            }

            .ui-confirm-ok {
                background: #5b4be7;
                color: #ffffff;
                box-shadow: 0 8px 18px rgba(91, 75, 231, 0.2);
            }

            .ui-confirm-ok.danger {
                background: #ef4444;
                box-shadow: 0 8px 18px rgba(239, 68, 68, 0.2);
            }

            @keyframes uiConfirmIn {
                from {
                    opacity: 0;
                    transform: translateY(12px) scale(0.98);
                }

                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;

        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.showConfirmDialog = function ({
        title = "Xác nhận thao tác",
        message = "Bạn có chắc muốn tiếp tục không?",
        confirmText = "Xác nhận",
        cancelText = "Hủy",
        type = "default"
    } = {}) {
        ensureStyles();

        if (activeDialog) {
            activeDialog.remove();
            activeDialog = null;
        }

        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "ui-confirm-overlay";

            overlay.innerHTML = `
                <div class="ui-confirm-dialog" role="dialog" aria-modal="true">
                    <div class="ui-confirm-body">
                        <div class="ui-confirm-icon ${type === "danger" ? "danger" : ""}">
                            ${type === "danger" ? "!" : "?"}
                        </div>
                        <h3 class="ui-confirm-title">${escapeHtml(title)}</h3>
                        <p class="ui-confirm-message">${escapeHtml(message)}</p>
                    </div>
                    <div class="ui-confirm-actions">
                        <button type="button" class="ui-confirm-cancel">${escapeHtml(cancelText)}</button>
                        <button type="button" class="ui-confirm-ok ${type === "danger" ? "danger" : ""}">
                            ${escapeHtml(confirmText)}
                        </button>
                    </div>
                </div>
            `;

            const close = (result) => {
                overlay.remove();
                activeDialog = null;
                resolve(result);
            };

            overlay.querySelector(".ui-confirm-cancel").addEventListener("click", () => close(false));
            overlay.querySelector(".ui-confirm-ok").addEventListener("click", () => close(true));

            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) close(false);
            });

            document.addEventListener("keydown", function onKeydown(event) {
                if (event.key !== "Escape") return;
                document.removeEventListener("keydown", onKeydown);
                close(false);
            });

            document.body.appendChild(overlay);
            activeDialog = overlay;
            overlay.querySelector(".ui-confirm-ok").focus();
        });
    };

    window.showToast = function (message, type = "success") {
        ensureStyles();

        let wrap = document.getElementById("uiToastWrap");

        if (!wrap) {
            wrap = document.createElement("div");
            wrap.id = "uiToastWrap";
            wrap.style.cssText = `
                position: fixed;
                top: 22px;
                right: 22px;
                z-index: 6000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: min(360px, calc(100vw - 44px));
            `;
            document.body.appendChild(wrap);
        }

        const toast = document.createElement("div");
        const isError = type === "error";
        toast.style.cssText = `
            padding: 13px 15px;
            border-radius: 12px;
            background: ${isError ? "#fee2e2" : "#dcfce7"};
            color: ${isError ? "#b91c1c" : "#15803d"};
            border: 1px solid ${isError ? "#fecaca" : "#bbf7d0"};
            box-shadow: 0 16px 34px rgba(15, 23, 42, 0.14);
            font-weight: 700;
            line-height: 1.45;
        `;
        toast.textContent = message;
        wrap.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 2600);
    };
}());
