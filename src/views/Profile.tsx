import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { BarChart3, LogOut, Camera, Upload, Globe, Users, Lock, Tv, Film, Heart } from 'lucide-react';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';

export const Profile: React.FC = () => {
  const { user, logout, updateAvatar, updatePrivacy, error: authError } = useAuth();
  const { watchedEpisodes, watchedMovies, genreCounts, totalGenresCount, followedShows } = useTracking();

  const [bannerUrl, setBannerUrl] = useState('');
  const [followedShowsData, setFollowedShowsData] = useState<any[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);

  // Avatar Picker State
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const devicePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const avatarPresets = [
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_1`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_2`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_3`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_4`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_5`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_6`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_7`
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

  const handleDevicePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Selecione um arquivo de imagem valido.');
      return;
    }

    setAvatarLoading(true);
    try {
      // Compress to 150x150 JPEG via canvas — no Firebase Storage needed
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 150;
          canvas.height = 150;
          const ctx = canvas.getContext('2d')!;
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 150, 150);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
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

  // Math stats (improved estimation based on genres)
  let totalEpTime = 0;
  watchedEpisodes.forEach(ep => {
    const g = ep.genres || [];
    if (g.includes('Animation') || g.includes('Animação')) {
      totalEpTime += 24; // Anime / Cartoons
    } else if (g.includes('Comedy') || g.includes('Comédia') || g.includes('Sitcom')) {
      totalEpTime += 25; // Sitcoms
    } else if (g.includes('Drama') || g.includes('Crime') || g.includes('Action') || g.includes('Ação')) {
      totalEpTime += 50; // Heavy Dramas / Action
    } else {
      totalEpTime += 40; // Default average
    }
  });

  const totalMovTime = watchedMovies.length * 110; // avg 110m for movies
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const totalDays = (totalHours / 24).toFixed(1);

  const handlePrivacyChange = async (v: 'public' | 'friends' | 'private') => {
    if (v === user?.profileVisibility) return;
    setPrivacyLoading(true);
    const ok = await updatePrivacy(v);
    pushToast(ok ? 'success' : 'error', ok ? 'Privacidade atualizada.' : 'Erro ao atualizar privacidade.');
    setPrivacyLoading(false);
  };

  // Load banner + followed show posters
  useEffect(() => {
    if (!followedShows.length) { setFollowedShowsData([]); setBannerUrl(''); return; }
    let cancelled = false;
    setLoadingShows(true);
    (async () => {
      const results = await Promise.allSettled(
        followedShows.slice(0, 24).map(id => fetchMediaDetails(id, 'show'))
      );
      if (cancelled) return;
      const shows = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
      setFollowedShowsData(shows);
      const withBackdrop = shows.find(s => s.backdropPath);
      if (withBackdrop) setBannerUrl(getImageUrl(withBackdrop.backdropPath, 'original'));
      setLoadingShows(false);
    })();
    return () => { cancelled = true; };
  }, [followedShows.join(',')]);

  return (
    <div className="profile-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Banner Hero */}
      <div style={{ position: 'relative', height: '200px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '0', background: 'var(--bg-card)' }}>
        {bannerUrl
          ? <img src={bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(245,197,24,0.15) 0%, rgba(99,102,241,0.15) 100%)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }} />

        {/* Avatar on banner */}
        <div style={{ position: 'absolute', bottom: '-36px', left: '24px', zIndex: 2 }}>
          <div
            style={{ position: 'relative', cursor: 'pointer', borderRadius: '50%', overflow: 'hidden', width: '80px', height: '80px', border: '3px solid var(--bg-dark)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="avatar-container"
          >
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
              alt={user?.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="avatar-hover-overlay">
              <Camera size={20} color="white" />
            </div>
          </div>
        </div>
      </div>

      {/* Username + actions row */}
      <div style={{ paddingLeft: '120px', paddingRight: '16px', minHeight: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-display)' }}>@{user?.username}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => devicePhotoInputRef.current?.click()} className="st-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', gap: '5px' }} disabled={avatarLoading}>
            <Upload size={14} /> Foto
          </button>
          <button onClick={logout} className="st-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', gap: '5px', color: 'var(--error)', borderColor: 'rgba(239,68,110,0.2)' }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
      <input ref={devicePhotoInputRef} type="file" accept="image/*" onChange={handleDevicePhotoChange} style={{ display: 'none' }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div className="st-card" style={{ padding: '14px 20px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{followedShows.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Séries</div>
        </div>
        <div className="st-card" style={{ padding: '14px 20px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{watchedEpisodes.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Episódios</div>
        </div>
        <div className="st-card" style={{ padding: '14px 20px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-display)' }}>{watchedMovies.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Filmes</div>
        </div>
        <div className="st-card" style={{ padding: '14px 20px', textAlign: 'center', flex: '1 1 80px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-display)' }}>{totalDays}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dias</div>
        </div>
      </div>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div className="st-card animate-fade-in" style={{ padding: '20px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Escolha um Avatar ou insira um link</h4>
          <button type="button" onClick={() => devicePhotoInputRef.current?.click()} className="st-btn-secondary" style={{ marginBottom: '12px', width: '100%', justifyContent: 'center', fontSize: '13px' }} disabled={avatarLoading}>
            <Upload size={15} /> Carregar do dispositivo
          </button>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {avatarPresets.map((preset, i) => (
              <div key={i} onClick={() => handleSelectAvatar(preset)} style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: user?.avatarUrl === preset ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.1)', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                <img src={preset} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <form className="avatar-url-form" onSubmit={e => { e.preventDefault(); if (customAvatarUrl.trim()) handleSelectAvatar(customAvatarUrl.trim()); }} style={{ display: 'flex', gap: '8px' }}>
            <input type="url" required placeholder="URL de imagem..." value={customAvatarUrl} onChange={e => setCustomAvatarUrl(e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
            <button type="submit" className="st-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={avatarLoading}>{avatarLoading ? '...' : 'Salvar'}</button>
          </form>
        </div>
      )}

      {/* Séries que estou assistindo */}
      {(followedShowsData.length > 0 || loadingShows) && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={16} style={{ color: 'var(--primary)' }} /> Séries que estou assistindo
          </h3>
          {loadingShows
            ? <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando...</div>
            : <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                {followedShowsData.map(show => (
                  <div key={show.id} style={{ flexShrink: 0, width: '90px' }}>
                    <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', marginBottom: '6px' }}>
                      <img src={getImageUrl(show.posterPath)} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <p style={{ fontSize: '11px', textAlign: 'center', lineHeight: 1.2, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{show.title}</p>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Filmes assistidos */}
      {watchedMovies.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={16} style={{ color: 'var(--accent)' }} /> Filmes Assistidos
          </h3>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {watchedMovies.map(m => (
              <div key={m.movieId} style={{ flexShrink: 0, width: '80px' }}>
                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', marginBottom: '6px', position: 'relative' }}>
                  {m.posterPath
                    ? <img src={getImageUrl(m.posterPath)} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={20} color="var(--text-muted)" /></div>
                  }
                  {m.isFavorite && <Heart size={14} fill="var(--secondary)" color="var(--secondary)" style={{ position: 'absolute', top: 4, right: 4 }} />}
                </div>
                <p style={{ fontSize: '10px', textAlign: 'center', lineHeight: 1.2, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Settings */}
      <div className="st-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={16} style={{ color: 'var(--primary)' }} /> Visibilidade do Perfil
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Controle quem pode ver suas séries e atividade.</p>
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
        @media (max-width: 520px) {
          .profile-view .st-panel {
            padding: 16px !important;
          }

          .profile-view h2 {
            font-size: 20px !important;
          }
        }
      `}</style>
    </div>
  );
};
