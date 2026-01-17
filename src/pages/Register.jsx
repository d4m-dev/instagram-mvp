import React, { useState } from "react";
import { supabase } from "../supabase.js";
import "../auth.css";

export default function Register({ onAuthed, onGoLogin }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    const name = fullName.trim();
    const uname = username.trim();
    const mail = email.trim();

    if (!name) {
      setErr("Vui lòng nhập họ và tên");
      return;
    }
    if (!uname) {
      setErr("Vui lòng nhập mã người dùng");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(uname)) {
      setErr("Mã người dùng chỉ gồm chữ, số, . _ - và 3-20 ký tự");
      return;
    }
    if (!mail) {
      setErr("Vui lòng nhập email");
      return;
    }
    if (password.length < 6) {
      setErr("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Mật khẩu nhập lại không khớp");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: mail, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        const { error: pe } = await supabase.from("profiles").upsert({
          user_id: uid,
          display_name: name,
          username: uname,
          updated_at: new Date().toISOString()
        });
        if (pe) throw pe;
        onAuthed?.();
      } else {
        setOk("Vui lòng kiểm tra email để xác thực tài khoản");
      }
    } catch (e2) {
      setErr(e2?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ig-page">
      <div className="ig-shell">
        <div className="ig-left">
          <div className="ig-phone ig-float">
            <div className="ig-phone-notch" />
            <div className="ig-storybar">
              <div className="ig-story" />
              <div className="ig-story" />
              <div className="ig-story" />
              <div className="ig-story" />
            </div>
            <div className="ig-feed">
              <div className="ig-post">
                <div className="ig-post-head">
                  <div className="ig-avatar" />
                  <div className="ig-lines">
                    <div className="ig-line w1" />
                    <div className="ig-line w2" />
                  </div>
                </div>
                <div className="ig-post-media" />
                <div className="ig-post-actions">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ig-right">
          <div className="ig-card ig-card-hero">
            <div className="ig-logo"><span>Instagram</span></div>
            <p className="ig-title">Tạo tài khoản mới trong vài bước.</p>
            <form className="ig-form" onSubmit={submit}>
              <div className="ig-field">
                <label htmlFor="fullName">Họ và tên</label>
                <input id="fullName" placeholder="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="ig-field">
                <label htmlFor="username">Mã người dùng</label>
                <input id="username" placeholder="Mã người dùng (vd: nguyenvana)" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="ig-field">
                <label htmlFor="email">Email</label>
                <input id="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="ig-field">
                <label htmlFor="password">Mật khẩu</label>
                <input id="password" placeholder="Mật khẩu (>=6 ký tự)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="ig-field">
                <label htmlFor="confirmPassword">Nhập lại mật khẩu</label>
                <input id="confirmPassword" placeholder="Nhập lại mật khẩu" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              {err && <div className="ig-alert ig-alert-error">{err}</div>}
              {ok && <div className="ig-alert ig-alert-ok">{ok}</div>}
              <button className="ig-btn" disabled={loading}>{loading ? "..." : "Tạo tài khoản"}</button>
            </form>
          </div>
          <div className="ig-card ig-card-mini">
            <span>Đã có tài khoản? </span>
            <button className="ig-linkbtn" onClick={onGoLogin}>Đăng nhập</button>
          </div>
        </div>
      </div>
    </div>
  );
}
