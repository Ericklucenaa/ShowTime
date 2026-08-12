import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore/lite';
import { useAuth, formatLastActive } from '../context/AuthContext.js';
import { useNotifications } from '../context/NotificationContext.js';
import { X, Send, Paperclip, CheckCheck, Maximize2, Loader2 } from 'lucide-react';
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
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const chatId = (user && friend)
    ? [user.id, friend.id].sort().join('_')
    : '';

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages
  useEffect(() => {
    if (!isOpen || !chatId || !user) return;

    const localKey = `epsync_dm_${chatId}`;
    const cachedStr = localStorage.getItem(localKey) || localStorage.getItem(`showtime_dm_${chatId}`);
    if (cachedStr) {
      try {
        setMessages(JSON.parse(cachedStr));
      } catch (_) {}
    }

    const loadMessages = async () => {
      if (!isFirebaseEnabled || !db) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'direct_messages'),
          where('chatId', '==', chatId)
        );
        const snap = await getDocs(q);
        const loaded: DirectMessage[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            chatId: data.chatId,
            senderId: data.senderId,
            senderUsername: data.senderUsername,
            senderAvatarUrl: data.senderAvatarUrl,
            receiverId: data.receiverId,
            text: data.text,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
            read: data.read ?? true
          };
        });

        loaded.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(loaded);
        localStorage.setItem(localKey, JSON.stringify(loaded));
      } catch (err) {
        console.warn('Error loading direct messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, attachedImage]);

  // Mark unread direct message notifications from this friend as read
  useEffect(() => {
    if (!isOpen || !friend || !user) return;
    const unreadDmNotifs = notifications.filter(
      n => (n.type === 'direct_message' || n.type === 'comment_reply') && n.senderId === friend.id && !n.read
    );
    unreadDmNotifs.forEach(n => {
      markAsRead(n.id);
    });
  }, [isOpen, friend, user, notifications, markAsRead]);

  // Compress image helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDimension = 900;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Selecione um formato de imagem válido.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setAttachedImage(compressed);
    } catch {
      pushToast('error', 'Erro ao processar imagem.');
    }
  };

  // Handle screenshot paste (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImage(file);
            setAttachedImage(compressed);
            pushToast('info', 'Print anexado ao chat.');
          } catch {
            pushToast('error', 'Erro ao anexar print.');
          }
          return;
        }
      }
    }
  };

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedImage) || !user || !friend || sending) return;

    const messageText = inputText.trim();
    const messageImage = attachedImage;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: DirectMessage = {
      id: msgId,
      chatId,
      senderId: user.id,
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl,
      receiverId: friend.id,
      text: messageText || undefined,
      imageUrl: messageImage || undefined,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Optimistic UI
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setAttachedImage(null);

    const localKey = `epsync_dm_${chatId}`;
    localStorage.setItem(localKey, JSON.stringify([...messages, newMsg]));

    const firestoreData: Record<string, any> = {
      id: msgId,
      chatId,
      senderId: user.id,
      senderUsername: user.username,
      receiverId: friend.id,
      createdAt: new Date().toISOString(),
      read: false
    };

    if (user.avatarUrl) {
      firestoreData.senderAvatarUrl = user.avatarUrl;
    }
    if (messageText) {
      firestoreData.text = messageText;
    }
    if (messageImage) {
      firestoreData.imageUrl = messageImage;
    }

    setSending(true);
    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'direct_messages', msgId), firestoreData);

        // Dispatch / update generic notification to friend (avoiding multiple notification spam/pollution)
        const notifId = `notif_dm_${friend.id}_from_${user.id}`;
        const notifData: Record<string, any> = {
          id: notifId,
          userId: friend.id,
          type: 'direct_message',
          title: `Mensagem de @${user.username}`,
          message: 'Enviou uma mensagem para você.',
          read: false,
          createdAt: new Date().toISOString(),
          senderId: user.id,
          senderUsername: user.username
        };
        if (user.avatarUrl) {
          notifData.senderAvatarUrl = user.avatarUrl;
        }

        setDoc(doc(db, 'notifications', notifId), notifData).catch(() => {});
      } catch (err) {
        console.error('Error sending direct message to Firestore:', err);
      }
    }
    setSending(false);
  };

  if (!isOpen || !friend || !user) return null;

  const presence = formatLastActive(friend.lastActiveAt);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}
        onClick={onClose}
      >
        <div
          className="st-panel animate-fade-in"
          style={{
            width: '100%',
            maxWidth: '520px',
            height: '620px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-color)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: onViewProfile ? 'pointer' : 'default' }}
              onClick={() => {
                if (onViewProfile) {
                  onClose();
                  onViewProfile(friend.id, friend.username);
                }
              }}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`}
                  alt={friend.username}
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
                {presence.isOnline && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '10px',
                      height: '10px',
                      backgroundColor: 'var(--accent)',
                      borderRadius: '50%',
                      border: '2px solid var(--bg-elevated)'
                    }}
                  />
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  @{friend.username}
                </h3>
                <span style={{ fontSize: '11px', color: presence.isOnline ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {presence.text}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="st-btn-icon"
              style={{ width: '30px', height: '30px', color: 'var(--text-secondary)' }}
              title="Fechar chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'var(--bg-dark)'
            }}
          >
            {loading && messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Carregando histórico...
              </div>
            ) : messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <p style={{ margin: '0 0 6px' }}>Nenhuma mensagem ainda.</p>
                <span style={{ fontSize: '11px' }}>Diga olá ou envie um print para @{friend.username}!</span>
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
                        maxWidth: '80%',
                        padding: msg.imageUrl ? '6px 6px 8px 6px' : '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isMine ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                        border: '1px solid',
                        borderColor: isMine ? 'var(--border-color)' : 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Attached Image */}
                      {msg.imageUrl && (
                        <div
                          style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-xs)', overflow: 'hidden', marginBottom: msg.text ? '6px' : '0' }}
                          onClick={() => setPreviewImage(msg.imageUrl || null)}
                        >
                          <img
                            src={msg.imageUrl}
                            alt="print"
                            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-xs)' }}
                          />
                          <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', padding: '3px', borderRadius: 'var(--radius-xs)' }}>
                            <Maximize2 size={12} color="#fff" />
                          </div>
                        </div>
                      )}

                      {/* Text */}
                      {msg.text && (
                        <div style={{ padding: msg.imageUrl ? '2px 6px' : 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.text}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          textAlign: 'right',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '4px'
                        }}
                      >
                        <span>{time}</span>
                        {isMine && <CheckCheck size={11} color="var(--primary)" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview before send */}
          {attachedImage && (
            <div
              style={{
                padding: '8px 14px',
                background: 'var(--bg-elevated)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={attachedImage}
                  alt="preview"
                  style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-xs)', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Print anexado</span>
              </div>
              <button
                onClick={() => setAttachedImage(null)}
                className="st-btn-icon"
                style={{ width: '24px', height: '24px', color: 'var(--error)' }}
                title="Remover anexo"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Footer Input Bar */}
          <form
            onSubmit={handleSend}
            onPaste={handlePaste}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="st-btn-icon"
              title="Anexar print ou foto"
              style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
            >
              <Paperclip size={16} />
            </button>

            <input
              type="text"
              placeholder="Digite uma mensagem ou cole um print (Ctrl+V)..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              style={{
                flex: 1,
                height: '36px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
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
              style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="Enviar mensagem"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </div>

      {/* Lightbox / Fullscreen image preview */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '20px'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewImage}
              alt="fullscreen preview"
              style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="st-btn-icon"
              style={{ position: 'absolute', top: '-14px', right: '-14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: '32px', height: '32px' }}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
