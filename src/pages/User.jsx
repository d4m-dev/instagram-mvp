import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

export default function User() {
  const [displayName, setDisplayName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const { data: userData, error: ue } = await supabase.auth.getUser();
        if (ue) throw ue;
        const uid = userData.user?.id;
        if (!uid) throw new Error("Bạn chưa đăng nhập");

        const { data, error } = await supabase
          .from("profiles")
          .select("display_name,username")
          .eq("user_id", uid)
          .maybeSingle();
        if (error) throw error;

        setDisplayName(data?.display_name || "");
        setPublicId(data?.username || "");
      } catch (e) {
        setErr(e?.message || "Không tải được hồ sơ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setErr("");
    setOk("");
    const name = displayName.trim();
    const username = publicId.trim();

    if (!name) {
      setErr("Tên hiển thị không được để trống");
      return;
    }
    if (!username) {
      setErr("Mã người dùng không được để trống");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setErr("Mã người dùng chỉ gồm chữ, số, . _ - và 3-20 ký tự");
      return;
    }

    setSaving(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase.from("profiles").upsert({
        user_id: uid,
        display_name: name,
        username,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setOk("Đã lưu thay đổi");
    } catch (e) {
      setErr(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Hồ sơ</h2>
      {loading ? (
        <div className="muted">Đang tải...</div>
      ) : (
        <div className="grid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>Tên hiển thị</div>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nhập tên hiển thị" />
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>Mã người dùng (public id)</div>
            <input className="input" value={publicId} onChange={(e) => setPublicId(e.target.value)} placeholder="vd: nguyenvana" />
          </div>
          {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
          {ok && <div style={{ color: "#7bffb0" }}>{ok}</div>}
          <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "Lưu"}</button>
          <div className="muted" style={{ fontSize: 12 }}>
            Lưu ý: Không thể đổi ID hệ thống (auth UID). Chỉ đổi tên hiển thị và mã người dùng công khai.
          </div>
        </div>
      )}
    </div>
  );
}
