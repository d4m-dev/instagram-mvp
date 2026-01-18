import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import CropperModal from "../components/CropperModal.jsx";
import { Play, Pause, X } from "lucide-react";
import tracks from "../tracks.js";

export default function Upload({ onDone }) {
  const [previews, setPreviews] = useState([]);
  const [croppedBlobs, setCroppedBlobs] = useState([]);
  const [cropQueue, setCropQueue] = useState([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropFile, setCropFile] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [hidePicker, setHidePicker] = useState(false);
  const [cropAspect, setCropAspect] = useState(4 / 3);
  const [publishOpen, setPublishOpen] = useState(false);
  const [filter, setFilter] = useState("none");
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [musicMode, setMusicMode] = useState("lyrics");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const [previewingId, setPreviewingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showAllTracks, setShowAllTracks] = useState(false);
  const previewRef = React.useRef(null);
  const previewTimerRef = React.useRef(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const filterMap = {
    none: "none",
    warm: "contrast(1.05) saturate(1.2) sepia(0.2)",
    cool: "contrast(1.05) saturate(1.1) hue-rotate(190deg)",
    mono: "grayscale(1)",
    vintage: "sepia(0.4) contrast(1.05) saturate(0.9)"
  };

  const tracksList = React.useMemo(() => {
    return tracks
      .map((track, index) => ({
        ...track,
        id: track.path || track.instrumental || `${track.name}-${index}`
      }))
      .filter((track) => track.path || track.instrumental);
  }, []);

  const suggestions = React.useMemo(() => {
    const pool = [...tracksList];
    const out = [];
    while (pool.length && out.length < 3) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }, [tracksList, suggestionSeed]);

  const searchResults = React.useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    if (!q) return [];
    return tracksList.filter((track) => {
      const name = (track.name || "").toLowerCase();
      const artist = (track.artist || "").toLowerCase();
      return name.includes(q) || artist.includes(q);
    });
  }, [activeSearch, tracksList]);

  const selectedTrack = tracksList.find((t) => t.id === selectedTrackId) || null;
  const musicUrl = musicEnabled && selectedTrack
    ? (musicMode === "lyrics" ? (selectedTrack.path || selectedTrack.instrumental) : (selectedTrack.instrumental || selectedTrack.path))
    : null;

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewingId && selectedTrack && selectedTrack.id === previewingId) {
      const url = musicMode === "lyrics"
        ? (selectedTrack.path || selectedTrack.instrumental)
        : (selectedTrack.instrumental || selectedTrack.path);
      if (url && url !== previewUrl) {
        setPreviewUrl(url);
        if (previewRef.current) {
          const wasPlaying = !previewRef.current.paused;
          previewRef.current.src = url;
          previewRef.current.load();
          if (wasPlaying) previewRef.current.play().catch(() => {});
        }
      }
    }
  }, [musicMode]);

  function stopPreview() {
    setPreviewingId(null);
    setPreviewUrl("");
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
    }
  }

  function startPreview(track) {
    const url = musicMode === "lyrics"
      ? (track.path || track.instrumental)
      : (track.instrumental || track.path);
    if (!url) return;
    setPreviewingId(track.id);
    setPreviewUrl(url);
    if (previewRef.current) {
      const audio = previewRef.current;
      audio.pause();
      audio.currentTime = 0;
      audio.src = url;
      audio.load();
      audio.muted = false;
      const tryPlay = () => audio.play().catch(() => {});
      const p = tryPlay();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          audio.oncanplay = () => {
            audio.oncanplay = null;
            tryPlay();
          };
        });
      }
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      stopPreview();
    }, 15000);
  }

  function isTrackPlaying(track) {
    return previewingId === track.id;
  }

  function renderTrackGrid(list) {
    const gridItems = list.slice(0, 6);
    return (
      <div className="music-grid">
        {gridItems.map((track) => {
          const playing = isTrackPlaying(track);
          const isActive = selectedTrackId === track.id;
          return (
            <div
              key={track.id}
              className={`track-card ${isActive ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTrackId(track.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedTrackId(track.id);
              }}
            >
              <div className="track-play">
                <img
                  className="track-art"
                  src={track.artwork}
                  alt={track.name}
                />
              </div>
              <div className="track-info">
                <div className="track-title">
                  <span>{track.name}</span>
                </div>
                <div className="track-artist">{track.artist}</div>
              </div>
              <button
                type="button"
                className="track-action"
                onClick={() => {
                  e.stopPropagation();
                  setSelectedTrackId(track.id);
                  if (playing) {
                    stopPreview();
                  } else {
                    startPreview(track);
                  }
                }}
                aria-label={playing ? "Tạm dừng" : "Nghe thử"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTrackList(list) {
    return (
      <div className="music-grid">
        {list.map((track) => {
          const playing = isTrackPlaying(track);
          const isActive = selectedTrackId === track.id;
          return (
            <div
              key={track.id}
              className={`track-card ${isActive ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTrackId(track.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedTrackId(track.id);
              }}
            >
              <div className="track-play">
                <img className="track-art" src={track.artwork} alt={track.name} />
              </div>
              <div className="track-info">
                <div className="track-title">
                  <span>{track.name}</span>
                </div>
                <div className="track-artist">{track.artist}</div>
              </div>
              <button
                type="button"
                className="track-action"
                onClick={() => {
                  e.stopPropagation();
                  setSelectedTrackId(track.id);
                  if (playing) {
                    stopPreview();
                  } else {
                    startPreview(track);
                  }
                }}
                aria-label={playing ? "Tạm dừng" : "Nghe thử"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  async function applyFilterToBlob(blob, filterCss = "none") {
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.filter = filterCss;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const out = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.86);
    });
    if (!out) throw new Error("Blob empty");
    return out;
  }

  function startCrop(list) {
    if (!list.length) return;
    previews.forEach((url) => URL.revokeObjectURL(url));
    setErr("");
    setOk("");
    setCroppedBlobs([]);
    setPreviews([]);
    setCropQueue(list);
    setCropIndex(0);
    setCropFile(list[0]);
    setCropOpen(true);
    setHidePicker(true);
  }

  function handleCropCancel() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setCroppedBlobs([]);
    setPreviews([]);
    setCropQueue([]);
    setCropIndex(0);
    setCropFile(null);
    setCropOpen(false);
    setHidePicker(false);
  }

  function removePreviewAt(index) {
    setPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
    setCroppedBlobs((prev) => prev.filter((_, i) => i !== index));
    setCropQueue((prev) => prev.filter((_, i) => i !== index));
    setHidePicker(false);
  }

  function recropForStory() {
    if (!cropQueue.length) return;
    setCropAspect(9 / 16);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
    setCroppedBlobs([]);
    setCropIndex(0);
    setCropFile(cropQueue[0]);
    setCropOpen(true);
  }

  function handleCropConfirm(blob, preview) {
    setCroppedBlobs((prev) => [...prev, blob]);
    setPreviews((prev) => [...prev, preview]);
    const nextIndex = cropIndex + 1;
    if (nextIndex < cropQueue.length) {
      setCropIndex(nextIndex);
      setCropFile(cropQueue[nextIndex]);
    } else {
      setCropOpen(false);
      setCropFile(null);
    }
  }

  async function publishFeed() {
    setLoading(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const user = userData.user;
      if (!user) throw new Error("Bạn chưa đăng nhập");

      const filteredBlobs = await Promise.all(
        croppedBlobs.map((blob) => applyFilterToBlob(blob, filterMap[filter]))
      );

      const fileNames = await Promise.all(
        filteredBlobs.map(async (blob) => {
          const fileName = `${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase.storage.from("post-images").upload(fileName, blob, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/jpeg"
          });
          if (upErr) throw upErr;
          return fileName;
        })
      );

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        caption,
        location: location.trim() || null,
        image_path: JSON.stringify(fileNames),
        music_url: musicUrl
      });
      if (insErr) throw insErr;

      setOk("Đăng lên feed thành công!");
      setCaption("");
      setLocation("");
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
      setCroppedBlobs([]);
      setTimeout(() => onDone?.(), 600);
    } catch (e2) {
      setErr(e2?.message || "Đăng feed thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function publishStory() {
    if (croppedBlobs.length > 1) {
      setErr("Stories chỉ hỗ trợ 1 ảnh.");
      return;
    }
    if (Math.abs(cropAspect - 9 / 16) > 0.001) {
      setErr("Hãy chọn tỉ lệ 9:16 để đăng story.");
      return;
    }
    setLoading(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const filtered = await applyFilterToBlob(croppedBlobs[0], filterMap[filter]);

      const fileName = `${uid}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(fileName, filtered, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("stories").insert({
        user_id: uid,
        image_path: fileName,
        expires_at: expiresAt,
        music_url: musicUrl
      });
      if (error) throw error;

      setOk("Đăng story thành công!");
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
      setCroppedBlobs([]);
      setTimeout(() => onDone?.(), 600);
    } catch (e2) {
      setErr(e2?.message || "Đăng story thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!croppedBlobs.length) { setErr("Chọn ảnh trước."); return; }
    setPublishOpen(true);
  }

  return (
    <div className="card">
      <h2 className="page-title">Tạo bài viết</h2>
      <form className="grid" onSubmit={submit}>
        {!hidePicker && (
          <input
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const list = Array.from(e.target.files || []).slice(0, 7);
              if (list.length > 7) {
                setErr("Tối đa 7 ảnh mỗi bài viết.");
              }
              startCrop(list);
            }}
          />
        )}
        {previews.length > 0 && (
          <div className={`post-media-grid upload-grid count-${Math.min(previews.length, 5)}`}>
            {previews.slice(0, 5).map((url, idx) => (
              <div key={url} className="media-cell" style={{ position: "relative" }}>
                <button
                  className="icon-btn"
                  style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
                  onClick={() => removePreviewAt(idx)}
                  aria-label="Xóa ảnh"
                >
                  <X size={16} />
                </button>
                <img className="upload-preview-img" src={url} alt={`preview-${idx}`} style={{ filter: filterMap[filter] }} />
              </div>
            ))}
            {previews.length < 7 && (
              <label className="media-cell add-more" style={{ display: "grid", placeItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>+</div>
                  <div className="muted">Thêm ảnh</div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    if (!list.length) return;
                    const next = [...cropQueue, ...list].slice(0, 7);
                    if (next.length > 7) setErr("Tối đa 7 ảnh mỗi bài viết.");
                    setCropQueue(next);
                    setCropIndex(previews.length);
                    setCropFile(next[previews.length]);
                    setCropOpen(true);
                  }}
                />
              </label>
            )}
          </div>
        )}
        <div className="grid">
          <div className="muted">Nhạc</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            {!musicEnabled ? (
              <button type="button" className="btn2" onClick={() => setMusicEnabled(true)}>
                Thêm nhạc
              </button>
            ) : (
              <button
                type="button"
                className="btn2"
                onClick={() => {
                  setMusicEnabled(false);
                  setSelectedTrackId(null);
                  setActiveSearch("");
                  setSearchInput("");
                }}
              >
                Gỡ nhạc
              </button>
            )}
            {musicEnabled && (
              <span className="muted small">
                {selectedTrack ? `Đang chọn: ${selectedTrack.name}` : "Chưa chọn bài"}
              </span>
            )}
          </div>

          {musicEnabled && (
            <div className="grid">
              <div className="row" style={{ flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 220 }}
                  placeholder="Tìm bài hát hoặc nghệ sĩ"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="button" className="btn2 search-btn" onClick={() => setActiveSearch(searchInput)}>
                  Tìm
                </button>
              </div>

              {activeSearch && (
                <div className="grid">
                  <div className="muted">Kết quả</div>
                  {searchResults.length === 0 ? (
                    <div className="muted small">Không tìm thấy</div>
                  ) : (
                    renderTrackGrid(searchResults)
                  )}
                </div>
              )}

              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="muted">Gợi ý ngẫu nhiên</div>
                <div className="row">
                  <button type="button" className="btn2" onClick={() => setSuggestionSeed((s) => s + 1)}>
                    Đổi gợi ý
                  </button>
                  <button type="button" className="btn2" onClick={() => setShowAllTracks((s) => !s)}>
                    {showAllTracks ? "Thu gọn" : "Xem tất cả"}
                  </button>
                </div>
              </div>
              {showAllTracks ? renderTrackList(tracksList) : renderTrackGrid(suggestions)}

              {selectedTrack && (
                <div className="row">
                  <span className="muted">Bản nhạc</span>
                  <button type="button" className={`btn2 ${musicMode === "lyrics" ? "active" : ""}`} onClick={() => setMusicMode("lyrics")}>
                    Có lời
                  </button>
                  <button type="button" className={`btn2 ${musicMode === "instrumental" ? "active" : ""}`} onClick={() => setMusicMode("instrumental")}>
                    Không lời
                  </button>
                </div>
              )}
              <audio ref={previewRef} src={previewUrl || ""} preload="auto" crossOrigin="anonymous" />
            </div>
          )}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted">Ảnh sẽ tự động nén tối ưu để nhẹ nhưng vẫn rõ nét (tối đa 7 ảnh)</div>
        </div>
        <input
          className="input"
          placeholder="Địa điểm (tùy chọn)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <textarea className="textarea" placeholder="Chú thích..." value={caption} onChange={(e) => setCaption(e.target.value)} />
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
        {ok && <div style={{ color: "#7bffb0" }}>{ok}</div>}
        <button className="btn" disabled={loading}>{loading ? "..." : "Đăng"}</button>
      </form>
      <CropperModal
        open={cropOpen}
        file={cropFile}
        aspect={cropAspect}
        aspectOptions={[
          { label: "1:1", value: 1 },
          { label: "4:3", value: 4 / 3 },
          { label: "16:9", value: 16 / 9 },
          { label: "9:16", value: 9 / 16 }
        ]}
        onAspectChange={setCropAspect}
        outputWidth={1200}
        title={`Cắt ảnh (${cropIndex + 1}/${Math.max(1, cropQueue.length)})`}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
      {publishOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Đăng ở đâu?</div>
              <button className="icon-btn" onClick={() => setPublishOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid" style={{ width: "100%" }}>
                <button className="btn" onClick={async () => { setPublishOpen(false); await publishFeed(); }} disabled={loading}>
                  Đăng lên Feed
                </button>
                <button
                  className="btn2"
                  onClick={async () => {
                    setPublishOpen(false);
                    if (Math.abs(cropAspect - 9 / 16) > 0.001) {
                      recropForStory();
                      return;
                    }
                    await publishStory();
                  }}
                  disabled={loading}
                >
                  Đăng lên Stories (9:16)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
