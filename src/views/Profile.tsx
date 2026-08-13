import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { BarChart3, LogOut, Camera, Upload, Globe, Users, Lock, Tv, Film, Heart, Image as ImageIcon, Sparkles } from 'lucide-react';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';

interface ProfileProps {
  onViewMedia?: (id: string, type: 'show' | 'movie') => void;
  onViewProfile?: (userId: string, username: string) => void;
}

// Custom hook for smooth touch & mouse drag horizontal scrolling
function useDragScroll() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
    };

    const onMouseUp = () => {
      isDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return ref;
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
  const showsScrollRef = useDragScroll();
  const moviesScrollRef = useDragScroll();

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
          canvas.width = 1200;
          canvas.height = 400;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 1200, 400);
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
    const success = await updatePrivacy(v);
    if (success) {
      pushToast('success', 'Privacidade atualizada.');
    } else {
      pushToast('error', 'Erro ao atualizar privacidade.');
    }
    setPrivacyLoading(false);
  };

  // Load user's followed shows
  useEffect(() => {
    let cancelled = false;
    setLoadingShows(true);
    (async () => {
      const results = await Promise.allSettled(
        followedShows.slice(0, 35).map(async (sid) => {
          const detail = await fetchMediaDetails(sid, 'show');
          return detail;
        })
      );
      if (cancelled) return;
      const shows = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
      setFollowedShowsData(shows);
      setLoadingShows(false);
    })();
    return () => { cancelled = true; };
  }, [followedShows]);

  // Load user's watched movies
  useEffect(() => {
    let cancelled = false;
    setLoadingMovies(true);
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
          height: 'clamp(140px, 32vw, 240px)', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden', 
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {user?.bannerUrl ? (
            <img src={user.bannerUrl} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: bannerBackground }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }} />

          {/* Change Banner Button (Always Touch Friendly on Cover) */}
          <button
            onClick={() => setShowBannerPicker(true)}
            className="st-btn-secondary"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'rgba(13, 13, 18, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 'var(--radius-full)',
              color: '#FFFFFF',
              zIndex: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              cursor: 'pointer'
            }}
          >
            <Camera size={15} /> Alterar Capa
          </button>
        </div>

        {/* Avatar Positioned Outside overflow: hidden */}
        <div style={{ position: 'absolute', bottom: '-38px', left: '20px', zIndex: 10 }}>
          <div
            style={{ 
              position: 'relative', 
              cursor: 'pointer', 
              borderRadius: '50%', 
              width: '86px', 
              height: '86px', 
              border: '4px solid var(--bg-dark)', 
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              background: 'var(--bg-surface)',
              overflow: 'hidden'
            }}
            onClick={() => setShowAvatarPicker(true)}
            className="avatar-container"
            title="Clique para alterar foto"
          >
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
              alt={user?.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="avatar-hover-overlay">
              <Camera size={22} color="white" />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Header Info Block */}
      <div className="profile-header-block">
        <div className="profile-user-details">
          <h2 className="profile-username">
            @{user?.username}
          </h2>
          <div className="profile-badge-row">
            <img src="/logo.png" alt="Epsync" className="profile-badge-icon" />
            <span className="profile-badge-text">Membro Epsync</span>
          </div>
        </div>
        
        {/* Responsive 3-Button Action Row */}
        <div className="profile-header-actions">
          <button type="button" onClick={() => setShowAvatarPicker(true)} className="st-btn-secondary profile-action-btn" disabled={avatarLoading}>
            <Camera size={14} /> Foto
          </button>
          <button type="button" onClick={() => setShowBannerPicker(true)} className="st-btn-secondary profile-action-btn" disabled={bannerLoading}>
            <ImageIcon size={14} /> Capa
          </button>
          <button type="button" onClick={logout} className="st-btn-secondary profile-action-btn logout-btn">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      {/* Hidden File Inputs for Device Gallery / Camera */}
      <input ref={devicePhotoInputRef} type="file" accept="image/*" onChange={handleDevicePhotoChange} style={{ display: 'none' }} />
      <input ref={deviceBannerInputRef} type="file" accept="image/*" onChange={handleDeviceBannerChange} style={{ display: 'none' }} />

      {/* Banner Picker Modal */}
      {showBannerPicker && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBannerPicker(false); }}
        >
          <div 
            className="st-panel animate-scale-up" 
            style={{ 
              width: '100%', 
              maxWidth: '560px', 
              maxHeight: '90vh', 
              overflowY: 'auto', 
              padding: '24px', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} /> Alterar Capa do Perfil
              </h3>
              <button onClick={() => setShowBannerPicker(false)} className="st-btn-icon" style={{ width: '32px', height: '32px', fontSize: '16px' }}>✕</button>
            </div>

            {/* Option 1: Choose from Device */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Do seu dispositivo
              </label>
              <button 
                type="button"
                onClick={() => deviceBannerInputRef.current?.click()} 
                className="st-btn-primary" 
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
                disabled={bannerLoading}
              >
                <Upload size={16} /> {bannerLoading ? 'Processando imagem...' : 'Escolher Foto da Galeria ou Câmera'}
              </button>
            </div>

            {/* Option 2: Choose from Presets */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Ou escolha uma capa pronta
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {bannerPresets.map((b, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSelectBanner(b.url)} 
                    style={{ 
                      height: '74px', 
                      borderRadius: 'var(--radius-sm)', 
                      overflow: 'hidden', 
                      cursor: 'pointer', 
                      border: user?.bannerUrl === b.url ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      position: 'relative',
                      transition: 'transform var(--transition-fast)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img src={b.url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: '10px', background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: '3px', color: '#fff', fontWeight: 600 }}>{b.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Option 3: Image URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Ou cole um link de imagem (URL)
              </label>
              <form onSubmit={e => { e.preventDefault(); if (customBannerUrl.trim()) handleSelectBanner(customBannerUrl.trim()); }} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="url" 
                  required 
                  placeholder="https://exemplo.com/minha-capa.jpg" 
                  value={customBannerUrl} 
                  onChange={e => setCustomBannerUrl(e.target.value)} 
                  style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} 
                />
                <button type="submit" className="st-btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600 }} disabled={bannerLoading}>
                  {bannerLoading ? '...' : 'Salvar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAvatarPicker(false); }}
        >
          <div 
            className="st-panel animate-scale-up" 
            style={{ 
              width: '100%', 
              maxWidth: '480px', 
              maxHeight: '90vh', 
              overflowY: 'auto', 
              padding: '24px', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--primary)' }} /> Alterar Foto de Perfil
              </h3>
              <button onClick={() => setShowAvatarPicker(false)} className="st-btn-icon" style={{ width: '32px', height: '32px', fontSize: '16px' }}>✕</button>
            </div>

            {/* Option 1: Choose from Device */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Do seu dispositivo
              </label>
              <button 
                type="button"
                onClick={() => devicePhotoInputRef.current?.click()} 
                className="st-btn-primary" 
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
                disabled={avatarLoading}
              >
                <Upload size={16} /> {avatarLoading ? 'Processando foto...' : 'Escolher Foto da Galeria ou Câmera'}
              </button>
            </div>

            {/* Option 2: Choose avatar preset */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Ou escolha um avatar ilustrado
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {avatarPresets.map((preset, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSelectAvatar(preset)} 
                    style={{ 
                      width: '56px', 
                      height: '56px', 
                      borderRadius: '50%', 
                      overflow: 'hidden', 
                      cursor: 'pointer', 
                      border: user?.avatarUrl === preset ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.15)', 
                      transition: 'transform 0.2s',
                      background: 'var(--bg-dark)'
                    }} 
                    onMouseOver={e => e.currentTarget.style.transform='scale(1.1)'} 
                    onMouseOut={e => e.currentTarget.style.transform='scale(1)'}
                  >
                    <img src={preset} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Option 3: Avatar URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Ou cole um link de foto (URL)
              </label>
              <form onSubmit={e => { e.preventDefault(); if (customAvatarUrl.trim()) handleSelectAvatar(customAvatarUrl.trim()); }} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="url" 
                  required 
                  placeholder="https://exemplo.com/minha-foto.jpg" 
                  value={customAvatarUrl} 
                  onChange={e => setCustomAvatarUrl(e.target.value)} 
                  style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} 
                />
                <button type="submit" className="st-btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600 }} disabled={avatarLoading}>
                  {avatarLoading ? '...' : 'Salvar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid (2x2 on Mobile, 4 columns on Desktop) */}
      <div className="profile-stats-grid">
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{followedShows.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Séries Seguidas</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{watchedEpisodes.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Episódios Vistos</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-display)' }}>{watchedMovies.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Filmes Vistos</div>
        </div>
        <div className="st-card" style={{ padding: '14px 18px', textAlign: 'center' }}>
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
        </div>

        {followedShows.length === 0 ? (
          <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Você ainda não está acompanhando nenhuma série. Encontre séries e animes na aba <strong>Descobrir</strong>!
          </div>
        ) : (
          <div 
            ref={showsScrollRef}
            className="horizontal-scroll-container"
          >
            {loadingShows && followedShowsData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Carregando séries...</div>
            ) : (
              followedShowsData.map(show => (
                <div
                  key={show.id}
                  className="horizontal-scroll-item"
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

      {/* Filmes Assistidos (Horizontal Touch Drag Scroll) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={17} style={{ color: 'var(--secondary)' }} /> Filmes Assistidos ({watchedMovies.length})
          </h3>
        </div>

        {watchedMovies.length === 0 ? (
          <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Você ainda não marcou nenhum filme como assistido. Explore os lançamentos na aba <strong>Descobrir</strong>!
          </div>
        ) : (
          <div 
            ref={moviesScrollRef}
            className="horizontal-scroll-container"
          >
            {loadingMovies && watchedMoviesData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Carregando filmes assistidos...</div>
            ) : (
              watchedMoviesData.map((m, idx) => (
                <div
                  key={m.movieId || idx}
                  className="horizontal-scroll-item"
                  onClick={() => onViewMedia?.(m.movieId, 'movie')}
                >
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', boxShadow: '0 6px 16px rgba(0,0,0,0.5)', marginBottom: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
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
