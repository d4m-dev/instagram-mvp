import React, { useState } from "react";
import { supabase } from "../supabase.js";
import "../auth.css";

export default function Login({ onAuthed, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onAuthed?.();
    } catch (e2) {
      setErr(e2?.message || "Đăng nhập thất bại");
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
            <p className="ig-title">Chào mừng trở lại. Đăng nhập để tiếp tục.</p>
            <form className="ig-form" onSubmit={submit}>
              <div className="ig-field">
                <label htmlFor="email">Email</label>
                <input id="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="ig-field">
                <label htmlFor="password">Mật khẩu</label>
                <input id="password" placeholder="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {err && <div className="ig-alert ig-alert-error">{err}</div>}
              <button className="ig-btn" disabled={loading}>{loading ? "..." : "Đăng nhập"}</button>
            </form>
            <div className="ig-divider"><span /><p>HOẶC</p><span /></div>
            <button className="ig-btn ig-btn-ghost" type="button">Đăng nhập bằng Google</button>
            <button className="ig-linkbtn" type="button">Quên mật khẩu?</button>
          </div>
          <div className="ig-card ig-card-mini">
            <span>Chưa có tài khoản? </span>
            <button className="ig-linkbtn" onClick={onGoRegister}>Đăng ký</button>
          </div>
        </div>
      </div>
    </div>
  );
}
