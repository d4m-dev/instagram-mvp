import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

export default function Search({ onOpenProfile }) {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let active = true;
    if (!trimmed) {
      setProfiles([]);
      setPosts([]);
      return;
    }
    setLoading(true);
    setErr("");

    (async () => {
      try {
        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url")
          .ilike("display_name", `%${trimmed}%`)
          .limit(8);
        if (pErr) throw pErr;

        const { data: uData, error: uErr } = await supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url")
          .ilike("username", `%${trimmed}%`)
          .limit(8);
        if (uErr) throw uErr;

        const profileMap = new Map();
        for (const p of [...(pData || []), ...(uData || [])]) {
          profileMap.set(p.user_id, p);
        }

        const { data: postData, error: postErr } = await supabase
          .from("posts")
          .select("id,caption,image_path,user_id")
          .ilike("caption", `%${trimmed}%`)
          .order("created_at", { ascending: false })
          .limit(12);
        if (postErr) throw postErr;

        const withImages = (postData || []).map((p) => {
          let path = p.image_path;
          try {
            const parsed = JSON.parse(p.image_path);
            if (Array.isArray(parsed)) path = parsed[0] || p.image_path;
          } catch {
            // ignore
          }
          const { data } = supabase.storage.from("post-images").getPublicUrl(path);
          return { ...p, imageUrl: data.publicUrl };
        });

        if (!active) return;
        setProfiles(Array.from(profileMap.values()));
        setPosts(withImages);
      } catch (e) {
        if (active) setErr(e?.message || "Không tìm thấy kết quả");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [trimmed]);

  return (
    <div className="grid">
      <div className="card search-card">
        <div className="search-header">
          <h2 className="page-title">Tìm kiếm</h2>
          <div className="muted">Nhập tên, username hoặc chú thích</div>
        </div>
        <input
          className="input"
          placeholder="Tìm người dùng hoặc bài viết..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <div className="muted">Đang tìm...</div>}
        {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
      </div>

      {profiles.length > 0 && (
        <div className="card">
          <div className="section-title">Người dùng</div>
          <div className="search-results">
            {profiles.map((p) => (
              <button key={p.user_id} className="search-user" onClick={() => onOpenProfile?.(p.user_id)}>
                <div className="avatar">
                  <img className="avatar-img" src={p.avatar_url || DEFAULT_AVATAR_URL} alt="avatar" />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.display_name || "Tài khoản"}</div>
                  <div className="muted">{p.username ? `@${p.username}` : "Chưa đặt mã người dùng"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="card">
          <div className="section-title">Bài viết</div>
          <div className="search-posts-grid">
            {posts.map((p) => (
              <div key={p.id} className="search-post">
                <img src={p.imageUrl} alt="post" />
                <div className="muted small">{p.caption}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
