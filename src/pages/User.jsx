import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "../supabase.js";
import { getTrackName } from "../tracks.js";
import CropperModal from "../components/CropperModal.jsx";

function getPublicUrl(bucket, path) {
  if (!path) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || "";
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

const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";


export default function User({ userId, onOpenChat }) {
  const [displayName, setDisplayName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [avatarBlob, setAvatarBlob] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [cropTarget, setCropTarget] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ posts: 0, likes: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storyPreview, setStoryPreview] = useState("");
  const [storyBlob, setStoryBlob] = useState(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const [stories, setStories] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [storyOpen, setStoryOpen] = useState(null);
  const [storyMuted, setStoryMuted] = useState(true);
  const storyAudioRef = useRef(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [previewPostId, setPreviewPostId] = useState(null);
  const [previewCaption, setPreviewCaption] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editCaptionOpen, setEditCaptionOpen] = useState(false);

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

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const { data: userData, error: ue } = await supabase.auth.getUser();
        if (ue) throw ue;
        const uid = userData.user?.id;
        if (!uid) throw new Error("Bạn chưa đăng nhập");

        const viewingId = userId || uid;
        const isOwner = viewingId === uid;

        const { data, error } = await supabase
          .from("profiles")
          .select("display_name,username,avatar_url,bio")
          .eq("user_id", viewingId)
          .maybeSingle();
        if (error) throw error;

        const metaName = isOwner ? (userData.user?.user_metadata?.display_name || "") : "";
        const metaUsername = isOwner ? (userData.user?.user_metadata?.username || "") : "";
        const name = data?.display_name || metaName || "";
        const uname = data?.username || metaUsername || "";
        const profileAvatarUrl = data?.avatar_url || "";
        setDisplayName(name);
        setPublicId(uname);
        setBio(data?.bio || "");
        setAvatarUrl(profileAvatarUrl || DEFAULT_AVATAR_URL);

        const { data: posts, error: pe } = await supabase
          .from("posts")
          .select("id,image_path,created_at,caption,music_url")
          .eq("user_id", viewingId)
          .order("created_at", { ascending: false })
          .limit(60);
        if (pe) throw pe;

        const nowIso = new Date().toISOString();
        const { data: storyData, error: se } = await supabase
          .from("stories")
          .select("id,user_id,image_path,created_at,expires_at,music_url")
          .eq("user_id", viewingId)
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false });
        if (se) throw se;
        const storyWithUrls = (storyData || []).map((s) => {
          const { data: urlData } = supabase.storage.from("stories").getPublicUrl(s.image_path);
          return { ...s, imageUrl: urlData.publicUrl };
        });
        setStories(storyWithUrls);

        const { data: hlData, error: he } = await supabase
          .from("highlights")
          .select("id,title,cover_path,created_at")
          .eq("user_id", viewingId)
          .order("created_at", { ascending: false });
        if (he) throw he;
        const hlWithUrls = (hlData || []).map((h) => {
          const { data: urlData } = supabase.storage.from("stories").getPublicUrl(h.cover_path);
          return { ...h, coverUrl: urlData.publicUrl };
        });
        setHighlights(hlWithUrls);

        const postIds = (posts || []).map((p) => p.id);
        const withUrls = await Promise.all(
          (posts || []).map(async (p) => {
            const paths = parseImagePaths(p.image_path);
            const imageUrls = await Promise.all(paths.map((path) => getPublicUrl("post-images", path)));
            return {
              ...p,
              imageUrls,
              imageUrl: imageUrls[0] || "",
              image_paths: paths
            };
          })
        );

        let totalLikes = 0;
        if (postIds.length) {
          const { data: likes, error: le } = await supabase
            .from("likes")
            .select("post_id")
            .in("post_id", postIds);
          if (!le) totalLikes = (likes || []).length;
        }

        let followers = 0;
        let following = 0;
        try {
          const { count: f1, error: fe1 } = await supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", viewingId);
          if (!fe1 && typeof f1 === "number") followers = f1;

          const { count: f2, error: fe2 } = await supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", viewingId);
          if (!fe2 && typeof f2 === "number") following = f2;
        } catch {
          followers = 0;
          following = 0;
        }

        if (!isOwner) {
          const { data: rel, error: re } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", uid)
            .eq("following_id", viewingId)
            .maybeSingle();
          if (!re) setIsFollowing(!!rel);
        } else {
          setIsFollowing(false);
        }

        setItems(withUrls);
        setStats({ posts: withUrls.length, likes: totalLikes, followers, following });
      } catch (e) {
        setErr(e?.message || "Không tải được hồ sơ");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const isOwner = currentUserId && (userId ? currentUserId === userId : true);
  const storyDurationMs = storyOpen?.items?.[storyOpen.index]?.music_url ? 15000 : 5000;

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

  async function uploadStory() {
    setErr("");
    if (!storyBlob) {
      setErr("Chọn ảnh story trước.");
      return;
    }
    setStoryUploading(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const fileName = `${uid}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(fileName, storyBlob, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("stories")
        .insert({ user_id: uid, image_path: fileName, expires_at: expiresAt });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("stories").getPublicUrl(fileName);
      setStories((prev) => [{ id: crypto.randomUUID(), image_path: fileName, imageUrl: urlData.publicUrl }, ...prev]);
      if (storyPreview) URL.revokeObjectURL(storyPreview);
      setStoryPreview("");
      setStoryBlob(null);
    } catch (e) {
      setErr(e?.message || "Đăng story thất bại");
    } finally {
      setStoryUploading(false);
    }
  }

  async function saveHighlight(story) {
    const title = window.prompt("Tên highlight?") || "";
    if (!title.trim()) return;
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase
        .from("highlights")
        .insert({ user_id: uid, title: title.trim(), cover_path: story.image_path, story_ids: JSON.stringify([story.id]) });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("stories").getPublicUrl(story.image_path);
      setHighlights((prev) => [{ id: crypto.randomUUID(), title: title.trim(), coverUrl: urlData.publicUrl }, ...prev]);
    } catch (e) {
      setErr(e?.message || "Lưu highlight thất bại");
    }
  }

  function handleCropCancel() {
    setCropOpen(false);
    setCropTarget(null);
  }

  function handleCropConfirm(blob, preview) {
    if (!cropTarget) return;
    if (cropTarget.type === "avatar") {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarBlob(blob);
      setAvatarPreview(preview);
    }
    if (cropTarget.type === "story") {
      if (storyPreview) URL.revokeObjectURL(storyPreview);
      setStoryBlob(blob);
      setStoryPreview(preview);
    }
    setCropOpen(false);
    setCropTarget(null);
  }

  function openPreview(url, postId = null) {
    if (!url) return;
    setPreviewImage(url);
    setPreviewPostId(postId);
    setEditCaptionOpen(false);
    if (postId) {
      const post = items.find((p) => p.id === postId);
      setPreviewCaption(post?.caption || "");
      setPreviewImages([url]);
    } else {
      setPreviewCaption("");
      setPreviewImages([url]);
    }
  }

  function closePreview() {
    setPreviewImage("");
    setPreviewPostId(null);
    setPreviewCaption("");
    setPreviewImages([]);
    setEditCaptionOpen(false);
  }

  async function toggleFollow() {
    if (!currentUserId || !userId) return;
    setFollowLoading(true);
    setErr("");
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", userId);
        if (error) throw error;
        setIsFollowing(false);
        setStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: userId });
        if (error) throw error;

        try {
          await supabase.from("notifications").insert({
            user_id: userId,
            actor_id: currentUserId,
            type: "follow"
          });
        } catch {
          // ignore notification errors
        }

        setIsFollowing(true);
        setStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (e) {
      setErr(e?.message || "Thao tác thất bại");
    } finally {
      setFollowLoading(false);
    }
  }

  async function savePostCaption() {
    if (!previewPostId) return;
    setSavingPost(true);
    setErr("");
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase
        .from("posts")
        .update({ caption: previewCaption.trim() })
        .eq("id", previewPostId)
        .eq("user_id", uid);
      if (error) throw error;

      setItems((prev) => prev.map((p) => (p.id === previewPostId ? { ...p, caption: previewCaption.trim() } : p)));
    } catch (e) {
      setErr(e?.message || "Sửa bài viết thất bại");
    } finally {
      setSavingPost(false);
    }
  }

  async function deletePostById(id) {
    if (!id) return;
    if (!window.confirm("Xóa bài viết này?")) return;
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const post = items.find((p) => p.id === id);
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;

      if (post?.image_paths?.length) {
        try {
          await supabase.storage.from("post-images").remove(post.image_paths);
        } catch {
          // ignore storage errors
        }
      }

      setItems((prev) => prev.filter((p) => p.id !== id));
      setStats((prev) => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
      closePreview();
    } catch (e) {
      setErr(e?.message || "Xóa bài viết thất bại");
    }
  }

  async function uploadAvatar() {
    setErr("");
    setOk("");
    if (!avatarBlob) {
      setErr("Chọn ảnh đại diện trước.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const fileName = `${uid}-${Date.now()}.jpg`;
      const tryUpload = async (bucket) => {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(fileName, avatarBlob, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        return bucket;
      };

      let usedBucket = "avatars";
      try {
        usedBucket = await tryUpload(usedBucket);
      } catch (errUpload) {
        const msg = String(errUpload?.message || "");
        if (msg.toLowerCase().includes("bucket not found")) {
          usedBucket = await tryUpload("post-images");
        } else {
          throw errUpload;
        }
      }

      const publicUrl = getPublicUrl(usedBucket, fileName);

      const safeName = displayName.trim() || "New User";
      const safeUsername = publicId.trim() || `user_${uid.slice(0, 6)}`;

      const { error } = await supabase.from("profiles").upsert({
        user_id: uid,
        display_name: safeName,
        username: safeUsername,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setAvatarUrl(publicUrl);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
      setAvatarBlob(null);
      setOk("Đã cập nhật ảnh đại diện");
    } catch (e) {
      setErr(e?.message || "Cập nhật ảnh đại diện thất bại");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setErr("");
    setOk("");
    const name = displayName.trim();
    const username = publicId.trim();
    const bioText = bio.trim();

    if (!name) {
      setErr("Tên hiển thị không được để trống");
      return false;
    }
    if (!username) {
      setErr("Mã người dùng không được để trống");
      return false;
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setErr("Mã người dùng chỉ gồm chữ, số, . _ - và 3-20 ký tự");
      return false;
    }

    setSaving(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const { error } = await supabase.from("profiles").upsert({
        user_id: uid,
        display_name: name,
        username,
        bio: bioText || null,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setOk("Đã lưu thay đổi");
      return true;
    } catch (e) {
      setErr(e?.message || "Lưu thất bại");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const avatarDisplay = useMemo(() => avatarPreview || avatarUrl || DEFAULT_AVATAR_URL, [avatarPreview, avatarUrl]);

  return (
    <div className="card">
      <div className="profile-topbar">
        <h2 className="page-title">Hồ sơ</h2>
        {isOwner ? (
          <button className="icon-btn" onClick={logout} aria-label="Đăng xuất">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l-1 4h-4V3h4l1 4" />
              <path d="M15 12H7" />
              <path d="M15 12l-3-3" />
              <path d="M15 12l-3 3" />
            </svg>
          </button>
        ) : (
          <div className="row">
            <button className="btn2" onClick={toggleFollow} disabled={followLoading}>
              {isFollowing ? "Đang theo dõi" : "Theo dõi"}
            </button>
            <button className="btn" onClick={() => onOpenChat?.(userId)}>
              Nhắn tin
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="muted">Đang tải...</div>
      ) : (
        <div className="grid">
          <div className="profile-header">
            <div className="profile-avatar">
              {avatarDisplay ? (
                <img
                  className="clickable"
                  src={avatarDisplay}
                  alt="avatar"
                  onClick={() => {
                    if (isOwner) setAvatarModalOpen(true);
                    else openPreview(avatarDisplay);
                  }}
                />
              ) : (
                <div className="avatar" />
              )}
            </div>
            <div className="grid">
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{displayName || "Tài khoản"}</div>
                <div className="muted">{publicId ? `@${publicId}` : "Chưa đặt mã người dùng"}</div>
              </div>
              <div className="profile-stats">
                <div className="stat"><strong>{stats.posts}</strong><span className="muted">Bài viết</span></div>
                <div className="stat"><strong>{stats.likes}</strong><span className="muted">Lượt thích</span></div>
                <div className="stat"><strong>{stats.followers}</strong><span className="muted">Followers</span></div>
                <div className="stat"><strong>{stats.following}</strong><span className="muted">Following</span></div>
              </div>
              {bio ? (
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{bio}</div>
              ) : (
                isOwner && (
                  <button className="btn2" onClick={() => setEditProfileOpen(true)}>Thêm bio</button>
                )
              )}
              {isOwner && (
                <div className="profile-actions">
                  <button className="btn2" onClick={() => setEditProfileOpen(true)}>Chỉnh sửa hồ sơ</button>
                </div>
              )}
            </div>
          </div>

          <div className="section-title">Story</div>
          <div className="story-row">
            {isOwner && (
              <label className="story-add">
                +
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCropTarget({ type: "story", file, aspect: 9 / 16, outputWidth: 1080, title: "Cắt story (9:16)" });
                    setCropOpen(true);
                  }}
                />
              </label>
            )}
            {stories.map((s) => (
              <button
                key={s.id}
                className="story-item"
                onClick={() => {
                  const startIndex = Math.max(0, stories.findIndex((it) => it.id === s.id));
                  openStory(stories, startIndex);
                }}
              >
                <div className="story-avatar">
                  <img className="avatar-img" src={s.imageUrl} alt="story" />
                </div>
                <div className="muted small">{publicId ? `@${publicId}` : "story"}</div>
              </button>
            ))}
          </div>
          {storyPreview && isOwner && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="modal">
                <div className="modal-header">
                  <div className="modal-title">Đăng story</div>
                  <button
                    className="icon-btn"
                    onClick={() => { if (storyPreview) URL.revokeObjectURL(storyPreview); setStoryPreview(""); setStoryBlob(null); }}
                    aria-label="Đóng"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="modal-media">
                    <img className="modal-image" src={storyPreview} alt="story preview" />
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn2" onClick={() => { if (storyPreview) URL.revokeObjectURL(storyPreview); setStoryPreview(""); setStoryBlob(null); }}>Hủy</button>
                  <button className="btn" onClick={uploadStory} disabled={storyUploading}>{storyUploading ? "..." : "Đăng story"}</button>
                </div>
              </div>
            </div>
          )}

          {highlights.length > 0 && (
            <>
              <div className="section-title">Highlight</div>
              <div className="highlight-row">
                {highlights.map((h) => (
                  <div key={h.id} className="highlight-item">
                    <div className="highlight-cover">
                      <img src={h.coverUrl} alt={h.title} />
                    </div>
                    <div className="muted small">{h.title}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
          {ok && <div style={{ color: "#16a34a" }}>{ok}</div>}

          <div className="section-title">Bài viết</div>
          {items.length === 0 ? (
            <div className="muted">Chưa có bài viết nào.</div>
          ) : (
            <div className="profile-grid">
              {items.map((p) => (
                <div className="profile-post" key={p.id}>
                  <img className="clickable" src={p.imageUrl} alt="post" onClick={() => openPreview(p.imageUrl, p.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {previewImage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-popup">
            <button className="media-close" onClick={closePreview} aria-label="Đóng">
              <X size={16} />
            </button>
            {previewImages.length > 1 ? (
              <div className={`media-grid post-media-grid count-${Math.min(previewImages.length, 5)}`}>
                {previewImages.slice(0, 5).map((url, idx) => (
                  <div key={`${url}-${idx}`} className="media-cell">
                    <img src={url} alt={`preview-${idx}`} />
                  </div>
                ))}
              </div>
            ) : (
              <img className="media-image" src={previewImage} alt="preview" />
            )}
            <div className="media-caption">
              <div className="row" style={{ gap: 8 }}>
                <div className="avatar">
                  <img className="avatar-img" src={avatarDisplay} alt="avatar" />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{displayName || "Tài khoản"}</div>
                  <div className="muted small">{publicId ? `@${publicId}` : ""}</div>
                </div>
              </div>
              {previewCaption && <div className="small">{previewCaption}</div>}
            </div>
            {previewPostId && isOwner && (
              <div className="media-actions">
                <button className="btn2" onClick={() => setEditCaptionOpen((v) => !v)}>Sửa</button>
                <button className="btn danger-btn" onClick={() => deletePostById(previewPostId)}>Xóa</button>
              </div>
            )}
            {previewPostId && isOwner && editCaptionOpen && (
              <div className="media-edit">
                <div className="muted small">Chỉnh sửa chú thích</div>
                <textarea
                  className="textarea"
                  value={previewCaption}
                  onChange={(e) => setPreviewCaption(e.target.value)}
                  placeholder="Cập nhật chú thích..."
                />
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn2" onClick={() => setEditCaptionOpen(false)}>Hủy</button>
                  <button className="btn" onClick={savePostCaption} disabled={savingPost}>{savingPost ? "..." : "Lưu"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {avatarModalOpen && isOwner && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Ảnh đại diện</div>
              <button className="icon-btn" onClick={() => setAvatarModalOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-media">
                <img className="modal-image" src={avatarDisplay} alt="avatar" />
              </div>
              <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                <label className="btn2">
                  Đổi ảnh đại diện
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCropTarget({ type: "avatar", file, aspect: 1, outputWidth: 600, title: "Chỉnh ảnh đại diện (1:1)" });
                      setCropOpen(true);
                    }}
                  />
                </label>
                <button className="btn" onClick={uploadAvatar} disabled={uploading || !avatarBlob}>
                  {uploading ? "..." : "Lưu ảnh"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editProfileOpen && isOwner && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Chỉnh sửa hồ sơ</div>
              <button className="icon-btn" onClick={() => setEditProfileOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid" style={{ width: "100%" }}>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Tên hiển thị</div>
                  <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nhập tên hiển thị" />
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Mã người dùng (public id)</div>
                  <input className="input" value={publicId} onChange={(e) => setPublicId(e.target.value)} placeholder="vd: nguyenvana" />
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Bio</div>
                  <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Giới thiệu ngắn về bạn..." />
                </div>
              </div>
              {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
              {ok && <div style={{ color: "#16a34a" }}>{ok}</div>}
            </div>
            <div className="modal-actions">
              <button className="btn2" onClick={() => setEditProfileOpen(false)}>Đóng</button>
              <button
                className="btn"
                onClick={async () => {
                  const okSave = await save();
                  if (okSave) setEditProfileOpen(false);
                }}
                disabled={saving}
              >
                {saving ? "..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
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
                  <img className="avatar-img" src={avatarDisplay} alt="avatar" />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{displayName || "Tài khoản"}</div>
                  <div className="muted small">{publicId ? `@${publicId}` : ""}</div>
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
            {isOwner && (
              <div className="media-actions">
                <button className="btn" onClick={() => saveHighlight(storyOpen.items[storyOpen.index])}>Lưu highlight</button>
              </div>
            )}
          </div>
        </div>
      )}

      {storyLoading && (
        <div className="card">Đang tải story...</div>
      )}

      <CropperModal
        open={cropOpen}
        file={cropTarget?.file}
        aspect={cropTarget?.aspect || 1}
        outputWidth={cropTarget?.outputWidth || 1080}
        title={cropTarget?.title || "Cắt ảnh"}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
