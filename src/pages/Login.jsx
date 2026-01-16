import React, { useState } from "react";
import { supabase } from "../supabase.js";

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
      setErr(e2?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Login</h2>
      <form className="grid" onSubmit={submit}>
        <input className="input" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
        <button className="btn" disabled={loading}>{loading ? "..." : "Login"}</button>
      </form>
      <div className="spacer" />
      <button className="btn2" onClick={onGoRegister}>Chua co tai khoan? Register</button>
    </div>
  );
}
