import React, { useState } from "react";
import { supabase } from "../supabase.js";

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
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Đăng ký</h2>
      <form className="grid" onSubmit={submit}>
        <input className="input" placeholder="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" placeholder="Mã người dùng (vd: nguyenvana)" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Mật khẩu (>=6 ký tự)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input" placeholder="Nhập lại mật khẩu" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
        {ok && <div style={{ color: "#7bffb0" }}>{ok}</div>}
        <button className="btn" disabled={loading}>{loading ? "..." : "Tạo tài khoản"}</button>
      </form>
      <div className="spacer" />
      <button className="btn2" onClick={onGoLogin}>Đã có tài khoản? Đăng nhập</button>
    </div>
  );
}
