import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "../supabase.js";
import { getTrackName } from "../tracks.js";
import PostCard from "../components/PostCard.jsx";

async function getPublicUrl(path) {
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
}

function parseImagePaths(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // ignore
  }
  return [value];
}


export default function Feed({ onOpenProfile, openPostId, onOpenPostHandled }) {
  const [items, setItems] = useState([]); // merged posts
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);
  const [nameById, setNameById] = useState(new Map());
  const [bookmarked, setBookmarked] = useState(new Map());
  const [stories, setStories] = useState([]);
  const [storyOpen, setStoryOpen] = useState(null);
  const [storyMuted, setStoryMuted] = useState(true);
  const storyAudioRef = useRef(null);
  const [storyLoading, setStoryLoading] = useState(false);

  function stepStory(delta) {
    setStoryOpen((prev) => {
      if (!prev) return null;
      const nextIndex = prev.index + delta;
      if (nextIndex < 0) return prev;
      if (nextIndex >= prev.items.length) return null;
      return { ...prev, index: nextIndex };
    });
  }

  async function preloadStoryAudio(url) {
    if (!url) return;
    await new Promise((resolve) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      const done = () => resolve();
      audio.oncanplaythrough = done;
      audio.onerror = done;
    });
  }

  async function openStory(items, index) {
    setStoryLoading(true);
    const url = items[index]?.music_url;
    if (url) await preloadStoryAudio(url);
    setStoryOpen({ items, index });
    setStoryLoading(false);
  }

  useEffect(() => {
    if (!storyOpen) return;
    setStoryMuted(false);
    if (storyAudioRef.current) {
      storyAudioRef.current.muted = false;
      storyAudioRef.current.currentTime = 0;
      storyAudioRef.current.play().catch(() => {});
    }
    const durationMs = storyOpen.items[storyOpen.index]?.music_url ? 15000 : 5000;
    const timer = setTimeout(() => {
      setStoryOpen((prev) => {
        if (!prev) return null;
        const nextIndex = prev.index + 1;
        if (nextIndex >= prev.items.length) return null;
        return { ...prev, index: nextIndex };
      });
    }, durationMs);
    return () => clearTimeout(timer);
  }, [storyOpen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || null));
  }, []);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data: posts, error: e1 } = await supabase
        .from("posts")
        .select("id,user_id,caption,image_path,created_at,location,music_url")
        .order("created_at", { ascending: false })
        .limit(50);

      if (e1) throw e1;
      let hiddenIds = new Set();
      if (uid) {
        const { data: hidden, error: he } = await supabase
          .from("hidden_posts")
          .select("post_id")
          .eq("user_id", uid);
        if (he) throw he;
        for (const h of hidden || []) hiddenIds.add(h.post_id);
      }

      const visiblePosts = (posts || []).filter((p) => !hiddenIds.has(p.id));
      const postIds = visiblePosts.map((p) => p.id);

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

      let bookmarkedMap = new Map();
      if (uid && postIds.length) {
        const { data: bm, error: be } = await supabase
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", uid)
          .in("post_id", postIds);
        if (be) throw be;
        for (const b of bm || []) bookmarkedMap.set(b.post_id, true);
      }

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

      const userIdSet = new Set();
      for (const p of posts || []) userIdSet.add(p.user_id);
      for (const c of comments || []) userIdSet.add(c.user_id);

      const userIds = Array.from(userIdSet);
      let displayNameMap = new Map();
      if (userIds.length) {
        const { data: profiles, error: e4 } = await supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url")
          .in("user_id", userIds);
        if (e4) throw e4;
        for (const p of profiles || []) {
          if (p.display_name || p.username || p.avatar_url) {
            displayNameMap.set(p.user_id, {
              display_name: p.display_name || "",
              username: p.username || "",
              avatar_url: p.avatar_url || ""
            });
          }
        }
      }

      const merged = await Promise.all(
        visiblePosts.map(async (p) => {
          const paths = parseImagePaths(p.image_path);
          const imageUrls = await Promise.all(paths.map((path) => getPublicUrl(path)));
          const imageUrl = imageUrls[0] || "";
          const likeUserIds = likeByPost.get(p.id) || [];
          return {
            ...p,
            imageUrl,
            imageUrls,
            likesCount: likeUserIds.length,
            hasLiked: uid ? likeUserIds.includes(uid) : false,
            hasBookmarked: bookmarkedMap.get(p.id) || false,
            comments: commentsByPost.get(p.id) || []
          };
        })
      );

      setNameById(displayNameMap);
      setBookmarked(bookmarkedMap);
      setItems(merged);
    } catch (e) {
      setErr(e?.message || "Tải bảng tin thất bại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  useEffect(() => {
    (async () => {
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("stories")
          .select("id,user_id,image_path,created_at,expires_at,music_url")
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;

        const userIds = Array.from(new Set((data || []).map((s) => s.user_id)));
        const profileMap = new Map();
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id,display_name,username,avatar_url")
            .in("user_id", userIds);
          for (const p of profiles || []) profileMap.set(p.user_id, p);
        }

        const withUrls = (data || []).map((s) => {
          const { data: urlData } = supabase.storage.from("stories").getPublicUrl(s.image_path);
          return {
            ...s,
            imageUrl: urlData.publicUrl,
            profile: profileMap.get(s.user_id) || null
          };
        });
        setStories(withUrls);
      } catch {
        // ignore
      }
    })();
  }, []);

  const empty = useMemo(() => !loading && !err && items.length === 0, [loading, err, items]);
  const storyDurationMs = storyOpen?.items?.[storyOpen.index]?.music_url ? 15000 : 5000;

  return (
    <div className="grid">
      {stories.length > 0 && (
        <div className="card story-bar">
          {stories.map((s) => (
            <button
              key={s.id}
              className="story-item"
              onClick={() => {
                const userStories = stories.filter((it) => it.user_id === s.user_id);
                const startIndex = Math.max(0, userStories.findIndex((it) => it.id === s.id));
                openStory(userStories, startIndex);
              }}
            >
              <div className="story-avatar">
                <img className="avatar-img" src={s.profile?.avatar_url || "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png"} alt="avatar" />
              </div>
              <div className="muted small">{s.profile?.username ? `@${s.profile.username}` : "story"}</div>
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="page-title">Bảng tin</h2>
        <button className="btn2" onClick={load} disabled={loading}>{loading ? "..." : "Làm mới"}</button>
      </div>

      {err && <div className="card" style={{ borderColor: "#ff7b7b" }}>{err}</div>}
      {empty && <div className="card">Chưa có bài nào.</div>}

      {items.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          onChanged={load}
          nameById={nameById}
          uid={uid}
          onOpenProfile={onOpenProfile}
          autoOpen={openPostId === p.id}
          onAutoOpenHandled={onOpenPostHandled}
        />
      ))}

      {storyLoading && (
        <div className="card">Đang tải story...</div>
      )}

      {storyOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-popup">
            <button className="media-close" onClick={() => setStoryOpen(null)} aria-label="Đóng">
              <X size={16} />
            </button>
            <div className="story-nav story-left" onClick={() => stepStory(-1)} />
            <div className="story-nav story-right" onClick={() => stepStory(1)} />
            <div className="story-progress">
              {storyOpen.items.map((item, idx) => (
                <div key={item.id} className={`story-progress-segment ${idx < storyOpen.index ? "done" : ""}`}>
                  {idx === storyOpen.index && (
                    <span
                      className="story-progress-fill"
                      key={`${item.id}-${storyOpen.index}`}
                      style={{ animationDuration: `${storyDurationMs}ms` }}
                    />
                  )}
                </div>
              ))}
            </div>
            <img className="media-image" src={storyOpen.items[storyOpen.index]?.imageUrl} alt="story" />
            <div className="media-caption">
              <div className="row" style={{ gap: 8 }}>
                <div className="avatar">
                  <img className="avatar-img" src={storyOpen.items[storyOpen.index]?.profile?.avatar_url || "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png"} alt="avatar" />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{storyOpen.items[storyOpen.index]?.profile?.display_name || "Tài khoản"}</div>
                  <div className="muted small">{storyOpen.items[storyOpen.index]?.profile?.username ? `@${storyOpen.items[storyOpen.index].profile.username}` : ""}</div>
                </div>
              </div>
              {storyOpen.items[storyOpen.index]?.music_url && (
                <div className="story-music">
                  <span className="muted small">{getTrackName(storyOpen.items[storyOpen.index].music_url)}</span>
                  <audio
                    ref={storyAudioRef}
                    className="story-audio"
                    src={storyOpen.items[storyOpen.index].music_url}
                    preload="auto"
                    autoPlay
                    muted={storyMuted}
                    playsInline
                  />
                </div>
              )}
            </div>
            {storyOpen.items[storyOpen.index]?.music_url && (
              <button
                type="button"
                className="mute-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !storyMuted;
                  setStoryMuted(next);
                  if (storyAudioRef.current) {
                    storyAudioRef.current.muted = next;
                    if (!next) storyAudioRef.current.play().catch(() => {});
                  }
                }}
                aria-label={storyMuted ? "Bật nhạc" : "Tắt nhạc"}
              >
                {storyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
