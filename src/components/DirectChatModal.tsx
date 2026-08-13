import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore/lite';
import { useAuth, formatLastActive } from '../context/AuthContext.js';
import { useNotifications } from '../context/NotificationContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { 
  X, 
  Send, 
  Paperclip, 
  CheckCheck, 
  Maximize2, 
  Loader2, 
  Minus, 
  ChevronUp,
  Bell,
  BellOff,
  ShieldAlert,
  AlertCircle,
  UserX
} from 'lucide-react';
import { pushToast } from '../services/toast.js';

export interface ChatFriend {
  id: string;
  username: string;
  avatarUrl?: string;
  lastActiveAt?: string;
}

interface DirectMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl?: string;
  receiverId: string;
  text?: string;
  imageUrl?: string;
  createdAt: string;
  read: boolean;
}

interface DirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: ChatFriend | null;
  onViewProfile?: (userId: string, username: string) => void;
}

export const DirectChatModal: React.FC<DirectChatModalProps> = ({
  isOpen,
  onClose,
  friend,
  onViewProfile
}) => {
  const { user } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const { isMutualFollow, isUserBlocked, isUserMuted, toggleBlockUser, toggleMuteUser } = useTracking();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isMutual = friend ? isMutualFollow(friend.id) : false;
  const isBlocked = friend ? isUserBlocked(friend.id) : false;
  const isMuted = friend ? isUserMuted(friend.id) : false;

  const chatId = (user && friend)
    ? [user.id, friend.id].sort().join('_')
    : '';

  // Scroll to bottom
  const scrollToBottom = () => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Reset minimized when changing friend
  useEffect(() => {
    if (friend) {
      setIsMinimized(false);
      setShowBlockConfirm(false);
    }
  }, [friend?.id]);

  // Load messages from Firestore / LocalStorage
  const loadMessages = async () => {
    if (!chatId || !user || !friend) return;

    // Read local cache first
    const cacheKey = `epsync_dm_${chatId}`;
    const legacyKey = `showtime_dm_${chatId}`;
    const cached = localStorage.getItem(cacheKey) || localStorage.getItem(legacyKey);
    if (cached) {
      try {
        setMessages(JSON.parse(cached));
      } catch (_) {}
    }

    if (isFirebaseEnabled && db) {
      try {
        const q = query(
          collection(db, 'direct_messages'),
          where('chatId', '==', chatId)
        );
        const snapshot = await getDocs(q);
        const loaded: DirectMessage[] = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as DirectMessage))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setMessages(loaded);
        localStorage.setItem(cacheKey, JSON.stringify(loaded));

        // Mark unread messages sent to me as read
        const unreadForMe = loaded.filter(m => m.receiverId === user.id && !m.read);
        if (unreadForMe.length > 0) {
          unreadForMe.forEach(async msg => {
            try {
              await setDoc(doc(db, 'direct_messages', msg.id), { ...msg, read: true });
            } catch (_) {}
          });
        }
      } catch (err) {
        console.warn('Error loading Firestore messages:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen && friend) {
      setLoading(true);
      loadMessages().finally(() => {
        setLoading(false);
        setTimeout(scrollToBottom, 150);
      });

      // Clear notifications from this friend
      const notifsFromFriend = notifications.filter(
        n => n.type === 'direct_message' && n.senderId === friend.id && !n.read
      );
      notifsFromFriend.forEach(n => markAsRead(n.id));

      // Poll periodically
      const interval = setInterval(() => {
        loadMessages();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isOpen, chatId, notifications]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isMinimized]);

  // Handle image upload & compression
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Selecione um arquivo de imagem válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setAttachedImage(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedImage) || !user || !friend || sending || isBlocked || !isMutual) return;

    setSending(true);
    const msgId = 'dm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newMsg: DirectMessage = {
      id: msgId,
      chatId,
      senderId: user.id,
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl,
      receiverId: friend.id,
      text: inputText.trim() || undefined,
      imageUrl: attachedImage || undefined,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Optimistic UI update
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInputText('');
    setAttachedImage(null);
    localStorage.setItem(`epsync_dm_${chatId}`, JSON.stringify(updated));

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'direct_messages', msgId), newMsg);

        // Send notification to receiver
        const notifId = 'notif_dm_' + msgId;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: friend.id,
          title: `Nova mensagem de @${user.username}`,
          message: newMsg.text || '📷 Enviou uma foto',
          type: 'direct_message',
          read: false,
          createdAt: new Date().toISOString(),
          data: {
            chatId,
            senderId: user.id,
            senderUsername: user.username,
            senderAvatarUrl: user.avatarUrl
          }
        });
      } catch (err) {
        console.error('Error sending message to Firebase:', err);
      }
    }

    setSending(false);
    setTimeout(scrollToBottom, 50);
  };

  if (!isOpen || !friend || !user) return null;

  const presence = formatLastActive(friend.lastActiveAt);

  return (
    <>
      {/* Floating Bottom-Right Messenger Box */}
      <div
        className="fb-chat-dock animate-fade-in"
        style={{
          position: 'fixed',
          bottom: 0,
          right: '24px',
          width: '360px',
          maxWidth: 'calc(100vw - 32px)',
          height: isMinimized ? '48px' : '480px',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 11000,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          transition: 'height 0.25s cubic-bezier(0.2, 0, 0, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: isMinimized ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}
            onClick={(e) => {
              if (onViewProfile && !isMinimized) {
                e.stopPropagation();
                onClose();
                onViewProfile(friend.id, friend.username);
              }
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`}
                alt={friend.username}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
              />
              {presence.isOnline && !isBlocked && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '9px',
                    height: '9px',
                    backgroundColor: 'var(--accent)',
                    borderRadius: '50%',
                    border: '2px solid var(--bg-elevated)'
                  }}
                />
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{friend.username}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isBlocked ? (
                  <span style={{ fontSize: '10px', color: 'var(--error)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    ⛔ Bloqueado
                  </span>
                ) : isMuted ? (
                  <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    🔕 Silenciado
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', color: presence.isOnline ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {presence.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {/* Mute Button */}
            <button
              onClick={() => toggleMuteUser(friend.id)}
              className="st-btn-icon"
              style={{
                width: '28px',
                height: '28px',
                color: isMuted ? 'var(--warning)' : 'var(--text-secondary)',
                background: isMuted ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                borderColor: isMuted ? 'rgba(234, 179, 8, 0.3)' : 'transparent'
              }}
              title={isMuted ? "Silêncio ativado (Clique para desativar)" : "Silenciar notificações"}
            >
              {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
            </button>

            {/* Block Button */}
            <button
              onClick={() => {
                if (isBlocked) {
                  toggleBlockUser(friend.id);
                } else {
                  setShowBlockConfirm(true);
                }
              }}
              className="st-btn-icon"
              style={{
                width: '28px',
                height: '28px',
                color: isBlocked ? 'var(--error)' : 'var(--text-secondary)',
                background: isBlocked ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                borderColor: isBlocked ? 'rgba(239, 68, 68, 0.3)' : 'transparent'
              }}
              title={isBlocked ? "Usuário bloqueado (Clique para desbloquear)" : "Bloquear usuário"}
            >
              {isBlocked ? <ShieldAlert size={14} /> : <UserX size={14} />}
            </button>

            {/* Minimize / Expand Button */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="st-btn-icon"
              style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              {isMinimized ? <ChevronUp size={15} /> : <Minus size={15} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="st-btn-icon"
              style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
              title="Fechar chat"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Block Confirmation Overlay */}
        {showBlockConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 10, 15, 0.92)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <ShieldAlert size={24} color="var(--error)" />
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              Bloquear @{friend.username}?
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.45 }}>
              Você não poderá trocar mensagens e todas as notificações vindas deste usuário serão desativadas.
            </p>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="st-btn-secondary"
                style={{ flex: 1, height: '34px', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  toggleBlockUser(friend.id);
                  setShowBlockConfirm(false);
                }}
                className="st-btn-primary"
                style={{
                  flex: 1,
                  height: '34px',
                  fontSize: '12px',
                  background: 'var(--error)',
                  borderColor: 'var(--error)',
                  color: '#FFFFFF'
                }}
              >
                Bloquear
              </button>
            </div>
          </div>
        )}

        {/* Messages Body */}
        {!isMinimized && (
          <>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'var(--bg-dark)'
              }}
            >
              {loading && messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Carregando histórico...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Nenhuma mensagem ainda.</p>
                  <span style={{ fontSize: '11px' }}>Diga olá para @{friend.username}! 👋</span>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.senderId === user.id;
                  const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '82%',
                          padding: msg.imageUrl ? '4px 4px 6px 4px' : '8px 12px',
                          borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: isMine ? 'var(--primary)' : 'var(--bg-surface)',
                          border: isMine ? 'none' : '1px solid var(--border-color)',
                          color: isMine ? '#FFFFFF' : 'var(--text-primary)',
                          fontSize: '13px',
                          lineHeight: '1.4',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        {/* Attached Image */}
                        {msg.imageUrl && (
                          <div
                            style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-xs)', overflow: 'hidden', marginBottom: msg.text ? '4px' : '0' }}
                            onClick={() => setPreviewImage(msg.imageUrl || null)}
                          >
                            <img
                              src={msg.imageUrl}
                              alt="print"
                              style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-xs)' }}
                            />
                            <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', padding: '3px', borderRadius: 'var(--radius-xs)' }}>
                              <Maximize2 size={11} color="#fff" />
                            </div>
                          </div>
                        )}

                        {/* Text */}
                        {msg.text && (
                          <div style={{ padding: msg.imageUrl ? '2px 4px' : 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {msg.text}
                          </div>
                        )}

                        {/* Timestamp */}
                        <div
                          style={{
                            fontSize: '9px',
                            color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                            textAlign: 'right',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '3px'
                          }}
                        >
                          <span>{time}</span>
                          {isMine && (
                            <CheckCheck size={11} color={msg.read ? 'var(--accent)' : 'rgba(255,255,255,0.7)'} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attached Image Preview before send */}
            {attachedImage && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: 'var(--radius-xs)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <img src={attachedImage} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => setAttachedImage(null)}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#fff', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={10} />
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Imagem pronta para envio</span>
              </div>
            )}

            {/* Conditional Input Bar Area */}
            {isBlocked ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <ShieldAlert size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Você bloqueou este usuário
                  </span>
                </div>
                <button
                  onClick={() => toggleBlockUser(friend.id)}
                  className="st-btn-secondary"
                  style={{ height: '28px', padding: '0 12px', fontSize: '11px', flexShrink: 0 }}
                >
                  Desbloquear
                </button>
              </div>
            ) : !isMutual ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4
                }}
              >
                <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <span>
                  O chat está disponível apenas para usuários que <strong>se seguem mutuamente</strong>.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                style={{
                  padding: '10px',
                  background: 'var(--bg-surface)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="st-btn-icon"
                  style={{ width: '32px', height: '32px', color: 'var(--text-secondary)', flexShrink: 0 }}
                  title="Anexar print/imagem"
                >
                  <Paperclip size={16} />
                </button>

                <input
                  type="text"
                  placeholder="Escreva uma mensagem..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  style={{
                    flex: 1,
                    height: '34px',
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />

                <button
                  type="submit"
                  disabled={(!inputText.trim() && !attachedImage) || sending}
                  className="st-btn-primary"
                  style={{
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: (!inputText.trim() && !attachedImage) || sending ? 0.4 : 1
                  }}
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Photo Lightbox */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="full preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />
          <button
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .fb-chat-dock {
            right: 8px !important;
            width: calc(100vw - 16px) !important;
            bottom: 64px !important;
          }
        }
      `}</style>
    </>
  );
};
