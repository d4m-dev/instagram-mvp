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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const userEmail = useMemo(() => session?.user?.email || null, [session]);
  const isAuthed = !!session?.user;

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setDisplayName("");
      setPublicId("");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,username")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      const name = data?.display_name || "";
      const uname = data?.username || "";
      setDisplayName(name);
      setPublicId(uname);
    })();
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
    setRoute("login");
  }

  const topbarLabel = publicId ? `@${publicId}` : (displayName || userEmail || "");

  return (
    <>
      <div className="topbar">
        <div className="nav">
          <strong style={{ cursor: "pointer" }} onClick={() => setRoute("feed")}>Instagram MVP</strong>

          <div className="row">
            {isAuthed ? (
              <>
                <span className="muted">{topbarLabel}</span>
                <button className="btn2" onClick={() => setRoute("user")}>Hồ sơ</button>
                <button className="btn2" onClick={() => setRoute("upload")}>Tải lên</button>
                <button className="btn2" onClick={logout}>Đăng xuất</button>
              </>
            ) : (
              <>
                <button className="btn2" onClick={() => setRoute("login")}>Đăng nhập</button>
                <button className="btn2" onClick={() => setRoute("register")}>Đăng ký</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container">
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
    </>
  );
}
