import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

if (typeof window !== "undefined") {
  window.__APP_BOOTSTRAPPED__ = true;
}

function formatError(err) {
  if (!err) return "";
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function renderFatal(message, err) {
  const root = document.getElementById("root");
  if (!root) return;
  const detail = formatError(err);
  root.innerHTML = `
    <div style="max-width: 820px; margin: 0 auto; padding: 32px 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; box-shadow: 0 6px 20px rgba(0,0,0,.06);">
        <strong>Ứng dụng gặp lỗi khi tải.</strong>
        <div style="height: 10px;"></div>
        <div style="color: #6b7280; white-space: pre-wrap;">${message}${detail ? `\n${detail}` : ""}</div>
        <div style="height: 10px;"></div>
        <div style="color: #374151;">Hãy mở Console để xem lỗi chi tiết. Nếu chạy trên GitHub Pages, kiểm tra lại secrets <strong>VITE_SUPABASE_URL</strong> và <strong>VITE_SUPABASE_ANON_KEY</strong>.</div>
      </div>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  renderFatal("Đã xảy ra lỗi JavaScript.", event?.error || event?.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatal("Đã xảy ra lỗi Promise chưa được xử lý.", event?.reason);
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("React render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container" style={{ paddingTop: 32 }}>
          <div className="card">
            <strong>Ứng dụng gặp lỗi khi render.</strong>
            <div className="spacer" />
            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
              {formatError(this.state.error)}
            </div>
            <div className="spacer" />
            <div>
              Mở Console để xem lỗi chi tiết. Nếu chạy trên GitHub Pages, hãy kiểm tra secrets
              {" "}
              <strong>VITE_SUPABASE_URL</strong> và <strong>VITE_SUPABASE_ANON_KEY</strong>.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);