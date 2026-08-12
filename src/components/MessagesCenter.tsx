import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { useNotifications } from '../context/NotificationContext.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, getDoc } from 'firebase/firestore/lite';
import { MessageCircle, Search } from 'lucide-react';

interface ChatFriend {
  id: string;
  username: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface MessagesCenterProps {
  onOpenChat: (friend: { id: string; username: string; avatarUrl?: string; lastActiveAt?: string }) => void;
  onViewProfile?: (userId: string, username: string) => void;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Agora';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    if (diffSeconds < 172800) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export const MessagesCenter: React.FC<MessagesCenterProps> = ({ onOpenChat }) => {
  const { user } = useAuth();
  const { followedUsers } = useTracking();
  const { notifications, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<ChatFriend[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter direct message notifications specifically
  const directMessageNotifications = useMemo(() => {
    return notifications.filter(n => n.type === 'direct_message');
  }, [notifications]);

  const totalUnreadMessages = useMemo(() => {
    return directMessageNotifications.filter(n => !n.read).length;
  }, [directMessageNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Load conversations when opening dropdown or when user/followedUsers change
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      setLoading(true);

      // Default mock if Firebase not enabled
      if (!isFirebaseEnabled || !db) {
        setFriendsList([
          {
            id: 'mock1',
            username: 'joaosilva',
            avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=joaosilva`,
            lastMessage: 'Já assistiu o episódio 3?',
            lastMessageTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            unreadCount: 1
          },
          {
            id: 'mock2',
            username: 'mariaclara',
            avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=mariaclara`,
            lastMessage: 'Adicionei aquela série na minha lista!',
            lastMessageTime: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
            lastActiveAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            unreadCount: 0
          }
        ]);
        setLoading(false);
        return;
      }

      try {
        const loaded: ChatFriend[] = [];
        
        for (const uid of followedUsers) {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', uid));
            const username = userDoc.exists() ? userDoc.data().username : 'Usuário';
            const avatarUrl = userDoc.exists() ? (userDoc.data().avatarUrl || userDoc.data().photoUrl) : undefined;
            const lastActiveAt = userDoc.exists() ? userDoc.data().lastActiveAt : undefined;

            // Check cached messages or firestore for last snippet
            const chatId = [user.id, uid].sort().join('_');
            const cachedKey = `epsync_dm_${chatId}`;
            const legacyKey = `showtime_dm_${chatId}`;
            const rawCached = localStorage.getItem(cachedKey) || localStorage.getItem(legacyKey);
            
            let lastMessage = '';
            let lastMessageTime = '';

            if (rawCached) {
              try {
                const parsed = JSON.parse(rawCached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const last = parsed[parsed.length - 1];
                  lastMessage = last.text || (last.imageUrl ? '📷 Imagem' : '');
                  lastMessageTime = last.createdAt;
                }
              } catch (_) {}
            }

            // Unread count from direct message notifications
            const unreadCount = directMessageNotifications.filter(
              n => (n.senderId === uid || (n as any).data?.senderId === uid) && !n.read
            ).length;

            loaded.push({
              id: uid,
              username,
              avatarUrl,
              lastActiveAt,
              lastMessage: lastMessage || 'Iniciar conversa...',
              lastMessageTime,
              unreadCount
            });
          } catch (err) {
            console.warn('Error loading friend for messages:', err);
          }
        }

        // Sort by last message time or username
        loaded.sort((a, b) => {
          if (a.lastMessageTime && b.lastMessageTime) {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          }
          if (a.lastMessageTime) return -1;
          if (b.lastMessageTime) return 1;
          return a.username.localeCompare(b.username);
        });

        setFriendsList(loaded);
      } catch (e) {
        console.error('Error loading conversations:', e);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [user, followedUsers, isOpen, directMessageNotifications]);

  const filteredFriends = useMemo(() => {
    if (!searchFilter.trim()) return friendsList;
    const q = searchFilter.toLowerCase();
    return friendsList.filter(f => f.username.toLowerCase().includes(q));
  }, [friendsList, searchFilter]);

  const handleSelectFriend = (friend: ChatFriend) => {
    // Mark unread messages from this friend as read
    const unreadFromThisFriend = directMessageNotifications.filter(
      n => (n.senderId === friend.id || (n as any).data?.senderId === friend.id) && !n.read
    );
    unreadFromThisFriend.forEach(n => markAsRead(n.id));

    setIsOpen(false);
    onOpenChat({
      id: friend.id,
      username: friend.username,
      avatarUrl: friend.avatarUrl,
      lastActiveAt: friend.lastActiveAt
    });
  };

  return (
    <div className="messages-center-wrapper" ref={containerRef} style={{ position: 'relative' }}>
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="st-btn-icon"
        style={{
          position: 'relative',
          color: totalUnreadMessages > 0 || isOpen ? 'var(--primary)' : 'var(--text-secondary)',
          borderColor: totalUnreadMessages > 0 || isOpen ? 'rgba(124, 92, 255, 0.3)' : 'var(--border-color)',
          background: isOpen ? 'var(--bg-elevated)' : 'var(--bg-surface)'
        }}
        title="Mensagens & Conversas"
        aria-label="Abrir Mensagens"
      >
        <MessageCircle size={15} />
        {totalUnreadMessages > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: totalUnreadMessages > 9 ? '-6px' : '-3px',
              background: 'var(--secondary)',
              color: '#FFFFFF',
              fontSize: totalUnreadMessages > 99 ? '8px' : totalUnreadMessages > 9 ? '9px' : '10px',
              fontWeight: 800,
              minWidth: '15px',
              height: '15px',
              padding: totalUnreadMessages > 9 ? '0 3.5px' : '0',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 0 0 1.5px var(--bg-surface)'
            }}
          >
            {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
          </span>
        )}
      </button>

      {/* Cascading Messenger Dropdown */}
      {isOpen && (
        <div
          className="st-panel animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '360px',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Mensagens
              </span>
              {totalUnreadMessages > 0 && (
                <span style={{ fontSize: '11px', background: 'var(--secondary)', color: '#FFFFFF', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                  {totalUnreadMessages} novas
                </span>
              )}
            </div>
          </div>

          {/* Search bar within messages */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-dark)' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', padding: '6px 10px', gap: '8px' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Conversations List */}
          <div
            style={{
              maxHeight: '360px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '4px 0'
            }}
          >
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Carregando conversas...
              </div>
            ) : filteredFriends.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <MessageCircle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Nenhuma conversa encontrada
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Siga amigos na aba <strong>Amigos</strong> para iniciar bate-papos!
                </p>
              </div>
            ) : (
              filteredFriends.map(friend => {
                const isOnline = friend.lastActiveAt 
                  ? (Date.now() - new Date(friend.lastActiveAt).getTime()) < 5 * 60 * 1000 
                  : false;
                const hasUnread = (friend.unreadCount || 0) > 0;

                return (
                  <div
                    key={friend.id}
                    onClick={() => handleSelectFriend(friend)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      borderLeft: hasUnread ? '3px solid var(--secondary)' : '3px solid transparent',
                      background: hasUnread ? 'rgba(255, 122, 89, 0.06)' : 'transparent',
                      position: 'relative'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      if (!hasUnread) e.currentTarget.style.borderLeftColor = 'var(--primary)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = hasUnread ? 'rgba(255, 122, 89, 0.06)' : 'transparent';
                      if (!hasUnread) e.currentTarget.style.borderLeftColor = 'transparent';
                    }}
                  >
                    {/* Avatar with active dot */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`}
                        alt={friend.username}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'var(--bg-dark)',
                          border: '1px solid var(--border-color)',
                          objectFit: 'cover'
                        }}
                      />
                      {isOnline && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '0px',
                            right: '0px',
                            width: '11px',
                            height: '11px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            border: '2px solid var(--bg-surface)'
                          }}
                          title="Online agora"
                        />
                      )}
                    </div>

                    {/* Friend metadata & snippet */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: hasUnread ? 700 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{friend.username}
                        </span>
                        {friend.lastMessageTime && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>
                            {formatRelativeTime(friend.lastMessageTime)}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <p style={{
                          fontSize: '12px',
                          color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: hasUnread ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          margin: 0
                        }}>
                          {friend.lastMessage}
                        </p>
                        {hasUnread ? (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary)', flexShrink: 0 }} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-dark)',
              textAlign: 'center',
              fontSize: '12px'
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              Conversas diretas em tempo real
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
