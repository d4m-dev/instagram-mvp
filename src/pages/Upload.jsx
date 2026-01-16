import React, { useState } from "react";
import { supabase } from "../supabase.js";

export default function Upload({ onDone }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!file) { setErr("Chon anh truoc."); return; }
    setLoading(true);

    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("post-images").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        caption,
        image_path: fileName
      });
      if (insErr) throw insErr;

      setOk("Upload thanh cong!");
      setCaption("");
      setFile(null);
      setTimeout(() => onDone?.(), 600);
    } catch (e2) {
      setErr(e2?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Create post</h2>
      <form className="grid" onSubmit={submit}>
        <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <textarea className="textarea" placeholder="Caption..." value={caption} onChange={(e) => setCaption(e.target.value)} />
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
        {ok && <div style={{ color: "#7bffb0" }}>{ok}</div>}
        <button className="btn" disabled={loading}>{loading ? "..." : "Post"}</button>
      </form>
    </div>
  );
}
