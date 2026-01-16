import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import PostCard from "../components/PostCard.jsx";

async function getPublicUrl(path) {
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
}

export default function Feed() {
  const [items, setItems] = useState([]); // merged posts
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || null));
  }, []);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data: posts, error: e1 } = await supabase
        .from("posts")
        .select("id,user_id,caption,image_path,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (e1) throw e1;
      const postIds = (posts || []).map((p) => p.id);

      // likes for these posts
      const { data: likes, error: e2 } = await supabase
        .from("likes")
        .select("post_id,user_id")
        .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]);
      if (e2) throw e2;

      // comments (latest 6 per post shown in UI - we fetch latest 60 and filter)
      const { data: comments, error: e3 } = await supabase
        .from("comments")
        .select("id,post_id,user_id,text,created_at")
        .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false })
        .limit(300);
      if (e3) throw e3;

      const likeByPost = new Map();
      for (const l of likes || []) {
        const arr = likeByPost.get(l.post_id) || [];
        arr.push(l.user_id);
        likeByPost.set(l.post_id, arr);
      }

      const commentsByPost = new Map();
      for (const c of comments || []) {
        const arr = commentsByPost.get(c.post_id) || [];
        if (arr.length < 6) arr.push(c);
        commentsByPost.set(c.post_id, arr);
      }

      const merged = await Promise.all(
        (posts || []).map(async (p) => {
          const imageUrl = await getPublicUrl(p.image_path);
          const likeUserIds = likeByPost.get(p.id) || [];
          return {
            ...p,
            imageUrl,
            likesCount: likeUserIds.length,
            hasLiked: uid ? likeUserIds.includes(uid) : false,
            comments: commentsByPost.get(p.id) || []
          };
        })
      );

      setItems(merged);
    } catch (e) {
      setErr(e?.message || "Load feed failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  const empty = useMemo(() => !loading && !err && items.length === 0, [loading, err, items]);

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Feed</h2>
        <button className="btn2" onClick={load} disabled={loading}>{loading ? "..." : "Refresh"}</button>
      </div>

      {err && <div className="card" style={{ borderColor: "#ff7b7b" }}>{err}</div>}
      {empty && <div className="card">Chua co bai nao.</div>}

      {items.map((p) => (
        <PostCard key={p.id} post={p} onChanged={load} />
      ))}
    </div>
  );
}
