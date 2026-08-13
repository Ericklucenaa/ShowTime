import React, { useState, useEffect } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore/lite';
import { getImageUrl, fetchMediaDetails } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { useAuth } from '../context/AuthContext.js';
import { ArrowLeft, UserCheck, UserPlus, Tv, Star, Eye, Lock, Users, MessageSquare } from 'lucide-react';

interface UserProfileProps {
  targetUserId: string;
  targetUsername: string;
  onBack: () => void;
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
  onViewProfile?: (userId: string, username: string) => void;
  onOpenChat?: (friend: { id: string; username: string; avatarUrl?: string; lastActiveAt?: string }) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  targetUserId, 
  targetUsername, 
  onBack, 
  onViewMedia, 
  onOpenChat 
}) => {
  const { user } = useAuth();
  const { followedUsers, toggleFollowUser, isMutualFollow, isUserBlocked } = useTracking();
  const [profileData, setProfileData] = useState<any>(null);
  const [watchedShows, setWatchedShows] = useState<any[]>([]);
  const [followedShowsList, setFollowedShowsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'watched' | 'following'>('watched');

  const isFollowed = followedUsers.includes(targetUserId);
  const isMutual = isMutualFollow(targetUserId);
  const isBlockedByMe = isUserBlocked(targetUserId);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        if (!isFirebaseEnabled || !db) {
          setLoading(false);
          return;
        }

        // Load profile doc
        const profileSnap = await getDoc(doc(db, 'profiles', targetUserId));
        if (profileSnap.exists()) {
          setProfileData(profileSnap.data());
        } else {
          setProfileData({ username: targetUsername, id: targetUserId });
        }

        // Load watched episodes → unique shows
        const epSnap = await getDocs(
          query(collection(db, 'watch_episodes'), where('userId', '==', targetUserId))
        );
        const showIds = Array.from(new Set(epSnap.docs.map(d => d.data().showId as string)));

        // Load show details
        const showDetails: any[] = [];
        for (const sid of showIds.slice(0, 30)) {
          try {
            const show = await fetchMediaDetails(sid, 'show');
            if (show) showDetails.push(show);
          } catch (_) {}
        }
        setWatchedShows(showDetails);

        // Load followed shows
        const followSnap = await getDocs(
          query(collection(db, 'followed_shows'), where('userId', '==', targetUserId))
        );
        const followedIds = followSnap.docs.map(d => d.data().showId as string);
        const followedDetails: any[] = [];
        for (const sid of followedIds.slice(0, 30)) {
          try {
            const show = await fetchMediaDetails(sid, 'show');
            if (show) showDetails.push(show);
          } catch (_) {}
        }
        setFollowedShowsList(followedDetails);
      } catch (e) {
        console.error('Failed to load user profile:', e);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Carregando perfil...
      </div>
    );
  }

  if (!isFirebaseEnabled) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Perfis públicos requerem conexão com Firebase.</p>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '16px' }}>Voltar</button>
      </div>
    );
  }

  const profile = profileData || { username: targetUsername, id: targetUserId };
  const visibility = profile.profileVisibility || 'public';
  const isOwnProfile = user?.id === targetUserId;
  const viewerFollowsTarget = followedUsers.includes(targetUserId);

  // Privacy gate
  const isBlocked = !isOwnProfile && (
    visibility === 'private' ||
    (visibility === 'friends' && !viewerFollowsTarget)
  );

  const bannerBackground = profile.bannerUrl 
    ? profile.bannerUrl 
    : 'linear-gradient(135deg, rgba(124,92,255,0.35) 0%, rgba(255,122,89,0.2) 100%)';

  return (
    <div className="profile-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Header Back Button */}
      <button
        onClick={onBack}
        className="st-btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
      >
        <ArrowLeft size={16} />
        Voltar
      </button>

      {/* Banner & Avatar Container (Unclipped & Responsive) */}
      <div style={{ position: 'relative', marginBottom: '45px' }}>
        
        {/* Inner Banner with overflow: hidden */}
        <div style={{ 
          position: 'relative', 
          height: 'clamp(150px, 28vw, 240px)', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden', 
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: bannerBackground }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }} />
        </div>

        {/* Avatar Positioned Outside overflow: hidden */}
        <div style={{ position: 'absolute', bottom: '-38px', left: '20px', zIndex: 10 }}>
          <div
            style={{ 
              position: 'relative', 
              borderRadius: '50%', 
              width: '86px', 
              height: '86px', 
              border: '4px solid var(--bg-dark)', 
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              background: 'var(--bg-surface)',
              overflow: 'hidden'
            }}
          >
            <img
              src={profile.avatarUrl || profile.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.username}`}
              alt={profile.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>

      {/* Username + actions row */}
      <div className="profile-header-info" style={{ paddingLeft: '125px', paddingRight: '16px', minHeight: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>
              @{profile.username}
            </h2>
            {isMutual && !isOwnProfile && (
              <span style={{ fontSize: '11px', background: 'rgba(124, 92, 255, 0.14)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '1px solid rgba(124,92,255,0.25)' }}>
                Amigo Mútuo
              </span>
            )}
            {visibility === 'private' && (
              <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '3px 10px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Lock size={11} /> Privado
              </span>
            )}
            {visibility === 'friends' && (
              <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Users size={11} /> Apenas Amigos
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <img src="/logo.png" alt="Epsync" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Membro Epsync</span>
          </div>

          {!isBlocked && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{watchedShows.length}</strong> séries assistidas</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{followedShowsList.length}</strong> séries seguindo</span>
            </div>
          )}
        </div>

        {!isOwnProfile && (
          <div className="profile-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onOpenChat && isMutual && !isBlockedByMe && (
              <button
                className="st-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}
                onClick={() => onOpenChat({
                  id: targetUserId,
                  username: profile.username || targetUsername,
                  avatarUrl: profile.avatarUrl || profile.photoUrl,
                  lastActiveAt: profile.lastActiveAt
                })}
              >
                <MessageSquare size={16} />
                Conversar
              </button>
            )}
            <button
              className={isFollowed ? 'st-btn-secondary' : 'st-btn-primary'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}
              onClick={() => toggleFollowUser(targetUserId)}
            >
              {isFollowed ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {isFollowed ? 'Seguindo' : 'Seguir'}
            </button>
          </div>
        )}
      </div>

      {/* Privacy gate */}
      {isBlocked ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Lock size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Perfil {visibility === 'private' ? 'Privado' : 'Restrito a Amigos'}</h3>
          <p style={{ fontSize: '14px' }}>
            {visibility === 'private'
              ? 'Este usuário mantém o perfil privado.'
              : 'Siga este usuário para ver o conteúdo do perfil.'}
          </p>
        </div>
      ) : (
        <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('watched')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 20px', fontSize: '14px', fontWeight: 600,
            color: activeTab === 'watched' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'watched' ? '2px solid var(--primary)' : '2px solid transparent',
            transition: 'color 0.2s, border-color 0.2s'
          }}
        >
          <Eye size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Assistidas ({watchedShows.length})
        </button>
        <button
          onClick={() => setActiveTab('following')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 20px', fontSize: '14px', fontWeight: 600,
            color: activeTab === 'following' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'following' ? '2px solid var(--primary)' : '2px solid transparent',
            transition: 'color 0.2s, border-color 0.2s'
          }}
        >
          <Tv size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Seguindo ({followedShowsList.length})
        </button>
      </div>

      {/* Shows Grid */}
      {activeTab === 'watched' && (
        watchedShows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <Eye size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Este usuário ainda não marcou séries como assistidas.</p>
          </div>
        ) : (
          <div className="grid-media">
            {watchedShows.map(show => (
              <div
                key={show.id}
                className="glass-card glow-hover"
                onClick={() => onViewMedia(show.id, 'show')}
                style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
                  <img
                    src={getImageUrl(show.posterPath)}
                    alt={show.title}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {show.rating > 0 && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 7px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 'bold' }}>
                      <Star size={11} fill="var(--warning)" color="var(--warning)" />
                      {show.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {show.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'following' && (
        followedShowsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <Tv size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Este usuário não está seguindo nenhuma série.</p>
          </div>
        ) : (
          <div className="grid-media">
            {followedShowsList.map(show => (
              <div
                key={show.id}
                className="glass-card glow-hover"
                onClick={() => onViewMedia(show.id, 'show')}
                style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
                  <img
                    src={getImageUrl(show.posterPath)}
                    alt={show.title}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: '10px' }}>
                  <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {show.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )
      )}
        </>
      )}
    </div>
  );
};
