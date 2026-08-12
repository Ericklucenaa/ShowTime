import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, type NotificationItem } from '../context/NotificationContext.js';
import { Bell, UserPlus, MessageSquare, CheckCheck, Info, MessageCircle } from 'lucide-react';

interface NotificationCenterProps {
  onViewMedia: (id: string, type: 'show' | 'movie', seasonNum?: number, episodeNum?: number) => void;
  onViewProfile?: (userId: string, username: string) => void;
  onOpenChat?: (friend: { id: string; username: string; avatarUrl?: string }) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Agora';
    if (diffSeconds < 3600) return `Há ${Math.floor(diffSeconds / 60)} min`;
    if (diffSeconds < 86400) return `Há ${Math.floor(diffSeconds / 3600)} h`;
    if (diffSeconds < 172800) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return 'Recente';
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onViewMedia,
  onViewProfile,
  onOpenChat
}) => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    browserNotificationPermission, 
    requestNotificationPermission,
    reminders 
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    setIsOpen(false);

    if (notif.type === 'direct_message' && notif.senderId) {
      if (onOpenChat) {
        onOpenChat({
          id: notif.senderId,
          username: notif.senderUsername || 'usuário',
          avatarUrl: notif.senderAvatarUrl
        });
      } else if (onViewProfile) {
        onViewProfile(notif.senderId, notif.senderUsername || 'usuário');
      }
    } else if ((notif.type === 'episode_release' || notif.type === 'episode_reminder') && notif.mediaId) {
      onViewMedia(notif.mediaId, notif.mediaType || 'show', notif.seasonNumber, notif.episodeNumber);
    } else if (notif.type === 'new_follower' && notif.senderId && onViewProfile) {
      onViewProfile(notif.senderId, notif.senderUsername || 'usuário');
    } else if (notif.mediaId) {
      onViewMedia(notif.mediaId, notif.mediaType || 'show');
    }
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'episode_release':
      case 'episode_reminder':
        return <Bell size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
      case 'new_follower':
        return <UserPlus size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
      case 'direct_message':
        return <MessageCircle size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
      case 'comment_reply':
        return <MessageSquare size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
      default:
        return <Info size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="st-btn-icon"
        title="Notificações"
        style={{ position: 'relative', color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        <Bell size={15} />
        
        {/* Count indicator badge when there are unread notifications */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: unreadCount > 9 ? '-6px' : '-3px',
              background: 'var(--primary)',
              color: '#000',
              fontSize: unreadCount > 99 ? '8px' : unreadCount > 9 ? '9px' : '10px',
              fontWeight: 800,
              minWidth: '15px',
              height: '15px',
              padding: unreadCount > 9 ? '0 3.5px' : '0',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 0 0 1.5px var(--bg-surface)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Cascading Notifications Dropdown */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '350px',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Notificações</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'var(--primary)',
                    color: '#000',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-xs)'
                  }}
                >
                  {unreadCount} novas
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 4px'
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Marcar todas como lidas"
              >
                <CheckCheck size={12} />
                Marcar lidas
              </button>
            )}
          </div>

          {/* Browser Notification Permission Prompt */}
          {browserNotificationPermission === 'default' && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(234, 179, 8, 0.08)',
                borderBottom: '1px solid rgba(234, 179, 8, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Receba alertas de episódios no computador
              </div>
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="st-btn-primary"
                style={{ fontSize: '10px', height: '22px', padding: '0 8px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}
              >
                Ativar
              </button>
            </div>
          )}

          {/* Notifications Scrollable List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px'
                }}
              >
                Nenhuma notificação no momento.
                {reminders.length > 0 && (
                  <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--primary)' }}>
                    ✓ {reminders.length} {reminders.length === 1 ? 'lembrete ativo' : 'lembretes ativos'} para lançamentos!
                  </p>
                )}
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    background: notif.read ? 'transparent' : 'rgba(234, 179, 8, 0.04)',
                    transition: 'background var(--transition-fast)'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseOut={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(234, 179, 8, 0.04)'}
                >
                  <div style={{ marginTop: '2px' }}>
                    {renderIcon(notif.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: notif.read ? 600 : 700, color: 'var(--text-primary)' }}>
                        {notif.title}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.35',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {notif.type === 'direct_message' ? 'Enviou uma mensagem para você.' : notif.message}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        marginTop: '6px',
                        flexShrink: 0
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};


