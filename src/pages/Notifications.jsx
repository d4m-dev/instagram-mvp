import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

export default function Notifications({ onOpenProfile, onOpenPost }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: userData, error: ue } = await supabase.auth.getUser();
        if (ue) throw ue;
        const uid = userData.user?.id;
        if (!uid) throw new Error("Bạn chưa đăng nhập");

        const { data: noti, error } = await supabase
          .from("notifications")
          .select("id,actor_id,type,post_id,created_at,read")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;

        const actorIds = Array.from(new Set((noti || []).map((n) => n.actor_id)));
        let profiles = new Map();
        if (actorIds.length) {
          const { data: pData, error: pe } = await supabase
            .from("profiles")
            .select("user_id,display_name,username,avatar_url")
            .in("user_id", actorIds);
          if (pe) throw pe;
          for (const p of pData || []) profiles.set(p.user_id, p);
        }

        const enriched = (noti || []).map((n) => ({
          ...n,
          actor: profiles.get(n.actor_id) || null
        }));

        setItems(enriched);

        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", uid)
          .eq("read", false);
      } catch (e) {
        setErr(e?.message || "Không tải được thông báo");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let channel;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          async (payload) => {
            const actorId = payload.new.actor_id;
            let actor = null;
            if (actorId) {
              const { data } = await supabase
                .from("profiles")
                .select("user_id,display_name,username,avatar_url")
                .eq("user_id", actorId)
                .maybeSingle();
              actor = data;
            }
            setItems((prev) => [{ ...payload.new, actor }, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  function labelFor(type) {
    switch (type) {
      case "like":
        return "đã thích bài viết của bạn";
      case "comment":
        return "đã bình luận bài viết của bạn";
      case "follow":
        return "đã theo dõi bạn";
      default:
        return "đã tương tác";
    }
  }

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="page-title">Thông báo</h2>
      </div>
      {err && <div className="card" style={{ borderColor: "#ff7b7b" }}>{err}</div>}
      {loading && <div className="muted">Đang tải...</div>}
      {items.length === 0 && !loading && <div className="card">Chưa có thông báo.</div>}

      {items.map((n) => (
        <div
          key={n.id}
          className={`card notification-item ${n.read ? "" : "unread"}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (n.post_id) onOpenPost?.(n.post_id);
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && n.post_id) onOpenPost?.(n.post_id);
          }}
        >
          <button className="avatar-btn" onClick={() => onOpenProfile?.(n.actor_id)} aria-label="Xem hồ sơ">
            <div className="avatar">
              <img className="avatar-img" src={n.actor?.avatar_url || DEFAULT_AVATAR_URL} alt="avatar" />
            </div>
          </button>
          <div>
            <button className="link-btn" onClick={() => onOpenProfile?.(n.actor_id)}>
              <strong>{n.actor?.display_name || "Tài khoản"}</strong>
            </button>
            <span className="muted"> {labelFor(n.type)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
