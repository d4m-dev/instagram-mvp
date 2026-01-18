import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../supabase.js";

export default function Explore() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activePost, setActivePost] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;

        let hiddenIds = new Set();
        if (uid) {
          const { data: hidden } = await supabase
            .from("hidden_posts")
            .select("post_id")
            .eq("user_id", uid);
          for (const h of hidden || []) hiddenIds.add(h.post_id);
        }

        const { data: posts, error } = await supabase
          .from("posts")
          .select("id,image_path,created_at,caption,user_id")
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) throw error;

        const userIds = Array.from(new Set((posts || []).map((p) => p.user_id)));
        const profileMap = new Map();
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id,display_name,username,avatar_url")
            .in("user_id", userIds);
          for (const p of profiles || []) profileMap.set(p.user_id, p);
        }

        const withUrls = (posts || []).filter((p) => !hiddenIds.has(p.id)).map((p) => {
          let path = p.image_path;
          try {
            const parsed = JSON.parse(p.image_path);
            if (Array.isArray(parsed)) path = parsed[0] || p.image_path;
          } catch {
            // ignore
          }
          const { data } = supabase.storage.from("post-images").getPublicUrl(path);
          return { ...p, imageUrl: data.publicUrl, profile: profileMap.get(p.user_id) || null };
        });
        setItems(withUrls);
      } catch (e) {
        setErr(e?.message || "Không tải được khám phá");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="page-title">Khám phá</h2>
      </div>
      {err && <div className="card" style={{ borderColor: "#ff7b7b" }}>{err}</div>}
      {loading && <div className="muted">Đang tải...</div>}
      <div className="explore-grid">
        {items.map((p) => (
          <button key={p.id} className="explore-item" onClick={() => setActivePost(p)}>
            <img src={p.imageUrl} alt="post" />
          </button>
        ))}
      </div>

      {activePost && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-popup">
            <button className="media-close" onClick={() => setActivePost(null)} aria-label="Đóng">
              <X size={16} />
            </button>
            <img className="media-image" src={activePost.imageUrl} alt="post" />
            <div className="media-caption">
              <div className="row" style={{ gap: 8 }}>
                <div className="avatar">
                  <img className="avatar-img" src={activePost.profile?.avatar_url || "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png"} alt="avatar" />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{activePost.profile?.display_name || "Tài khoản"}</div>
                  <div className="muted small">{activePost.profile?.username ? `@${activePost.profile.username}` : ""}</div>
                </div>
              </div>
              {activePost.caption && <div className="small">{activePost.caption}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
