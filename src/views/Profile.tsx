import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { BarChart3, LogOut, Camera, Upload, Globe, Users, Lock, Tv, Film, Heart, Image as ImageIcon, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';

interface ProfileProps {
  onViewMedia?: (id: string, type: 'show' | 'movie') => void;
  onViewProfile?: (userId: string, username: string) => void;
}

export const Profile: React.FC<ProfileProps> = ({ onViewMedia }) => {
  const { user, logout, updateAvatar, updateBanner, updatePrivacy, error: authError } = useAuth();
  const { watchedEpisodes, watchedMovies, genreCounts, totalGenresCount, followedShows } = useTracking();

  const [followedShowsData, setFollowedShowsData] = useState<any[]>([]);
  const [watchedMoviesData, setWatchedMoviesData] = useState<any[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(false);

  // Avatar & Banner Picker States
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [customBannerUrl, setCustomBannerUrl] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const devicePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const deviceBannerInputRef = useRef<HTMLInputElement | null>(null);
  const showsScrollRef = useRef<HTMLDivElement | null>(null);
  const moviesScrollRef = useRef<HTMLDivElement | null>(null);

  const avatarPresets = [
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_1`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_2`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_3`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_4`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_5`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_6`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_7`
  ];

  const bannerPresets = [
    { name: 'Violet Cyber', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Neon Anime', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Deep Space', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Sunset Horizon', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Dark Flow', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Purple Waves', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80' }
  ];

  const handleSelectAvatar = async (url: string) => {
    setAvatarLoading(true);
    const success = await updateAvatar(url);
    if (success) {
      setShowAvatarPicker(false);
      pushToast('success', 'Foto de perfil atualizada.');
    } else {
      pushToast('error', authError || 'Não foi possível atualizar a foto de perfil.');
    }
    setAvatarLoading(false);
  };

  const handleSelectBanner = async (url: string) => {
    setBannerLoading(true);
    const success = await updateBanner(url);
    if (success) {
      setShowBannerPicker(false);
      pushToast('success', 'Capa do perfil atualizada com sucesso.');
    } else {
      pushToast('error', authError || 'Não foi possível atualizar a capa.');
    }
    setBannerLoading(false);
  };

  const handleDevicePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Selecione um arquivo de imagem válido.');
      return;
    }

    setAvatarLoading(true);
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 160;
          const ctx = canvas.getContext('2d')!;
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 160, 160);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const success = await updateAvatar(compressed);
      pushToast(success ? 'success' : 'error', success ? 'Foto atualizada com sucesso.' : 'Não foi possível atualizar a foto de perfil.');
      if (success) setShowAvatarPicker(false);
    } catch {
      pushToast('error', 'Erro ao processar imagem.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleDeviceBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Selecione um arquivo de imagem válido.');
      return;
    }

    setBannerLoading(true);
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 900;
          canvas.height = 300;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 900, 300);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const success = await updateBanner(compressed);
      pushToast(success ? 'success' : 'error', success ? 'Capa atualizada com sucesso.' : 'Não foi possível atualizar a capa.');
      if (success) setShowBannerPicker(false);
    } catch {
      pushToast('error', 'Erro ao processar imagem da capa.');
    } finally {
      setBannerLoading(false);
    }
  };

  const totalEpTime = watchedEpisodes.length * 40;
  const totalMovTime = watchedMovies.length * 110;
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const totalDays = (totalHours / 24).toFixed(1);

  const handlePrivacyChange = async (v: 'public' | 'friends' | 'private') => {
    if (v === user?.profileVisibility) return;
    setPrivacyLoading(true);
    const ok = await updatePrivacy(v);
    pushToast(ok ? 'success' : 'error', ok ? 'Privacidade atualizada.' : 'Erro ao atualizar privacidade.');
    setPrivacyLoading(false);
  };

  // Load followed shows details
  useEffect(() => {
    if (!followedShows.length) { setFollowedShowsData([]); return; }
    let cancelled = false;
    setLoadingShows(true);
    (async () => {
      const results = await Promise.allSettled(
        followedShows.slice(0, 30).map(id => fetchMediaDetails(id, 'show'))
      );
      if (cancelled) return;
      const shows = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
      setFollowedShowsData(shows);
      setLoadingShows(false);
    })();
    return () => { cancelled = true; };
  }, [followedShows.join(',')]);

  // Load watched movies details and merge with saved posterPath
  useEffect(() => {
    if (!watchedMovies.length) { setWatchedMoviesData([]); return; }
    let cancelled = false;
    setLoadingMovies(true);

    // Initial instant mapping from stored tracking state
    const initialList = watchedMovies.map(m => ({
      movieId: m.movieId,
      title: m.movieTitle || 'Filme',
      posterPath: m.posterPath,
      isFavorite: m.isFavorite,
      watchedAt: m.watchedAt
    }));
    setWatchedMoviesData(initialList);

    (async () => {
      const results = await Promise.allSettled(
        watchedMovies.slice(0, 35).map(async (m) => {
          if (m.posterPath) {
            return {
              movieId: m.movieId,
              title: m.movieTitle || 'Filme',
              posterPath: m.posterPath,
              isFavorite: m.isFavorite,
              watchedAt: m.watchedAt
            };
          }
          const detail = await fetchMediaDetails(m.movieId, 'movie');
          return {
            movieId: m.movieId,
            title: detail?.title || m.movieTitle || 'Filme',
            posterPath: detail?.posterPath || m.posterPath,
            isFavorite: m.isFavorite,
            watchedAt: m.watchedAt
          };
        })
      );
      if (cancelled) return;
      const movies = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
      setWatchedMoviesData(movies);
      setLoadingMovies(false);
    })();
    return () => { cancelled = true; };
  }, [watchedMovies]);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const offset = direction === 'left' ? -260 : 260;
      ref.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const bannerBackground = user?.bannerUrl 
    ? user.bannerUrl 
    : 'linear-gradient(135deg, rgba(124,92,255,0.3) 0%, rgba(255,122,89,0.2) 100%)';

  return (
    <div className="profile-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Banner & Avatar Container (Unclipped & Responsive) */}
      <div style={{ position: 'relative', marginBottom: '45px' }}>
        
        {/* Inner Banner with overflow: hidden */}
        <div style={{ 
          position: 'relative', 
          height: 'clamp(150px, 25vw, 220px)', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden', 
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)'
        }}>
          {user?.bannerUrl ? (
            <img src={user.bannerUrl} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: bannerBackground }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }} />

          {/* Change Banner Button */}
          <button
            onClick={() => setShowBannerPicker(!showBannerPicker)}
            className="st-btn-secondary"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(13, 13, 18, 0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              zIndex: 5
            }}
          >
            <ImageIcon size={14} /> Alterar Capa
          </button>
        </div>

        {/* Avatar Positioned Outside overflow: hidden so it's NEVER cut off */}
        <div style={{ position: 'absolute', bottom: '-35px', left: '24px', zIndex: 10 }}>
          <div
            style={{ 
              position: 'relative', 
              cursor: 'pointer', 
              borderRadius: '50%', 
              width: '84px', 
              height: '84px', 
              border: '4px solid var(--bg-dark)', 
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              background: 'var(--bg-surface)',
              overflow: 'hidden'
            }}
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="avatar-container"
            title="Clique para alterar foto"
          >
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
              alt={user?.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="avatar-hover-overlay">
              <Camera size={22} color="white" />
            </div>
          </div>
        </div>
      </div>

      {/* Username + actions row */}
      <div style={{ paddingLeft: '125px', paddingRight: '16px', minHeight: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }} className="profile-header-info">
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>
            @{user?.username}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Membro Epsync</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => devicePhotoInputRef.current?.click()} className="st-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', gap: '5px' }} disabled={avatarLoading}>
            <Upload size={14} /> Foto
          </button>
          <button onClick={() => deviceBannerInputRef.current?.click()} className="st-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', gap: '5px' }} disabled={bannerLoading}>
            <Upload size={14} /> Capa
          </button>
          <button onClick={logout} className="st-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', gap: '5px', color: 'var(--error)', borderColor: 'rgba(239,68,110,0.2)' }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      <input ref={devicePhotoInputRef} type="file" accept="image/*" onChange={handleDevicePhotoChange} style={{ display: 'none' }} />
      <input ref={deviceBannerInputRef} type="file" accept="image/*" onChange={handleDeviceBannerChange} style={{ display: 'none' }} />

      {/* Banner Picker Modal */}
      {showBannerPicker && (
        <div className="st-panel animate-fade-in" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} style={{ color: 'var(--primary)' }} /> Escolha uma Capa para seu Perfil
            </h4>
            <button onClick={() => setShowBannerPicker(false)} className="st-btn-icon" style={{ width: '28px', height: '28px' }}>✕</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {bannerPresets.map((b, i) => (
              <div 
                key={i} 
                onClick={() => handleSelectBanner(b.url)} 
                style={{ 
                  height: '70px', 
                  borderRadius: 'var(--radius-sm)', 
                  overflow: 'hidden', 
                  cursor: 'pointer', 
                  border: user?.bannerUrl === b.url ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                <img src={b.url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: '10px', background: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: '3px', color: '#fff', fontWeight: 600 }}>{b.name}</span>
              </div>
            ))}
          </div>

          <form onSubmit={e => { e.preventDefault(); if (customBannerUrl.trim()) handleSelectBanner(customBannerUrl.trim()); }} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="url" 
              required 
              placeholder="Ou cole o link direto de uma imagem (URL)..." 
              value={customBannerUrl} 
              onChange={e => setCustomBannerUrl(e.target.value)} 
              style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} 
            />
            <button type="submit" className="st-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={bannerLoading}>
              {bannerLoading ? '...' : 'Salvar Capa'}
            </button>
          </form>
        </div>
      )}

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div className="st-panel animate-fade-in" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Escolha um Avatar ou envie uma foto</h4>
            <button onClick={() => setShowAvatarPicker(false)} className="st-btn-icon" style={{ width: '28px', height: '28px' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {avatarPresets.map((preset, i) => (
              <div key={i} onClick={() => handleSelectAvatar(preset)} style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: user?.avatarUrl === preset ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.1)', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                <img src={preset} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); if (customAvatarUrl.trim()) handleSelectAvatar(customAvatarUrl.trim()); }} style={{ display: 'flex', gap: '8px' }}>
            <input type="url" required placeholder="URL de imagem..." value={customAvatarUrl} onChange={e => setCustomAvatarUrl(e.target.value)} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
            <button type="submit" className="st-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={avatarLoading}>{avatarLoading ? '...' : 'Salvar'}</button>
          </form>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{followedShows.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Séries Seguidas</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{watchedEpisodes.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Episódios Vistos</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-display)' }}>{watchedMovies.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Filmes Vistos</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-display)' }}>{totalDays}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dias Assistidos</div>
        </div>
      </div>

      {/* Séries que estou acompanhando (Horizontal Touch Drag Scroll) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={17} style={{ color: 'var(--primary)' }} /> Séries que estou acompanhando ({followedShows.length})
          </h3>
          {followedShowsData.length > 3 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => scrollContainer(showsScrollRef, 'left')} className="st-btn-icon" style={{ width: '28px', height: '28px' }} title="Rolar para esquerda">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scrollContainer(showsScrollRef, 'right')} className="st-btn-icon" style={{ width: '28px', height: '28px' }} title="Rolar para direita">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {followedShows.length === 0 ? (
          <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Você ainda não está acompanhando nenhuma série. Encontre séries e animes na aba <strong>Descobrir</strong>!
          </div>
        ) : (
          <div 
            ref={showsScrollRef}
            className="horizontal-scroll-container"
            style={{ 
              display: 'flex', 
              gap: '14px', 
              overflowX: 'auto', 
              paddingBottom: '12px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              touchAction: 'pan-x pan-y'
            }}
          >
            {loadingShows && followedShowsData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Carregando séries...</div>
            ) : (
              followedShowsData.map(show => (
                <div
                  key={show.id}
                  style={{ flexShrink: 0, width: '105px', cursor: onViewMedia ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => onViewMedia?.(show.id, 'show')}
                >
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', boxShadow: '0 6px 16px rgba(0,0,0,0.5)', marginBottom: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                    <img src={getImageUrl(show.posterPath)} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                    {show.title}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Filmes Assistidos (Horizontal Touch Drag Scroll + Fixed Cards) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={17} style={{ color: 'var(--secondary)' }} /> Filmes Assistidos ({watchedMovies.length})
          </h3>
          {watchedMoviesData.length > 3 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => scrollContainer(moviesScrollRef, 'left')} className="st-btn-icon" style={{ width: '28px', height: '28px' }} title="Rolar para esquerda">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scrollContainer(moviesScrollRef, 'right')} className="st-btn-icon" style={{ width: '28px', height: '28px' }} title="Rolar para direita">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {watchedMovies.length === 0 ? (
          <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Você ainda não marcou nenhum filme como assistido. Explore os lançamentos na aba <strong>Descobrir</strong>!
          </div>
        ) : (
          <div 
            ref={moviesScrollRef}
            className="horizontal-scroll-container"
            style={{ 
              display: 'flex', 
              gap: '14px', 
              overflowX: 'auto', 
              paddingBottom: '12px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              touchAction: 'pan-x pan-y'
            }}
          >
            {loadingMovies && watchedMoviesData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Carregando filmes assistidos...</div>
            ) : (
              watchedMoviesData.map((m, idx) => (
                <div
                  key={m.movieId || idx}
                  style={{ flexShrink: 0, width: '105px', cursor: onViewMedia ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => onViewMedia?.(m.movieId, 'movie')}
                >
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', boxShadow: '0 6px 16px rgba(0,0,0,0.5)', marginBottom: '6px', position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.posterPath ? (
                      <img src={getImageUrl(m.posterPath)} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px' }}>
                        <Film size={28} color="var(--text-muted)" />
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>Filme</span>
                      </div>
                    )}
                    {m.isFavorite && (
                      <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.75)', borderRadius: '50%', padding: '3px', backdropFilter: 'blur(4px)' }}>
                        <Heart size={12} fill="var(--secondary)" color="var(--secondary)" />
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                    {m.title || m.movieId}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Privacy Settings */}
      <div className="st-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={16} style={{ color: 'var(--primary)' }} /> Visibilidade do Perfil
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Controle quem pode ver suas séries e atividade no Epsync.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['public', 'friends', 'private'] as const).map(v => {
            const active = (user?.profileVisibility ?? 'public') === v;
            const label = v === 'public' ? 'Público' : v === 'friends' ? 'Apenas Amigos' : 'Privado';
            const Icon = v === 'public' ? Globe : v === 'friends' ? Users : Lock;
            return (
              <button key={v} onClick={() => handlePrivacyChange(v)} disabled={privacyLoading} className={active ? 'st-btn-primary' : 'st-btn-secondary'} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', opacity: privacyLoading ? 0.6 : 1 }}>
                <Icon size={13} />{label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Genre Stats */}
      <div className="st-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={16} style={{ color: 'var(--accent)' }} /> Categorias Favoritas
        </h3>
        {(() => {
          const sorted = Object.entries(genreCounts || {}).map(([name, count]) => ({ name, count, pct: totalGenresCount > 0 ? Math.round((count / totalGenresCount) * 100) : 0 })).sort((a,b) => b.count - a.count).slice(0, 5);
          if (!sorted.length) return <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nenhum gênero registrado ainda.</p>;
          const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--warning)', 'var(--error)'];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sorted.map((g, i) => (
                <div key={g.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span>{g.name}</span><span style={{ color: 'var(--text-muted)' }}>{g.pct}%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: 'var(--radius-full)' }}>
                    <div style={{ width: `${g.pct}%`, height: '100%', background: colors[i], borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <style>{`
        .horizontal-scroll-container::-webkit-scrollbar {
          height: 6px;
        }
        .horizontal-scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .horizontal-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(124, 92, 255, 0.3);
          border-radius: 4px;
        }
        .horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 92, 255, 0.6);
        }

        @media (max-width: 580px) {
          .profile-view .st-panel {
            padding: 16px !important;
          }

          .profile-header-info {
            padding-left: 16px !important;
            padding-top: 40px !important;
          }
        }
      `}</style>
    </div>
  );
};
