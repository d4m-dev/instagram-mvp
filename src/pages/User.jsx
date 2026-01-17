import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";

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

export default function User({ userId }) {
  const [displayName, setDisplayName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarImage, setAvatarImage] = useState(null);
  const [cropZoom, setCropZoom] = useState(1.2);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropRotate, setCropRotate] = useState(0);
  const [cropFlipX, setCropFlipX] = useState(false);
  const [isCropReady, setIsCropReady] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const cropCanvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ posts: 0, likes: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [previewPostId, setPreviewPostId] = useState(null);
  const [previewCaption, setPreviewCaption] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);

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
          .select("display_name,username,avatar_url")
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
        setAvatarUrl(profileAvatarUrl || DEFAULT_AVATAR_URL);

        const { data: posts, error: pe } = await supabase
          .from("posts")
          .select("id,image_path,created_at,caption")
          .eq("user_id", viewingId)
          .order("created_at", { ascending: false })
          .limit(60);
        if (pe) throw pe;

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

  useEffect(() => {
    if (!avatarFile) {
      setAvatarImage(null);
      setIsCropReady(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const imgUrl = URL.createObjectURL(avatarFile);
        const img = await loadImage(imgUrl);
        URL.revokeObjectURL(imgUrl);
        if (!active) return;
        setAvatarImage(img);
        setCropZoom(1.2);
        setCropX(0);
        setCropY(0);
        setCropRotate(0);
        setCropFlipX(false);
        setIsCropReady(true);
        setIsCropOpen(true);
      } catch (e) {
        console.error(e);
        setErr("Không thể xử lý ảnh đại diện");
      }
    })();

    return () => {
      active = false;
    };
  }, [avatarFile]);

  function getCropRect(width, height, zoom, offsetX, offsetY) {
    const minSide = Math.min(width, height);
    const cropSize = Math.max(80, Math.round(minSide / Math.max(1, zoom)));
    const maxOffsetX = Math.max(0, (width - cropSize) / 2);
    const maxOffsetY = Math.max(0, (height - cropSize) / 2);
    const centerX = width / 2 + offsetX * maxOffsetX;
    const centerY = height / 2 + offsetY * maxOffsetY;
    const sx = Math.max(0, Math.min(width - cropSize, Math.round(centerX - cropSize / 2)));
    const sy = Math.max(0, Math.min(height - cropSize, Math.round(centerY - cropSize / 2)));
    return { sx, sy, size: cropSize };
  }

  function getWorkingCanvas(img, rotateDeg, flipX) {
    const rot = ((rotateDeg % 360) + 360) % 360;
    const rad = (rot * Math.PI) / 180;
    const isSwap = rot === 90 || rot === 270;
    const w = isSwap ? img.height : img.width;
    const h = isSwap ? img.width : img.height;
    const temp = document.createElement("canvas");
    temp.width = w;
    temp.height = h;
    const ctx = temp.getContext("2d");
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipX ? -1 : 1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return temp;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function closeCrop() {
    setIsCropOpen(false);
    setAvatarImage(null);
    setAvatarFile(null);
    setIsCropReady(false);
  }

  function openPreview(url, postId = null) {
    if (!url) return;
    setPreviewImage(url);
    setPreviewPostId(postId);
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

  useEffect(() => {
    if (!avatarImage || !cropCanvasRef.current) return;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const working = getWorkingCanvas(avatarImage, cropRotate, cropFlipX);
    const { sx, sy, size } = getCropRect(working.width, working.height, cropZoom, cropX, cropY);
    const previewSize = 220;
    canvas.width = previewSize;
    canvas.height = previewSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(working, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
  }, [avatarImage, cropZoom, cropX, cropY, cropRotate, cropFlipX]);

  async function uploadAvatar() {
    setErr("");
    setOk("");
    if (!avatarImage || !isCropReady) {
      setErr("Chọn ảnh đại diện trước.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Bạn chưa đăng nhập");

      const working = getWorkingCanvas(avatarImage, cropRotate, cropFlipX);
      const crop = getCropRect(working.width, working.height, cropZoom, cropX, cropY);
      const canvas = document.createElement("canvas");
      const maxSize = 600;
      const targetSize = Math.min(maxSize, crop.size);
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        working,
        crop.sx,
        crop.sy,
        crop.size,
        crop.size,
        0,
        0,
        targetSize,
        targetSize
      );

      const avatarBlob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });
      if (!avatarBlob) throw new Error("Blob empty");

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
      setAvatarFile(null);
      setAvatarImage(null);
      setIsCropReady(false);
      setIsCropOpen(false);
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

    if (!name) {
      setErr("Tên hiển thị không được để trống");
      return;
    }
    if (!username) {
      setErr("Mã người dùng không được để trống");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setErr("Mã người dùng chỉ gồm chữ, số, . _ - và 3-20 ký tự");
      return;
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
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setOk("Đã lưu thay đổi");
    } catch (e) {
      setErr(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  const avatarDisplay = useMemo(() => avatarUrl || DEFAULT_AVATAR_URL, [avatarUrl]);

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
          <button className="btn2" onClick={toggleFollow} disabled={followLoading}>
            {isFollowing ? "Đang theo dõi" : "Theo dõi"}
          </button>
        )}
      </div>
      {loading ? (
        <div className="muted">Đang tải...</div>
      ) : (
        <div className="grid">
          <div className="profile-header">
            <div className="profile-avatar">
              {avatarDisplay ? (
                <img className="clickable" src={avatarDisplay} alt="avatar" onClick={() => openPreview(avatarDisplay)} />
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
              {isOwner && (
                <div className="profile-actions">
                  <label className="btn2">
                    Chọn ảnh đại diện
                    <input type="file" accept="image/*" hidden onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                  </label>
                  <button className="btn" onClick={uploadAvatar} disabled={uploading || !avatarImage}>
                    {uploading ? "..." : "Lưu ảnh đại diện"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {isOwner && (
            <>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Tên hiển thị</div>
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nhập tên hiển thị" />
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Mã người dùng (public id)</div>
                <input className="input" value={publicId} onChange={(e) => setPublicId(e.target.value)} placeholder="vd: nguyenvana" />
              </div>
              {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
              {ok && <div style={{ color: "#16a34a" }}>{ok}</div>}
              <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "Lưu"}</button>
            </>
          )}

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
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Xem ảnh</div>
              <button className="icon-btn" onClick={closePreview} aria-label="Đóng">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                <div style={{ fontWeight: 600 }}>{displayName || "Tài khoản"}</div>
                <div className="muted small">{publicId ? `@${publicId}` : "Chưa đặt mã người dùng"}</div>
              </div>
              <div className={`modal-media ${previewImages.length > 1 ? `post-media-grid count-${Math.min(previewImages.length, 5)}` : ""}`}>
                {previewImages.length > 1 ? (
                  previewImages.slice(0, 5).map((url, idx) => (
                    <div key={`${url}-${idx}`} className="media-cell">
                      <img src={url} alt={`preview-${idx}`} />
                    </div>
                  ))
                ) : (
                  <img className="modal-image" src={previewImage} alt="preview" />
                )}
              </div>
              {previewPostId && isOwner && (
                <div className="grid" style={{ width: "100%" }}>
                  <div className="muted">Chỉnh sửa chú thích</div>
                  <textarea
                    className="textarea"
                    value={previewCaption}
                    onChange={(e) => setPreviewCaption(e.target.value)}
                    placeholder="Cập nhật chú thích..."
                  />
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn2" onClick={closePreview}>Đóng</button>
              {previewPostId && isOwner && (
                <>
                  <button className="btn" onClick={savePostCaption} disabled={savingPost}>Lưu</button>
                  <button className="btn danger-btn" onClick={() => deletePostById(previewPostId)}>Xóa bài viết</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCropOpen && avatarImage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Chỉnh ảnh đại diện (1:1)</div>
              <button className="icon-btn" onClick={closeCrop} aria-label="Đóng">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="avatar-cropper">
                <canvas ref={cropCanvasRef} aria-label="Xem trước ảnh đại diện" />
                <div className="crop-controls">
                  <label>
                    <span className="muted">Phóng to</span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={cropZoom}
                      onChange={(e) => setCropZoom(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span className="muted">Ngang</span>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={cropX}
                      onChange={(e) => setCropX(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span className="muted">Dọc</span>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={cropY}
                      onChange={(e) => setCropY(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span className="muted">Xoay</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={cropRotate}
                      onChange={(e) => setCropRotate(Number(e.target.value))}
                    />
                  </label>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <button className="btn2" onClick={() => setCropFlipX((v) => !v)}>Lật ngang</button>
                    <button
                      className="btn2"
                      onClick={() => {
                        setCropZoom(1.2);
                        setCropX(0);
                        setCropY(0);
                        setCropRotate(0);
                        setCropFlipX(false);
                      }}
                    >
                      Đặt lại
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn2" onClick={closeCrop}>Hủy</button>
              <button className="btn" onClick={uploadAvatar} disabled={uploading || !avatarImage}>
                {uploading ? "..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
