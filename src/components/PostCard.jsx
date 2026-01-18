import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { getTrackLabel, getTrackName } from "../tracks.js";
import { Volume2, VolumeX } from "lucide-react";

const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

function shortId(id) {
  if (!id) return "";
  return id.slice(0, 6);
}

export default function PostCard({ post, onChanged, nameById, uid, onOpenProfile, autoOpen, onAutoOpenHandled }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState("");
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef(null);

  function displayNameFor(userId) {
    const info = nameById?.get?.(userId);
    if (info?.username) return `@${info.username}`;
    if (info?.display_name) return info.display_name;
    return `user-${shortId(userId)}`;
  }

  function avatarFor(userId) {
    const info = nameById?.get?.(userId);
    return info?.avatar_url || DEFAULT_AVATAR_URL;
  }

  function openProfile(userId) {
    onOpenProfile?.(userId);
  }

  const createdLabel = useMemo(() => {
    try { return new Date(post.created_at).toLocaleString(); } catch { return ""; }
  }, [post.created_at]);

  const isOwner = uid && post.user_id === uid;

  const imageUrls = post.imageUrls && post.imageUrls.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);

  useEffect(() => {
    setIsMuted(true);
    if (audioRef.current) {
      audioRef.current.muted = true;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [post.music_url]);

  function openImage(url) {
    setActiveImageUrl(url || "");
    setIsImageOpen(true);
  }

  useEffect(() => {
    if (autoOpen && imageUrls.length) {
      openImage(imageUrls[0]);
      onAutoOpenHandled?.();
    }
  }, [autoOpen, imageUrls]);

  function renderMedia(className) {
    const media = imageUrls.length <= 1 ? (
      <img className={`post-img clickable ${className}`} src={imageUrls[0]} alt="post" onClick={() => openImage(imageUrls[0])} />
    ) : (
      <div className={`post-media-grid ${className} count-${Math.min(imageUrls.length, 5)}`}>
        {imageUrls.slice(0, 5).map((url, idx) => (
          <button key={`${url}-${idx}`} className="media-cell" onClick={() => openImage(url)} aria-label="Xem ảnh">
            <img src={url} alt={`post-${idx}`} />
          </button>
        ))}
      </div>
    );
    if (imageUrls.length <= 1) {
      return (
        <div className="post-media-wrap">
          {media}
          {post.music_url && (
            <>
              <button
                type="button"
                className="mute-btn"
                onClick={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  if (audioRef.current) {
                    audioRef.current.muted = next;
                    if (!next) audioRef.current.play().catch(() => {});
                  }
                }}
                aria-label={isMuted ? "Bật nhạc" : "Tắt nhạc"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <audio ref={audioRef} src={post.music_url} preload="auto" autoPlay muted playsInline />
            </>
          )}
        </div>
      );
    }
    return (
      <div className="post-media-wrap">
        {media}
        {post.music_url && (
          <>
            <button
              type="button"
              className="mute-btn"
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (audioRef.current) {
                  audioRef.current.muted = next;
                  if (!next) audioRef.current.play().catch(() => {});
                }
              }}
              aria-label={isMuted ? "Bật nhạc" : "Tắt nhạc"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <audio ref={audioRef} src={post.music_url} preload="auto" autoPlay muted playsInline />
          </>
        )}
      </div>
    );
  }


  async function toggleLike() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");

      if (post.hasLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: currentId });
        if (error) throw error;

        try {
          if (post.user_id && post.user_id !== currentId) {
            await supabase.from("notifications").insert({
              user_id: post.user_id,
              actor_id: currentId,
              type: "like",
              post_id: post.id
            });
          }
        } catch {
          // ignore notification errors
        }
      }

      await onChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBookmark() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");

      if (post.hasBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ post_id: post.id, user_id: currentId });
        if (error) throw error;
      }

      await onChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function hidePost() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase
        .from("hidden_posts")
        .insert({ user_id: currentId, post_id: post.id });
      if (error) throw error;

      await onChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function reportPost() {
    const reason = window.prompt("Lý do báo cáo?") || "";
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase
        .from("reports")
        .insert({ reporter_id: currentId, post_id: post.id, reason: reason.trim() });
      if (error) throw error;
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase.from("comments").insert({
        post_id: post.id,
        user_id: currentId,
        text: comment.trim()
      });
      if (error) throw error;

      try {
        if (post.user_id && post.user_id !== currentId) {
          await supabase.from("notifications").insert({
            user_id: post.user_id,
            actor_id: currentId,
            type: "comment",
            post_id: post.id
          });
        }
      } catch {
        // ignore notification errors
      }

      setComment("");
      await onChanged?.();
    } catch (e2) {
      console.error(e2);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!window.confirm("Xóa bài viết này?")) return;
    setActionErr("");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (!currentId) throw new Error("Bạn chưa đăng nhập");
      if (currentId !== post.user_id) throw new Error("Bạn không có quyền xóa bài này");

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", currentId);
      if (error) throw error;

      try {
        await supabase.storage.from("post-images").remove([post.image_path]);
      } catch {
        // ignore storage errors
      }

      await onChanged?.();
    } catch (e) {
      setActionErr(e?.message || "Xóa bài viết thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card post-card">
      <div className="post-header">
        <div className="post-header-left">
          <button className="avatar-btn" onClick={() => openProfile(post.user_id)} aria-label="Xem hồ sơ">
            <div className="avatar">
              <img className="avatar-img" src={avatarFor(post.user_id)} alt="avatar" />
            </div>
          </button>
          <div>
            <button className="link-btn" onClick={() => openProfile(post.user_id)}>
              <strong>{displayNameFor(post.user_id)}</strong>
            </button>
            <div className="muted small">{createdLabel}</div>
            {post.location && <div className="muted small">📍 {post.location}</div>}
          </div>
        </div>
        <span className="pill">⋯</span>
      </div>

      {renderMedia("")}

      <div className="post-actions">
        <div className="post-actions-bar">
          <button className={`icon-pill ${post.hasLiked ? "active" : ""}`} onClick={toggleLike} disabled={busy} aria-label="Thích">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s-7-4.35-9.33-8.1C.42 9.54 2.28 5.5 6 5.5c2.01 0 3.35 1.03 4 2 0.65-0.97 1.99-2 4-2 3.72 0 5.58 4.04 3.33 7.4C19 16.65 12 21 12 21z" />
            </svg>
            <span>{post.likesCount}</span>
          </button>
          <button className={`icon-pill ${post.hasBookmarked ? "active" : ""}`} onClick={toggleBookmark} disabled={busy} aria-label="Lưu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h12v16l-6-4-6 4V4z" />
            </svg>
            <span>Lưu</span>
          </button>
          <div className="icon-pill muted">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-4.22-7.58" />
              <path d="M21 12v7l-4-2" />
            </svg>
            <span>{(post.comments || []).length}</span>
          </div>
        </div>
        {actionErr && <div className="muted small" style={{ color: "#ff7b7b" }}>{actionErr}</div>}
      </div>

      <div className="card-pad">
        {post.caption && (
          <div className="small">
            <button className="link-btn muted" onClick={() => openProfile(post.user_id)}>
              {displayNameFor(post.user_id)}
            </button>
            {" "}{post.caption}
          </div>
        )}

        <div className="spacer" />
        <div className="muted">Bình luận</div>
        <div className="spacer" />

        <form className="row" onSubmit={addComment}>
          <input
            className="input"
            placeholder="Viết bình luận..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="btn" disabled={busy}>Gửi</button>
        </form>

        <div className="spacer" />
        <div className="grid">
          {(post.comments || []).map((c) => (
            <div key={c.id} className="comment-item">
              <button className="avatar-btn" onClick={() => openProfile(c.user_id)} aria-label="Xem hồ sơ">
                <div className="comment-avatar">
                  <img className="avatar-img" src={avatarFor(c.user_id)} alt="avatar" />
                </div>
              </button>
              <div className="small">
                <button className="link-btn" onClick={() => openProfile(c.user_id)}>
                  <strong>{displayNameFor(c.user_id)}</strong>
                </button>
                <span className="muted"> {c.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {isImageOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-popup">
            <button className="media-close" onClick={() => setIsImageOpen(false)} aria-label="Đóng">✕</button>
            <img className="media-image" src={activeImageUrl || imageUrls[0]} alt="post" />
            {post.music_url && (
              <div className="media-caption">
                <div className="muted small">{getTrackName(post.music_url)}</div>
              </div>
            )}
            {post.music_url && (
              <button
                type="button"
                className="mute-btn"
                onClick={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  if (audioRef.current) {
                    audioRef.current.muted = next;
                    if (!next) audioRef.current.play().catch(() => {});
                  }
                }}
                aria-label={isMuted ? "Bật nhạc" : "Tắt nhạc"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
