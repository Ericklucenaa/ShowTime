import React, { useState, useEffect } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, getDoc } from 'firebase/firestore/lite';
import { useTracking } from '../context/TrackingContext.js';
import { useAuth } from '../context/AuthContext.js';
import { X, Search, UserCheck, UserPlus, Users } from 'lucide-react';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'following' | 'followers';
  followingIds: string[];
  followersIds: string[];
  onViewProfile?: (userId: string, username: string) => void;
}

interface UserProfileSummary {
  id: string;
  username: string;
  avatarUrl?: string;
  profileVisibility?: string;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'following',
  followingIds,
  followersIds,
  onViewProfile
}) => {
  const { user: currentUser } = useAuth();
  const { followedUsers, toggleFollowUser } = useTracking();
  const [tab, setTab] = useState<'following' | 'followers'>(initialTab);
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Record<string, UserProfileSummary>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, isOpen]);

  // Load profiles for both following and followers
  useEffect(() => {
    if (!isOpen) return;

    const allIds = Array.from(new Set([...followingIds, ...followersIds]));
    if (allIds.length === 0) return;

    const loadProfiles = async () => {
      setLoading(true);
      const loaded: Record<string, UserProfileSummary> = { ...profiles };

      if (isFirebaseEnabled && db) {
        try {
          // Check IDs that are not loaded yet
          const idsToFetch = allIds.filter(id => !loaded[id]);
          if (idsToFetch.length > 0) {
            // Fetch individually or via profiles collection
            for (const uid of idsToFetch.slice(0, 50)) {
              try {
                const snap = await getDoc(doc(db, 'profiles', uid));
                if (snap.exists()) {
                  const d = snap.data();
                  loaded[uid] = {
                    id: uid,
                    username: d.username || uid,
                    avatarUrl: d.avatarUrl || d.photoUrl,
                    profileVisibility: d.profileVisibility
                  };
                } else {
                  loaded[uid] = {
                    id: uid,
                    username: uid.substring(0, 8),
                    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`
                  };
                }
              } catch (_) {
                loaded[uid] = {
                  id: uid,
                  username: uid.substring(0, 8),
                  avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`
                };
              }
            }
          }
        } catch (err) {
          console.warn('Error loading follow list profiles:', err);
        }
      }

      setProfiles(loaded);
      setLoading(false);
    };

    loadProfiles();
  }, [isOpen, followingIds.join(','), followersIds.join(',')]);

  if (!isOpen) return null;

  const currentIds = tab === 'following' ? followingIds : followersIds;
  const filteredList = currentIds
    .map(id => profiles[id] || {
      id,
      username: id.substring(0, 8),
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${id}`
    })
    .filter(u => !search.trim() || u.username.toLowerCase().includes(search.trim().toLowerCase()));

  const handleUserClick = (u: UserProfileSummary) => {
    onClose();
    if (onViewProfile) {
      onViewProfile(u.id, u.username);
    }
  };

  return (
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
          maxWidth: '460px',
          maxHeight: '85vh',
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
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setTab('following')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: tab === 'following' ? 600 : 500,
                background: tab === 'following' ? 'var(--bg-elevated)' : 'transparent',
                color: tab === 'following' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer'
              }}
            >
              Seguindo ({followingIds.length})
            </button>
            <button
              onClick={() => setTab('followers')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: tab === 'followers' ? 600 : 500,
                background: tab === 'followers' ? 'var(--bg-elevated)' : 'transparent',
                color: tab === 'followers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer'
              }}
            >
              Seguidores ({followersIds.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="st-btn-icon"
            style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search inside list */}
        {currentIds.length > 5 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '32px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 12px 0 30px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Users List */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', padding: '8px 12px' }}>
          {loading && Object.keys(profiles).length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Carregando lista...
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Users size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              {tab === 'following' ? 'Você ainda não está seguindo ninguém.' : 'Nenhum seguidor encontrado.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredList.map(u => {
                const isMe = currentUser?.id === u.id;
                const isUserFollowed = followedUsers.includes(u.id);

                return (
                  <div
                    key={u.id}
                    className="st-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {/* User info */}
                    <div
                      onClick={() => handleUserClick(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                    >
                      <img
                        src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                        alt={u.username}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          @{u.username}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleUserClick(u)}
                        className="st-btn-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        Ver Perfil
                      </button>

                      {!isMe && (
                        <button
                          onClick={() => toggleFollowUser(u.id)}
                          className={isUserFollowed ? 'st-btn-secondary' : 'st-btn-primary'}
                          style={{
                            height: '28px',
                            padding: '0 10px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isUserFollowed ? <UserCheck size={12} /> : <UserPlus size={12} />}
                          {isUserFollowed ? 'Seguindo' : 'Seguir'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
