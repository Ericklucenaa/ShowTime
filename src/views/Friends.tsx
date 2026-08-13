import React, { useEffect, useState } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { useAuth, formatLastActive } from '../context/AuthContext.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore/lite';
import { Search, UserPlus, UserCheck, Lock, MessageSquare } from 'lucide-react';
import { trackEvent } from '../services/telemetry.js';

interface FriendsProps {
  onViewProfile?: (userId: string, username: string) => void;
  onOpenChat?: (friend: { id: string; username: string; avatarUrl?: string; lastActiveAt?: string }) => void;
}

export const Friends: React.FC<FriendsProps> = ({ onViewProfile, onOpenChat }) => {
  const { user } = useAuth();
  const { followedUsers, toggleFollowUser, isMutualFollow, isUserBlocked } = useTracking();
  const [activeTab, setActiveTab] = useState<'my_friends' | 'search'>('my_friends');
  
  // Followed friends state
  const [friendsData, setFriendsData] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Load followed friends
  useEffect(() => {
    const loadFriends = async () => {
      setLoadingFriends(true);
      if (!isFirebaseEnabled || !db) {
        setFriendsData([
          { id: 'mock1', username: 'joaosilva', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=joaosilva`, lastActiveAt: new Date(Date.now() - 60000).toISOString() },
          { id: 'mock2', username: 'mariaclara', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=mariaclara`, lastActiveAt: new Date(Date.now() - 7200000).toISOString() }
        ]);
        setLoadingFriends(false);
        return;
      }

      try {
        const results = await Promise.allSettled(
          followedUsers.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'profiles', uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              return {
                id: uid,
                username: data.username,
                avatarUrl: data.avatarUrl || data.photoUrl,
                lastActiveAt: data.lastActiveAt
              };
            } else {
              return {
                id: uid,
                username: 'Usuário',
                avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
                lastActiveAt: undefined
              };
            }
          })
        );
        const loaded = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
        setFriendsData(loaded);
      } catch (e) {
        console.error("Error loading friends:", e);
      } finally {
        setLoadingFriends(false);
      }
    };

    loadFriends();
  }, [followedUsers]);

  // Search users across Firestore profiles
  useEffect(() => {
    if (activeTab !== 'search') return;

    const trimmed = searchQuery.trim().toLowerCase();
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (isFirebaseEnabled && db) {
          const snap = await getDocs(collection(db, 'profiles'));
          const allProfiles = snap.docs.map(d => d.data());
          
          let filtered = allProfiles.filter(p => p.id !== user?.id && p.profileVisibility !== 'private');

          if (trimmed.length > 0) {
            filtered = filtered.filter(p => {
              const uLower = (p.usernameLower || p.username || '').toLowerCase();
              return uLower.includes(trimmed);
            });
          }

          setSearchResults(filtered.slice(0, 30));
          if (trimmed.length > 0) {
            trackEvent('friends_search_query', { queryLength: trimmed.length, results: filtered.length });
          }
        } else {
          // Local/mock search
          const mockUsers = [
            { id: 'mock1', username: 'joaosilva', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=joaosilva` },
            { id: 'mock2', username: 'mariaclara', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=mariaclara` },
            { id: 'mock3', username: 'carlos_edu', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=carlos_edu` },
            { id: 'mock4', username: 'ana_beatriz', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=ana_beatriz` }
          ].filter(u => u.id !== user?.id);

          if (trimmed.length > 0) {
            setSearchResults(mockUsers.filter(u => u.username.toLowerCase().includes(trimmed)));
          } else {
            setSearchResults(mockUsers);
          }
        }
      } catch (err) {
        console.error('Error searching friends:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, user?.id]);

  return (
    <div className="friends-view animate-fade-in" style={{ paddingBottom: '32px' }}>
      
      {/* Header & Sub-Tabs */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>
          {activeTab === 'my_friends' ? 'Meus Amigos' : 'Procurar Amigos'}
        </h2>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('my_friends')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: activeTab === 'my_friends' ? 600 : 500,
              background: activeTab === 'my_friends' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'my_friends' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer'
            }}
          >
            Meus Amigos ({followedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: activeTab === 'search' ? 600 : 500,
              background: activeTab === 'search' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'search' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={12} />
            Procurar Amigos
          </button>
        </div>
      </div>

      {/* Tab 1: My Friends */}
      {activeTab === 'my_friends' && (
        <div>
          {loadingFriends ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Carregando lista de amigos...
            </div>
          ) : friendsData.length === 0 ? (
            <div className="st-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <p style={{ marginBottom: '16px' }}>Você ainda não está seguindo nenhum amigo.</p>
              <button
                onClick={() => setActiveTab('search')}
                className="st-btn-primary"
                style={{ fontSize: '12px', height: '32px' }}
              >
                <Search size={13} />
                Procurar amigos
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {friendsData.map(friend => {
                const presence = formatLastActive(friend.lastActiveAt);
                const isMutual = isMutualFollow(friend.id);
                const isBlocked = isUserBlocked(friend.id);

                return (
                  <div 
                    key={friend.id} 
                    className="st-card" 
                    style={{ display: 'flex', padding: '12px 16px', alignItems: 'center', gap: '14px' }} 
                  >
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`}
                        alt={friend.username}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1px solid var(--border-color)', flexShrink: 0, cursor: 'pointer', objectFit: 'cover' }}
                        onClick={() => onViewProfile?.(friend.id, friend.username)}
                      />
                      {presence.isOnline && !isBlocked && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '10px',
                            height: '10px',
                            backgroundColor: 'var(--accent)',
                            borderRadius: '50%',
                            border: '2px solid var(--bg-surface)'
                          }}
                          title="Online agora"
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 
                          style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => onViewProfile?.(friend.id, friend.username)}
                        >
                          @{friend.username}
                        </h4>
                        {isMutual && (
                          <span style={{ fontSize: '10px', background: 'rgba(124, 92, 255, 0.12)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 600 }}>
                            Mútuo
                          </span>
                        )}
                        {isBlocked && (
                          <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 600 }}>
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: presence.isOnline ? 'var(--accent)' : 'var(--text-muted)' }}>
                        <span>{presence.text}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      {/* Chat Button ONLY appears if both follow each other and not blocked */}
                      {onOpenChat && isMutual && !isBlocked && (
                        <button
                          className="st-btn-primary"
                          style={{ fontSize: '12px', height: '30px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => onOpenChat(friend)}
                          title="Abrir chat direto"
                        >
                          <MessageSquare size={13} />
                          Conversar
                        </button>
                      )}
                      <button
                        className="st-btn-secondary"
                        style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
                        onClick={() => onViewProfile?.(friend.id, friend.username)}
                      >
                        Ver Perfil
                      </button>
                      <button
                        className="st-btn-secondary"
                        style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
                        onClick={() => toggleFollowUser(friend.id)}
                        title="Deixar de seguir"
                      >
                        <UserCheck size={13} />
                        Seguindo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Search Friends */}
      {activeTab === 'search' && (
        <div>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              autoFocus
              placeholder="Buscar amigos por nome de usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px 0 36px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            {searching && (
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Buscando...
              </span>
            )}
          </div>

          {/* Results List */}
          {searching && searchResults.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Pesquisando usuários...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Nenhum usuário encontrado para "{searchQuery}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map((userResult) => {
                const isFollowed = followedUsers.includes(userResult.id);
                const isMutual = isMutualFollow(userResult.id);
                const isBlocked = isUserBlocked(userResult.id);
                const presence = formatLastActive(userResult.lastActiveAt);

                return (
                  <div
                    key={userResult.id}
                    className="st-card"
                    style={{ display: 'flex', padding: '12px 16px', alignItems: 'center', gap: '14px' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={userResult.avatarUrl || userResult.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userResult.username}`}
                        alt={userResult.username}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1px solid var(--border-color)', flexShrink: 0, cursor: 'pointer', objectFit: 'cover' }}
                        onClick={() => onViewProfile?.(userResult.id, userResult.username)}
                      />
                      {presence.isOnline && !isBlocked && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '10px',
                            height: '10px',
                            backgroundColor: 'var(--accent)',
                            borderRadius: '50%',
                            border: '2px solid var(--bg-surface)'
                          }}
                          title="Online agora"
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 
                          style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => onViewProfile?.(userResult.id, userResult.username)}
                        >
                          @{userResult.username}
                        </h4>
                        {isMutual && (
                          <span style={{ fontSize: '10px', background: 'rgba(124, 92, 255, 0.12)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 600 }}>
                            Mútuo
                          </span>
                        )}
                        {userResult.profileVisibility === 'friends' && (
                          <span style={{ fontSize: '10px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: 'var(--radius-xs)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Lock size={9} /> Amigos
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: presence.isOnline ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {presence.text}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      {/* Chat Button ONLY appears if both follow each other and not blocked */}
                      {onOpenChat && isMutual && !isBlocked && (
                        <button
                          className="st-btn-secondary"
                          style={{ fontSize: '12px', height: '30px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => onOpenChat({
                            id: userResult.id,
                            username: userResult.username,
                            avatarUrl: userResult.avatarUrl || userResult.photoUrl,
                            lastActiveAt: userResult.lastActiveAt
                          })}
                        >
                          <MessageSquare size={13} />
                          Chat
                        </button>
                      )}
                      <button
                        className="st-btn-secondary"
                        style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
                        onClick={() => onViewProfile?.(userResult.id, userResult.username)}
                      >
                        Ver Perfil
                      </button>
                      <button
                        className={isFollowed ? 'st-btn-secondary' : 'st-btn-primary'}
                        style={{ fontSize: '12px', height: '30px', padding: '0 12px' }}
                        onClick={() => toggleFollowUser(userResult.id)}
                      >
                        {isFollowed ? (
                          <>
                            <UserCheck size={13} />
                            Seguindo
                          </>
                        ) : (
                          <>
                            <UserPlus size={13} />
                            Seguir
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
