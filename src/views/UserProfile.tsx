import React, { useState, useEffect } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore/lite';
import { getImageUrl, fetchMediaDetails } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { ArrowLeft, UserCheck, UserPlus, Tv, Star, Eye } from 'lucide-react';

interface UserProfileProps {
  targetUserId: string;
  targetUsername: string;
  onBack: () => void;
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ targetUserId, targetUsername, onBack, onViewMedia }) => {
  const { followedUsers, toggleFollowUser } = useTracking();
  const [profileData, setProfileData] = useState<any>(null);
  const [watchedShows, setWatchedShows] = useState<any[]>([]);
  const [followedShowsList, setFollowedShowsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'watched' | 'following'>('watched');

  const isFollowed = followedUsers.includes(targetUserId);

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
            if (show) followedDetails.push(show);
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <button
        onClick={onBack}
        className="btn-secondary"
        style={{ border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 0', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        Voltar à Busca
      </button>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <img
          src={profile.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.username}`}
          alt={profile.username}
          style={{ width: '90px', height: '90px', borderRadius: '50%', border: '3px solid var(--primary)', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '6px' }}>
            {profile.username}
          </h2>
          <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--text-primary)' }}>{watchedShows.length}</strong> séries assistidas</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{followedShowsList.length}</strong> séries seguindo</span>
          </div>
        </div>
        <button
          className={isFollowed ? 'btn-secondary' : 'btn-primary'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', flexShrink: 0 }}
          onClick={() => toggleFollowUser(targetUserId)}
        >
          {isFollowed ? <UserCheck size={16} /> : <UserPlus size={16} />}
          {isFollowed ? 'Seguindo' : 'Seguir'}
        </button>
      </div>

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
    </div>
  );
};
