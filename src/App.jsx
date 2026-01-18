import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Feed from "./pages/Feed.jsx";
import Upload from "./pages/Upload.jsx";
import User from "./pages/User.jsx";
import Search from "./pages/Search.jsx";
import Explore from "./pages/Explore.jsx";
import Notifications from "./pages/Notifications.jsx";
import Messages from "./pages/Messages.jsx";

export default function App() {
  const [route, setRoute] = useState("feed"); // feed | upload | login | register | user | search | explore | notifications | messages
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [recentPosts, setRecentPosts] = useState([]);
  const [profileUserId, setProfileUserId] = useState(null);
  const [chatUserId, setChatUserId] = useState(null);
  const [openPostId, setOpenPostId] = useState(null);
  const [theme, setTheme] = useState("light");
  const hasSupabase = !!supabase;

  const defaultAvatar = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

  useEffect(() => {
    const stored = localStorage.getItem("theme") || "light";
    setTheme(stored);
    document.documentElement.dataset.theme = stored;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
  }

  function parseImagePaths(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore
    }
    return [value];
  }

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
    if (isAuthed) return;
    if (route !== "feed") return;
    const timer = setTimeout(() => setRoute("login"), 3000);
    return () => clearTimeout(timer);
  }, [isAuthed, route]);

  useEffect(() => {
    if (!hasSupabase) return;

    const uid = session?.user?.id;
    if (!uid) {
      setDisplayName("");
      setPublicId("");
      setAvatarUrl("");
      setRecentPosts([]);
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
        const metaName = session?.user?.user_metadata?.display_name || "";
        const metaUsername = session?.user?.user_metadata?.username || "";
        setDisplayName(metaName);
        setPublicId(metaUsername);
        return;
      }
      const metaName = session?.user?.user_metadata?.display_name || "";
      const metaUsername = session?.user?.user_metadata?.username || "";
      const name = data?.display_name || metaName || "";
      const uname = data?.username || metaUsername || "";
      const avUrl = data?.avatar_url || "";
      setDisplayName(name);
      setPublicId(uname);
      setAvatarUrl(avUrl || defaultAvatar);

      const { data: posts, error: pe } = await supabase
        .from("posts")
        .select("id,image_path,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(12);
      if (pe) {
        console.error(pe);
        return;
      }
      const withUrls = (posts || []).map((p) => {
        const paths = parseImagePaths(p.image_path);
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(paths[0]);
        return { ...p, imageUrl: urlData.publicUrl };
      });
      setRecentPosts(withUrls);
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

  function openProfile(userId) {
    setProfileUserId(userId || null);
    setRoute("user");
  }

  function openChat(userId) {
    if (!userId) return;
    setChatUserId(userId);
    setRoute("messages");
  }

  function openPost(postId) {
    if (!postId) return;
    setOpenPostId(postId);
    setRoute("feed");
  }

  return (
    <>
      <div className="topbar">
        <div className="nav">
          <strong className="brand" style={{ cursor: "pointer" }} onClick={() => setRoute("feed")}>Instagram MVP</strong>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Đổi giao diện">
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 14.5A9 9 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3" />
                <path d="M12 19v3" />
                <path d="M4.2 4.2l2.1 2.1" />
                <path d="M17.7 17.7l2.1 2.1" />
                <path d="M2 12h3" />
                <path d="M19 12h3" />
                <path d="M4.2 19.8l2.1-2.1" />
                <path d="M17.7 6.3l2.1-2.1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="container">
        <div className={`app-layout ${isAuthed ? "" : "single"}`}>
          <div className="grid">
            {!isAuthed && route === "login" && <Login onAuthed={() => setRoute("feed")} onGoRegister={() => setRoute("register")} />}
            {!isAuthed && route === "register" && <Register onAuthed={() => setRoute("feed")} onGoLogin={() => setRoute("login")} />}

            {isAuthed && route === "upload" && <Upload onDone={() => setRoute("feed")} />}
            {isAuthed && route === "user" && <User userId={profileUserId} onOpenChat={openChat} />}
            {isAuthed && route === "feed" && (
              <Feed
                onOpenProfile={openProfile}
                openPostId={openPostId}
                onOpenPostHandled={() => setOpenPostId(null)}
              />
            )}
            {isAuthed && route === "search" && <Search onOpenProfile={openProfile} />}
            {isAuthed && route === "explore" && <Explore />}
            {isAuthed && route === "notifications" && (
              <Notifications onOpenProfile={openProfile} onOpenPost={openPost} />
            )}
            {isAuthed && route === "messages" && <Messages targetUserId={chatUserId} />}

            {!isAuthed && route === "feed" && (
              <div className="card auth-redirect">
                <div className="auth-redirect-title">Bạn chưa đăng nhập</div>
                <div className="muted">Đang chuyển hướng đến trang đăng nhập...</div>
                <div className="auth-redirect-progress" aria-hidden="true">
                  <span />
                </div>
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
              <div className="section-title">Bài viết mới</div>
              <div className="side-posts-grid">
                {recentPosts.map((p) => (
                  <div key={p.id} className="side-post">
                    <img src={p.imageUrl} alt="post" />
                  </div>
                ))}
              </div>

              <div className="spacer" />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Mở trang cá nhân</span>
                <button className="btn-text" onClick={() => openProfile(null)}>Xem</button>
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
          <button className={`nav-btn ${route === "search" ? "active" : ""}`} aria-label="Tìm kiếm" onClick={() => setRoute("search")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "explore" ? "active" : ""}`} aria-label="Khám phá" onClick={() => setRoute("explore")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3z" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "notifications" ? "active" : ""}`} aria-label="Thông báo" onClick={() => setRoute("notifications")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a5 5 0 0 1 5 5v3l2 3H5l2-3V8a5 5 0 0 1 5-5z" />
              <path d="M9 19a3 3 0 0 0 6 0" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "messages" ? "active" : ""}`} aria-label="Tin nhắn" onClick={() => setRoute("messages")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v10H7l-3 3V5z" />
            </svg>
          </button>
          <button className={`nav-btn ${route === "user" ? "active" : ""}`} onClick={() => openProfile(null)} aria-label="Hồ sơ">
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
