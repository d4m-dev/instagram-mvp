import React, { useMemo, useState } from "react";
import { supabase } from "../supabase.js";

function shortId(id) {
  if (!id) return "";
  return id.slice(0, 6);
}

export default function PostCard({ post, onChanged }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const createdLabel = useMemo(() => {
    try { return new Date(post.created_at).toLocaleString(); } catch { return ""; }
  }, [post.created_at]);

  async function toggleLike() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      if (post.hasLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: uid });
        if (error) throw error;
      }

      await onChanged?.();
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
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { error } = await supabase.from("comments").insert({
        post_id: post.id,
        user_id: uid,
        text: comment.trim()
      });
      if (error) throw error;

      setComment("");
      await onChanged?.();
    } catch (e2) {
      console.error(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>user-{shortId(post.user_id)}</strong>
          <div className="muted small">{createdLabel}</div>
        </div>
        <button className="btn2" onClick={toggleLike} disabled={busy}>
          {post.hasLiked ? "💙" : "🤍"} Like ({post.likesCount})
        </button>
      </div>

      <div className="spacer" />
      <img className="post-img" src={post.imageUrl} alt="post" />

      <div className="spacer" />
      {post.caption && (
        <div className="small"><span className="muted">user-{shortId(post.user_id)}</span> {post.caption}</div>
      )}

      <div className="spacer" />
      <div className="muted">Comments</div>
      <div className="spacer" />

      <form className="row" onSubmit={addComment}>
        <input
          className="input"
          placeholder="Comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button className="btn" disabled={busy}>Send</button>
      </form>

      <div className="spacer" />
      <div className="grid">
        {(post.comments || []).map((c) => (
          <div key={c.id} className="small">
            <strong>user-{shortId(c.user_id)}</strong> <span className="muted">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
