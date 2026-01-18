import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Image as ImageIcon, RotateCcw, Send, Smile, Trash2, X } from "lucide-react";
import { supabase } from "../supabase.js";

const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/d4m-dev/media/main/avatar/default-avatar.png";

export default function Messages({ targetUserId }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [targetProfile, setTargetProfile] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(targetUserId || null);
  const [conversations, setConversations] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState(new Map());
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ x: 60, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showStickers, setShowStickers] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef(null);

  const stickerSet = [
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/heart.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/heart-box.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/haha.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/wow.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/party.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/thumb.gif",
    "https://raw.githubusercontent.com/d4m-dev/media/refs/heads/main/sticker/gif/cry.gif"
  ];

  const canChat = useMemo(() => !!currentUserId && !!selectedUserId, [currentUserId, selectedUserId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    if (targetUserId) setSelectedUserId(targetUserId);
  }, [targetUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const { data: convs, error } = await supabase
          .from("conversations")
          .select("id,user1_id,user2_id,updated_at")
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .order("updated_at", { ascending: false });
        if (error) throw error;

        const partnerIds = (convs || []).map((c) => (c.user1_id === currentUserId ? c.user2_id : c.user1_id));
        const { data: profiles, error: pe } = await supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url")
          .in("user_id", partnerIds.length ? partnerIds : ["00000000-0000-0000-0000-000000000000"]);
        if (pe) throw pe;

        let lastByConv = new Map();
        if (convs?.length) {
          const ids = convs.map((c) => c.id);
          const { data: lastMessages } = await supabase
            .from("messages")
            .select("id,conversation_id,text,image_url,sticker_url,is_recalled,created_at")
            .in("conversation_id", ids)
            .order("created_at", { ascending: false })
            .limit(100);
          for (const m of lastMessages || []) {
            if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
          }
        }

        const profileMap = new Map();
        for (const p of profiles || []) profileMap.set(p.user_id, p);

        const list = (convs || []).map((c) => {
          const partnerId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
          return {
            ...c,
            partner: profileMap.get(partnerId),
            lastMessage: lastByConv.get(c.id)
          };
        });
        setConversations(list);

        const { data: unread, error: ue } = await supabase
          .from("messages")
          .select("conversation_id", { count: "exact", head: false })
          .in("conversation_id", (convs || []).map((c) => c.id))
          .neq("sender_id", currentUserId);
        if (!ue) {
          const counts = new Map();
          for (const m of unread || []) {
            counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
          }
          setUnreadCounts(counts);
        }
      } catch {
        // ignore list errors
      }
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (!canChat) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: profile, error: pe } = await supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url")
          .eq("user_id", selectedUserId)
          .maybeSingle();
        if (pe) throw pe;
        setTargetProfile(profile);

        const { data: existing, error } = await supabase
          .from("conversations")
          .select("id,user1_id,user2_id")
          .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${selectedUserId}),and(user1_id.eq.${selectedUserId},user2_id.eq.${currentUserId})`)
          .maybeSingle();
        if (error) throw error;

        if (existing?.id) {
          setConversationId(existing.id);
        } else {
          const { data: created, error: ce } = await supabase
            .from("conversations")
            .insert({ user1_id: currentUserId, user2_id: selectedUserId })
            .select("id")
            .single();
          if (ce) throw ce;
          setConversationId(created.id);
        }
      } catch (e) {
        setErr(e?.message || "Không mở được cuộc trò chuyện");
      } finally {
        setLoading(false);
      }
    })();
  }, [canChat, currentUserId, selectedUserId]);

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
        const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,text,image_url,sticker_url,is_recalled,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!error) setMessages(data || []);
    })();
  }, [conversationId]);

  useEffect(() => {
    function onMove(e) {
      if (!dragging) return;
      setPopupPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, dragOffset]);

  function startDrag(e) {
    setDragging(true);
    setDragOffset({ x: e.clientX - popupPos.x, y: e.clientY - popupPos.y });
  }

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function send() {
    if (!text.trim() || !conversationId) return;
    setErr("");
    try {
      await sendMessage({ text: text.trim() });
      setText("");
    } catch (e) {
      setErr(e?.message || "Gửi tin nhắn thất bại");
    }
  }

  async function sendMessage({ text: messageText = null, imageUrl = null, stickerUrl = null }) {
    if (!conversationId) return;
    const payload = {
      conversation_id: conversationId,
      sender_id: currentUserId,
      text: messageText ?? "",
      image_url: imageUrl,
      sticker_url: stickerUrl
    };
    const { data, error } = await supabase.from("messages").insert(payload).select("id,conversation_id,sender_id,text,image_url,sticker_url,is_recalled,created_at").single();
    if (error) throw error;
    if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    }
  }

  async function uploadChatMedia(file) {
    const fileName = `${currentUserId}-${Date.now()}-${file.name}`;
    const tryUpload = async (bucket) => {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      return bucket;
    };
    let usedBucket = "chat-media";
    try {
      usedBucket = await tryUpload(usedBucket);
    } catch (errUpload) {
      const msg = String(errUpload?.message || "").toLowerCase();
      if (msg.includes("bucket not found")) {
        usedBucket = await tryUpload("post-images");
      } else {
        throw errUpload;
      }
    }
    const { data } = supabase.storage.from(usedBucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    setErr("");
    setSendingMedia(true);
    try {
      const url = await uploadChatMedia(file);
      await sendMessage({ imageUrl: url });
    } catch (e) {
      setErr(e?.message || "Gửi ảnh thất bại");
    } finally {
      setSendingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function sendSticker(url) {
    if (!url || !conversationId) return;
    setErr("");
    try {
      await sendMessage({ stickerUrl: url });
      setShowStickers(false);
    } catch (e) {
      setErr(e?.message || "Gửi sticker thất bại");
    }
  }

  async function deleteMessage(id) {
    if (!id) return;
    try {
      const { error } = await supabase.from("messages").delete().eq("id", id).eq("sender_id", currentUserId);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore delete errors
    }
  }

  async function recallMessage(id) {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_recalled: true, text: "", image_url: null, sticker_url: null })
        .eq("id", id)
        .eq("sender_id", currentUserId);
      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_recalled: true, text: "", image_url: null, sticker_url: null } : m)));
    } catch {
      // ignore recall errors
    }
  }

  async function deleteConversationById(id) {
    if (!id) return;
    if (!window.confirm("Xóa toàn bộ cuộc trò chuyện này?")) return;
    try {
      await supabase.from("messages").delete().eq("conversation_id", id);
      await supabase.from("conversations").delete().eq("id", id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      if (conversationId === id) {
        setMessages([]);
        setConversationId(null);
        setSelectedUserId(null);
        setPopupOpen(false);
      }
    } catch {
      // ignore delete errors
    }
  }

  async function deleteConversation() {
    if (!conversationId) return;
    return deleteConversationById(conversationId);
  }

  function closeChatWindow() {
    setSelectedUserId(null);
    setConversationId(null);
    setMessages([]);
  }

  function getMessagePreview(m) {
    if (!m) return "Chưa có tin nhắn";
    if (m.is_recalled) return "Tin nhắn đã thu hồi";
    if (m.image_url) return "[Ảnh]";
    if (m.sticker_url) return "[Sticker]";
    return m.text || "Chưa có tin nhắn";
  }

  return (
    <div className="chat-layout">
      <aside className="card chat-list">
        <div className="section-title">Tin nhắn</div>
        {conversations.length === 0 && <div className="muted">Chưa có cuộc trò chuyện.</div>}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`chat-list-item ${selectedUserId === (c.user1_id === currentUserId ? c.user2_id : c.user1_id) ? "active" : ""}`}
          >
            <button className="chat-list-main" onClick={() => setSelectedUserId(c.user1_id === currentUserId ? c.user2_id : c.user1_id)}>
              <div className="avatar">
                <img className="avatar-img" src={c.partner?.avatar_url || DEFAULT_AVATAR_URL} alt="avatar" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{c.partner?.display_name || "Tài khoản"}</div>
                <div className="muted small">{getMessagePreview(c.lastMessage)}</div>
              </div>
              {unreadCounts.get(c.id) ? (
                <span className="chat-badge">Tin nhắn mới</span>
              ) : null}
            </button>
            <div className="chat-actions">
              <button className="icon-btn" onClick={() => deleteConversationById(c.id)} aria-label="Xóa cuộc trò chuyện">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </aside>

      {!popupOpen && (
      <div className="card chat-card">
        {!selectedUserId ? (
          <div className="muted">Chọn người dùng để bắt đầu chat.</div>
        ) : (
          <>
            <div className="chat-header">
              <div className="avatar">
                <img className="avatar-img" src={targetProfile?.avatar_url || DEFAULT_AVATAR_URL} alt="avatar" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{targetProfile?.display_name || "Tài khoản"}</div>
                <div className="muted">{targetProfile?.username ? `@${targetProfile.username}` : ""}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="icon-btn" onClick={() => setPopupOpen(true)} aria-label="Mở popup">
                    <ExternalLink size={16} />
                  </button>
                  <button className="icon-btn" onClick={deleteConversation} aria-label="Xóa cuộc trò chuyện">
                    <Trash2 size={16} />
                  </button>
                  <button className="icon-btn" onClick={closeChatWindow} aria-label="Đóng">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
            {loading && <div className="muted">Đang tải...</div>}
            {err && <div style={{ color: "#ff7b7b" }}>{err}</div>}
            <div className="chat-body">
              {messages.map((m) => {
                const isMediaOnly = !m.is_recalled && (m.image_url || m.sticker_url) && !m.text;
                return (
                <div
                  key={m.id}
                  className={`chat-bubble ${m.sender_id === currentUserId ? "me" : ""} ${isMediaOnly ? "media-only" : ""}`}
                >
                  {m.is_recalled ? (
                    <span className="muted">Tin nhắn đã thu hồi</span>
                  ) : (
                    <>
                      {m.image_url && <img className="chat-media" src={m.image_url} alt="image" />}
                      {m.sticker_url && <img className="chat-sticker" src={m.sticker_url} alt="sticker" />}
                      {m.text && <span>{m.text}</span>}
                    </>
                  )}
                  {m.sender_id === currentUserId && !m.is_recalled && (
                    <div className="chat-bubble-actions">
                      <button className="icon-btn" onClick={() => recallMessage(m.id)} aria-label="Thu hồi">
                        <RotateCcw size={12} />
                      </button>
                      <button className="icon-btn" onClick={() => deleteMessage(m.id)} aria-label="Xóa">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
            <div className="chat-input">
              <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Gửi ảnh">
                <ImageIcon size={16} />
              </button>
              <button className="icon-btn" onClick={() => setShowStickers((v) => !v)} aria-label="Sticker">
                <Smile size={16} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageSelect} />
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập tin nhắn..." />
              <button className="send-btn" onClick={send} disabled={!text.trim() || sendingMedia} aria-label="Gửi">
                <Send size={16} />
              </button>
            </div>
            {showStickers && (
              <div className="sticker-panel">
                {stickerSet.map((url) => (
                  <button key={url} className="sticker-item" onClick={() => sendSticker(url)}>
                    <img src={url} alt="sticker" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {popupOpen && selectedUserId && (
        <div className="chat-popup" style={{ left: popupPos.x, top: popupPos.y }}>
          <div className="chat-popup-header" onMouseDown={startDrag}>
            <span>Chat</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="icon-btn" onClick={deleteConversation} aria-label="Xóa cuộc trò chuyện">
                <Trash2 size={16} />
              </button>
              <button className="icon-btn" onClick={() => setPopupOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="chat-popup-body">
            {messages.map((m) => {
              const isMediaOnly = !m.is_recalled && (m.image_url || m.sticker_url) && !m.text;
              return (
              <div
                key={m.id}
                className={`chat-bubble ${m.sender_id === currentUserId ? "me" : ""} ${isMediaOnly ? "media-only" : ""}`}
              >
                {m.is_recalled ? (
                  <span className="muted">Tin nhắn đã thu hồi</span>
                ) : (
                  <>
                    {m.image_url && <img className="chat-media" src={m.image_url} alt="image" />}
                    {m.sticker_url && <img className="chat-sticker" src={m.sticker_url} alt="sticker" />}
                    {m.text && <span>{m.text}</span>}
                  </>
                )}
                {m.sender_id === currentUserId && !m.is_recalled && (
                  <div className="chat-bubble-actions">
                    <button className="icon-btn" onClick={() => recallMessage(m.id)} aria-label="Thu hồi">
                      <RotateCcw size={12} />
                    </button>
                    <button className="icon-btn" onClick={() => deleteMessage(m.id)} aria-label="Xóa">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
            })}
          </div>
          <div className="chat-input">
            <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Gửi ảnh">
              <ImageIcon size={16} />
            </button>
            <button className="icon-btn" onClick={() => setShowStickers((v) => !v)} aria-label="Sticker">
              <Smile size={16} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageSelect} />
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập tin nhắn..." />
            <button className="send-btn" onClick={send} disabled={!text.trim() || sendingMedia} aria-label="Gửi">
              <Send size={16} />
            </button>
          </div>
          {showStickers && (
            <div className="sticker-panel">
              {stickerSet.map((url) => (
                <button key={url} className="sticker-item" onClick={() => sendSticker(url)}>
                  <img src={url} alt="sticker" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
