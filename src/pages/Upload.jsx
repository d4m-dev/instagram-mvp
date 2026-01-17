import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

export default function Upload({ onDone }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [processedBlob, setProcessedBlob] = useState(null);
  const [quality, setQuality] = useState(0.8);
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let revokedUrl = null;
    if (!file) {
      setPreviewUrl("");
      setProcessedBlob(null);
      return;
    }

    (async () => {
      try {
        const { blob, preview } = await processImage(file, quality);
        setProcessedBlob(blob);
        setPreviewUrl(preview);
        revokedUrl = preview;
      } catch (e) {
        console.error(e);
        setErr("Không thể xử lý ảnh");
      }
    })();

    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [file, quality]);

  async function processImage(inputFile, q) {
    const imgUrl = URL.createObjectURL(inputFile);
    const img = await loadImage(imgUrl);
    URL.revokeObjectURL(imgUrl);

    const targetAspect = 4 / 3;
    const srcAspect = img.width / img.height;

    let sx = 0;
    let sy = 0;
    let sWidth = img.width;
    let sHeight = img.height;

    if (srcAspect > targetAspect) {
      sWidth = Math.round(img.height * targetAspect);
      sx = Math.round((img.width - sWidth) / 2);
    } else if (srcAspect < targetAspect) {
      sHeight = Math.round(img.width / targetAspect);
      sy = Math.round((img.height - sHeight) / 2);
    }

    const maxWidth = 1200;
    const targetWidth = Math.min(maxWidth, sWidth);
    const targetHeight = Math.round(targetWidth / targetAspect);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", q);
    });

    if (!blob) throw new Error("Blob empty");
    const preview = URL.createObjectURL(blob);
    return { blob, preview };
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!file) { setErr("Chọn ảnh trước."); return; }
    if (!processedBlob) { setErr("Ảnh chưa xử lý xong."); return; }
    setLoading(true);

    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const user = userData.user;
      if (!user) throw new Error("Bạn chưa đăng nhập");

      const fileName = `${crypto.randomUUID()}.jpg`;

      const { error: upErr } = await supabase.storage.from("post-images").upload(fileName, processedBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg"
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        caption,
        image_path: fileName
      });
      if (insErr) throw insErr;

      setOk("Tải lên thành công!");
      setCaption("");
      setFile(null);
      setPreviewUrl("");
      setProcessedBlob(null);
      setTimeout(() => onDone?.(), 600);
    } catch (e2) {
      setErr(e2?.message || "Tải lên thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Tạo bài viết</h2>
      <form className="grid" onSubmit={submit}>
        <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {previewUrl && (
          <img className="post-img" src={previewUrl} alt="preview" />
        )}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted">Ảnh sẽ được cắt 4:3 và nén</div>
          <div className="row">
            <span className="muted">Chất lượng</span>
            <input
              className="input"
              style={{ width: 120 }}
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </div>
        </div>
        <textarea className="textarea" placeholder="Chú thích..." value={caption} onChange={(e) => setCaption(e.target.value)} />
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
        {ok && <div style={{ color: "#7bffb0" }}>{ok}</div>}
        <button className="btn" disabled={loading}>{loading ? "..." : "Đăng"}</button>
      </form>
    </div>
  );
}
