import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Feed from "./pages/Feed.jsx";
import Upload from "./pages/Upload.jsx";
import User from "./pages/User.jsx";

export default function App() {
  const [route, setRoute] = useState("feed"); // feed | upload | login | register | user
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const hasSupabase = !!supabase;

  const defaultAvatar = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

  useEffect(() => {
    if (!hasSupabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [hasSupabase]);

  const userEmail = useMemo(() => session?.user?.email || null, [session]);
  const isAuthed = !!session?.user;

  useEffect(() => {
    if (!hasSupabase) return;

    const uid = session?.user?.id;
    if (!uid) {
      setDisplayName("");
      setPublicId("");
      setAvatarUrl("");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,username,avatar_url")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      const name = data?.display_name || "";
      const uname = data?.username || "";
      const avUrl = data?.avatar_url || "";
      setDisplayName(name);
      setPublicId(uname);
      setAvatarUrl(avUrl || defaultAvatar);
    })();
  }, [hasSupabase, session]);

  if (!hasSupabase) {
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <div className="card">
          <strong>Thiếu cấu hình Supabase.</strong>
          <div className="spacer" />
          <div>
            Cần đặt biến môi trường <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> trên GitHub Pages.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="nav">
          <strong className="brand" style={{ cursor: "pointer" }} onClick={() => setRoute("feed")}>Instagram MVP</strong>
        </div>
      </div>

      <div className="container">
        <div className={`app-layout ${isAuthed ? "" : "single"}`}>
          <div className="grid">
            {!isAuthed && route === "login" && <Login onAuthed={() => setRoute("feed")} onGoRegister={() => setRoute("register")} />}
            {!isAuthed && route === "register" && <Register onAuthed={() => setRoute("feed")} onGoLogin={() => setRoute("login")} />}

            {isAuthed && route === "upload" && <Upload onDone={() => setRoute("feed")} />}
            {isAuthed && route === "user" && <User />}
            {isAuthed && route === "feed" && <Feed />}

            {!isAuthed && route === "feed" && (
              <div className="card">
                <div>Bạn chưa đăng nhập.</div>
                <div className="spacer" />
                <button className="btn" onClick={() => setRoute("login")}>Đi tới đăng nhập</button>
              </div>
            )}
          </div>

          {isAuthed && (
            <aside className="card side-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{displayName || userEmail || "Tài khoản"}</div>
                  <div className="muted">{publicId ? `@${publicId}` : "Chưa đặt mã người dùng"}</div>
                </div>
                <div className="avatar">
                  <img className="avatar-img" src={avatarUrl || defaultAvatar} alt="avatar" />
                </div>
              </div>

              <div className="spacer" />
              <div className="section-title">Trang cá nhân</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {displayName || userEmail || "Tài khoản"}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {publicId ? `@${publicId}` : "Chưa đặt mã người dùng"}
              </div>

              <div className="spacer" />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Mở trang cá nhân</span>
                <button className="btn-text" onClick={() => setRoute("user")}>Xem</button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {isAuthed && (
        <nav className="bottom-nav" aria-label="Điều hướng chính">
          <button className={`nav-btn ${route === "feed" ? "active" : ""}`} onClick={() => setRoute("feed")} aria-label="Trang chủ">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v10h14V10" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "upload" ? "active" : ""}`} onClick={() => setRoute("upload")} aria-label="Tải lên">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
          <button className="nav-btn" aria-label="Tìm kiếm">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "user" ? "active" : ""}`} onClick={() => setRoute("user")} aria-label="Hồ sơ">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.8-3.6 5-6 8-6s6.2 2.4 8 6" />
            </svg>
          </button>
        </nav>
      )}
    </>
  );
}
