import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { 
  BarChart3, 
  LogOut, 
  Camera, 
  Upload, 
  Globe, 
  Users, 
  Lock, 
  Tv, 
  Film, 
  Heart, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  Clock,
  PlaySquare
} from 'lucide-react';
import { fetchMediaDetails, searchMedia, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';

interface ProfileProps {
  onViewMedia?: (id: string, type: 'show' | 'movie') => void;
  onViewProfile?: (userId: string, username: string) => void;
}

// Clean TMDB ID helper (removes m_ or s_ prefix)
const cleanId = (id?: string | number) => id ? String(id).replace(/^[sm]_/, '') : '';

// Smooth Horizontal Carousel Component with Touch Swipe & Mouse Drag
interface CarouselProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  loading: boolean;
  emptyText: string;
  children: React.ReactNode;
}

const MediaCarousel: React.FC<CarouselProps> = ({
  title,
  count,
  icon,
  loading,
  emptyText,
  children
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children, loading]);

  // Mouse Drag to Scroll handler for desktop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    const onMouseDown = (e: MouseEvent) => {
      // Don't drag if clicking buttons or specific interactive controls
      if ((e.target as HTMLElement).closest('button')) return;
      isDown = true;
      hasMoved = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseLeave = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
      // If we dragged more than a tiny bit, prevent accidental click event
      if (hasMoved) {
        const preventClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener('click', preventClick, true);
        };
        window.addEventListener('click', preventClick, true);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 4) {
        hasMoved = true;
      }
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

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ 
          fontSize: '17px', 
          fontWeight: 700, 
          margin: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          color: 'var(--text-primary)'
        }}>
          {icon} {title} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>({count})</span>
        </h3>

        {/* Carousel Navigation Arrows (Desktop) */}
        {count > 0 && (
          <div style={{ display: 'flex', gap: '6px' }} className="carousel-nav-arrows">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!showLeftArrow}
              aria-label="Rolar para a esquerda"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: showLeftArrow ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: showLeftArrow ? 1 : 0.4,
                cursor: showLeftArrow ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)'
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!showRightArrow}
              aria-label="Rolar para a direita"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: showRightArrow ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: showRightArrow ? 1 : 0.4,
                cursor: showRightArrow ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)'
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {count === 0 && !loading ? (
        <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          {emptyText}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="horizontal-scroll-container"
        >
          {loading ? (
            <div style={{ display: 'flex', gap: '12px', padding: '10px 0' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div 
                  key={n} 
                  className="horizontal-scroll-item" 
                  style={{ opacity: 0.5, animation: 'pulse 1.5s infinite' }}
                >
                  <div style={{ aspectRatio: '2/3', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', marginBottom: '6px' }} />
                  <div style={{ height: '12px', background: 'var(--bg-card)', borderRadius: '4px', width: '80%' }} />
                </div>
              ))}
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

export const Profile: React.FC<ProfileProps> = ({ onViewMedia }) => {
  const { user, logout, updateAvatar, updateBanner, updatePrivacy, error: authError } = useAuth();
  const { watchedEpisodes, watchedMovies, genreCounts, totalGenresCount, followedShows, toggleWatchMovie } = useTracking();

  const [followedShowsData, setFollowedShowsData] = useState<any[]>([]);
  const [watchedMoviesData, setWatchedMoviesData] = useState<any[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(false);

  // Avatar & Banner Modals State
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [customBannerUrl, setCustomBannerUrl] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const devicePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const deviceBannerInputRef = useRef<HTMLInputElement | null>(null);

  // Filter strictly watched movies (only movies that have watchedAt and isWatched !== false)
  const strictlyWatchedMovies = useMemo(() => {
    return (watchedMovies || []).filter(m => m.isWatched !== false && Boolean(m.watchedAt));
  }, [watchedMovies]);

  // Engagement stats
  const totalEpTime = (watchedEpisodes || []).length * 40;
  const totalMovTime = strictlyWatchedMovies.length * 110;
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const totalDays = (totalHours / 24).toFixed(1);

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
          canvas.width = 180;
          canvas.height = 180;
          const ctx = canvas.getContext('2d')!;
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 180, 180);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const success = await updateAvatar(compressed);
      pushToast(success ? 'success' : 'error', success ? 'Foto atualizada com sucesso.' : 'Não foi possível atualizar a foto.');
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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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

  const handlePrivacyChange = async (v: 'public' | 'friends' | 'private') => {
    if (v === user?.profileVisibility) return;
    setPrivacyLoading(true);
    const success = await updatePrivacy(v);
    if (success) {
      pushToast('success', 'Privacidade atualizada com sucesso.');
    } else {
      pushToast('error', 'Erro ao atualizar privacidade.');
    }
    setPrivacyLoading(false);
  };

  // Load followed shows details
  useEffect(() => {
    let cancelled = false;
    setLoadingShows(true);
    (async () => {
      const results = await Promise.allSettled(
        (followedShows || []).slice(0, 40).map(async (sid) => {
          const detail = await fetchMediaDetails(cleanId(sid), 'show');
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

  // Load strictly watched movies details (Deduplicated by ID & Title, in-memory cache)
  useEffect(() => {
    let cancelled = false;
    setLoadingMovies(true);
    (async () => {
      // 1. Sort watchedMovies by watchedAt descending
      const sorted = [...strictlyWatchedMovies].sort((a, b) => {
        return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
      });

      const normalizeTitle = (t?: string) => (t || '').toLowerCase().replace(/[^a-z0-9]/gi, '').trim();

      // 2. Deduplicate by both clean movieId and normalized title
      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      const uniqueMovies: typeof strictlyWatchedMovies = [];

      for (const m of sorted) {
        const cId = cleanId(m.movieId);
        const normTitle = normalizeTitle(m.movieTitle);

        if (cId && seenIds.has(cId)) continue;
        if (normTitle && normTitle.length > 3 && seenTitles.has(normTitle)) continue;

        if (cId) seenIds.add(cId);
        if (normTitle && normTitle.length > 3) seenTitles.add(normTitle);
        uniqueMovies.push(m);
      }

      const results = await Promise.allSettled(
        uniqueMovies.slice(0, 50).map(async (m) => {
          const cId = cleanId(m.movieId);
          if (m.posterPath) {
            return {
              movieId: cId || m.movieId,
              title: m.movieTitle || 'Filme',
              posterPath: m.posterPath,
              isFavorite: m.isFavorite,
              watchedAt: m.watchedAt
            };
          }

          // Check local session cache
          const cacheKey = `epsync_meta_cache_${cId || m.movieId}`;
          const cachedRaw = sessionStorage.getItem(cacheKey);
          if (cachedRaw) {
            try {
              const cached = JSON.parse(cachedRaw);
              return {
                movieId: cached.movieId || cId || m.movieId,
                title: cached.title || m.movieTitle || 'Filme',
                posterPath: cached.posterPath,
                isFavorite: m.isFavorite,
                watchedAt: m.watchedAt
              };
            } catch (_) {}
          }

          // Fallback 1: Direct fetch by ID (if numeric ID)
          if (/^\d+$/.test(cId)) {
            try {
              const detail = await fetchMediaDetails(cId, 'movie');
              if (detail && (detail.posterPath || detail.poster_path)) {
                const poster = detail.posterPath || detail.poster_path;
                const title = detail.title || m.movieTitle || 'Filme';
                sessionStorage.setItem(cacheKey, JSON.stringify({ posterPath: poster, title, movieId: cId }));

                return {
                  movieId: cId,
                  title,
                  posterPath: poster,
                  isFavorite: m.isFavorite,
                  watchedAt: m.watchedAt
                };
              }
            } catch (_) {}
          }

          // Fallback 2: Search by title / slug
          const cleanQuery = (m.movieTitle || m.movieId || '')
            .replace(/^[sm]_/, '')
            .replace(/[-_]/g, ' ')
            .trim();

          if (cleanQuery && cleanQuery.length > 1) {
            try {
              const searchResults = await searchMedia(cleanQuery);
              const found = searchResults.find(r => r.mediaType === 'movie' && (r.posterPath || r.poster_path)) || searchResults[0];
              if (found) {
                const poster = found.posterPath || found.poster_path;
                const title = found.title || cleanQuery;
                const newId = cleanId(found.id) || cId;
                sessionStorage.setItem(cacheKey, JSON.stringify({ posterPath: poster, title, movieId: newId }));

                return {
                  movieId: newId,
                  title,
                  posterPath: poster,
                  isFavorite: m.isFavorite,
                  watchedAt: m.watchedAt
                };
              }
            } catch (_) {}
          }

          return {
            movieId: cId || m.movieId,
            title: m.movieTitle || cleanQuery || 'Filme',
            posterPath: null,
            isFavorite: m.isFavorite,
            watchedAt: m.watchedAt
          };
        })
      );

      if (cancelled) return;
      const rawMovies = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);

      // Post-fetch deduplication by ID, posterPath and Title
      const finalSeen = new Set<string>();
      const finalMovies: any[] = [];

      for (const m of rawMovies) {
        const idKey = m.movieId ? `id_${cleanId(m.movieId)}` : '';
        const titleKey = m.title ? `title_${normalizeTitle(m.title)}` : '';
        const posterKey = m.posterPath ? `poster_${m.posterPath}` : '';

        if (idKey && finalSeen.has(idKey)) continue;
        if (titleKey && titleKey.length > 9 && finalSeen.has(titleKey)) continue;
        if (posterKey && finalSeen.has(posterKey)) continue;

        if (idKey) finalSeen.add(idKey);
        if (titleKey && titleKey.length > 9) finalSeen.add(titleKey);
        if (posterKey) finalSeen.add(posterKey);

        finalMovies.push(m);
      }

      setWatchedMoviesData(finalMovies);
      setLoadingMovies(false);
    })();

    return () => { cancelled = true; };
  }, [strictlyWatchedMovies]);

  return (
    <div className="profile-view animate-fade-in" style={{ padding: '12px 14px 80px 14px', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* 1. Profile Header Container (Banner + Overlapping Avatar) */}
      <div style={{ position: 'relative', marginBottom: '48px' }}>
        
        {/* Cover Banner */}
        <div 
          onClick={() => setShowBannerPicker(true)}
          title="Clique para alterar a capa"
          style={{ 
            position: 'relative', 
            height: 'clamp(140px, 34vw, 220px)', 
            borderRadius: 'var(--radius-lg)', 
            overflow: 'hidden', 
            background: 'linear-gradient(135deg, #1E1A38 0%, #11101E 100%)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer'
          }}
        >
          {user?.bannerUrl ? (
            <img 
              src={user.bannerUrl} 
              alt="Capa do Perfil" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} 
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              background: 'radial-gradient(ellipse at top left, rgba(124, 92, 255, 0.45) 0%, rgba(255, 122, 89, 0.2) 60%, #0D0D12 100%)' 
            }} />
          )}

          {/* Vignette Overlay */}
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(to top, rgba(13,13,18,0.85) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.3) 100%)' 
          }} />

          {/* Single "Alterar Capa" Button on Cover Banner */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBannerPicker(true);
            }}
            aria-label="Alterar Capa"
            title="Alterar Capa do Perfil"
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(13, 13, 18, 0.88)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 'var(--radius-full)',
              color: '#FFFFFF',
              zIndex: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              transition: 'transform var(--transition-fast), background var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(124, 92, 255, 0.9)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(13, 13, 18, 0.88)'}
          >
            <Camera size={13} /> Alterar Capa
          </button>
        </div>

        {/* Avatar Positioned Overlapping Bottom Border of Cover */}
        <div style={{ position: 'absolute', bottom: '-40px', left: '20px', zIndex: 15 }}>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowAvatarPicker(true)}
              title="Alterar Foto de Perfil"
              style={{ 
                width: '88px', 
                height: '88px', 
                borderRadius: '50%', 
                border: '4px solid var(--bg-dark)', 
                boxShadow: '0 10px 26px rgba(0,0,0,0.7)',
                background: 'var(--bg-surface)',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <img
                src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}`}
                alt={user?.username}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Camera Badge on Avatar */}
            <button
              type="button"
              onClick={() => setShowAvatarPicker(true)}
              aria-label="Alterar Foto"
              title="Alterar Foto"
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--primary)',
                border: '2px solid var(--bg-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                transition: 'transform var(--transition-fast)'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Camera size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. User Info & Main Action Buttons (Clean & Without Redundancies) */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          flexWrap: 'wrap', 
          gap: '16px', 
          marginBottom: '26px',
          padding: '0 4px'
        }}
      >
        {/* User Identity Details */}
        <div>
          <h2 style={{ 
            fontSize: '24px', 
            fontFamily: 'var(--font-display)', 
            letterSpacing: '-0.02em', 
            margin: 0, 
            color: 'var(--text-primary)', 
            lineHeight: 1.2 
          }}>
            @{user?.username}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
            <img src="/logo.png" alt="Epsync" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Membro Epsync</span>
          </div>
        </div>

        {/* Action Button: "Sair" */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={logout}
            className="st-btn-secondary"
            style={{
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--error)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>

      {/* 3. Stats Grid (2x2 on Mobile, 4 Columns on Desktop) */}
      <div 
        className="profile-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: '28px'
        }}
      >
        <div className="st-card" style={{ padding: '16px 12px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
            <Tv size={16} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Séries Seguidas</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
            {(followedShows || []).length}
          </div>
        </div>

        <div className="st-card" style={{ padding: '16px 12px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
            <PlaySquare size={16} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Episódios Vistos</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
            {(watchedEpisodes || []).length}
          </div>
        </div>

        <div className="st-card" style={{ padding: '16px 12px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--secondary)' }}>
            <Film size={16} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filmes Vistos</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
            {strictlyWatchedMovies.length}
          </div>
        </div>

        <div className="st-card" style={{ padding: '16px 12px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)' }}>
            <Clock size={16} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dias Assistidos</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
            {totalDays}d
          </div>
        </div>
      </div>

      {/* 4. Séries que estou acompanhando (Horizontal Scroller with Swipe/Drag & Arrows) */}
      <MediaCarousel
        title="Séries que estou acompanhando"
        count={(followedShows || []).length}
        icon={<Tv size={18} style={{ color: 'var(--primary)' }} />}
        loading={loadingShows && followedShowsData.length === 0}
        emptyText="Você ainda não está acompanhando nenhuma série. Encontre séries e animes na aba Descobrir!"
      >
        {followedShowsData.map(show => (
          <div
            key={show.id}
            className="horizontal-scroll-item"
            onClick={() => onViewMedia?.(cleanId(show.id), 'show')}
          >
            <div style={{ 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden', 
              aspectRatio: '2/3', 
              boxShadow: '0 6px 16px rgba(0,0,0,0.5)', 
              marginBottom: '8px', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-card)' 
            }}>
              <img 
                src={getImageUrl(show.posterPath || show.poster_path)} 
                alt={show.title || show.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                loading="lazy" 
              />
            </div>
            <p style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              textAlign: 'center', 
              lineHeight: 1.25, 
              color: 'var(--text-primary)', 
              display: '-webkit-box', 
              WebkitLineClamp: 2, 
              WebkitBoxOrient: 'vertical', 
              overflow: 'hidden', 
              margin: 0 
            }}>
              {show.title || show.name}
            </p>
          </div>
        ))}
      </MediaCarousel>

      {/* 5. Filmes Assistidos (Strictly Watched Movies with Touch Swipe/Drag & Arrows) */}
      <MediaCarousel
        title="Filmes Assistidos"
        count={strictlyWatchedMovies.length}
        icon={<Film size={18} style={{ color: 'var(--secondary)' }} />}
        loading={loadingMovies && watchedMoviesData.length === 0}
        emptyText="Você ainda não marcou nenhum filme como assistido. Explore os lançamentos na aba Descobrir!"
      >
        {watchedMoviesData.map((m, idx) => (
          <div
            key={m.movieId || idx}
            className="horizontal-scroll-item"
            onClick={() => onViewMedia?.(m.movieId, 'movie')}
          >
            <div style={{ 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden', 
              aspectRatio: '2/3', 
              boxShadow: '0 6px 16px rgba(0,0,0,0.5)', 
              marginBottom: '8px', 
              border: '1px solid var(--border-color)', 
              background: 'linear-gradient(145deg, #1E1B38 0%, #111022 100%)', 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              {m.posterPath ? (
                <img 
                  src={getImageUrl(m.posterPath)} 
                  alt={m.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  loading="lazy" 
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 6px', textAlign: 'center', width: '100%', height: '100%' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 122, 89, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={18} style={{ color: 'var(--secondary)' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.title}
                  </span>
                </div>
              )}

              {/* Quick Unwatch Button on Top-Left */}
              <button
                type="button"
                title="Desmarcar filme como assistido"
                aria-label="Desmarcar filme como assistido"
                onClick={(e) => {
                  e.stopPropagation();
                  const targetId = cleanId(m.movieId);
                  const targetTitle = (m.title || '').toLowerCase().replace(/[^a-z0-9]/gi, '').trim();

                  // Immediate optimistic UI update
                  setWatchedMoviesData(prev => prev.filter(item => {
                    if (cleanId(item.movieId) === targetId) return false;
                    if (targetTitle && targetTitle.length > 3) {
                      const itemTitle = (item.title || '').toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
                      if (itemTitle === targetTitle) return false;
                    }
                    return true;
                  }));

                  toggleWatchMovie(m.movieId, m);
                  pushToast('info', `"${m.title || 'Filme'}" desmarcado.`);
                }}
                style={{
                  position: 'absolute',
                  top: 5,
                  left: 5,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(13, 13, 18, 0.85)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(0, 245, 212, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  zIndex: 6,
                  transition: 'transform var(--transition-fast)'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Check size={13} />
              </button>

              {/* Favorite Heart Badge */}
              {m.isFavorite && (
                <div style={{ 
                  position: 'absolute', 
                  top: 5, 
                  right: 5, 
                  background: 'rgba(0,0,0,0.78)', 
                  borderRadius: '50%', 
                  padding: '4px', 
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5
                }}>
                  <Heart size={12} fill="var(--secondary)" color="var(--secondary)" />
                </div>
              )}
            </div>
            <p style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              textAlign: 'center', 
              lineHeight: 1.25, 
              color: 'var(--text-primary)', 
              display: '-webkit-box', 
              WebkitLineClamp: 2, 
              WebkitBoxOrient: 'vertical', 
              overflow: 'hidden', 
              margin: 0 
            }}>
              {m.title || m.movieId}
            </p>
          </div>
        ))}
      </MediaCarousel>

      {/* 6. Visibilidade do Perfil (Privacidade) */}
      <div className="st-panel" style={{ padding: '20px', marginBottom: '24px', borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={16} style={{ color: 'var(--primary)' }} /> Visibilidade do Perfil
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Controle quem pode ver suas séries, filmes e estatísticas no Epsync.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['public', 'friends', 'private'] as const).map(v => {
            const active = (user?.profileVisibility ?? 'public') === v;
            const label = v === 'public' ? 'Público' : v === 'friends' ? 'Apenas Amigos' : 'Privado';
            const Icon = v === 'public' ? Globe : v === 'friends' ? Users : Lock;
            return (
              <button 
                key={v} 
                type="button"
                onClick={() => handlePrivacyChange(v)} 
                disabled={privacyLoading} 
                className={active ? 'st-btn-primary' : 'st-btn-secondary'} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '12px', 
                  padding: '8px 16px', 
                  borderRadius: 'var(--radius-full)',
                  opacity: privacyLoading ? 0.6 : 1,
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} /> {label} {active && <Check size={12} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Categorias / Gêneros Favoritos */}
      <div className="st-panel" style={{ padding: '20px', marginBottom: '24px', borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={16} style={{ color: 'var(--accent)' }} /> Categorias Favoritas
        </h3>
        {(() => {
          const sorted = Object.entries(genreCounts || {})
            .map(([name, count]) => ({ name, count, pct: totalGenresCount > 0 ? Math.round((count / totalGenresCount) * 100) : 0 }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 5);

          if (!sorted.length) return <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nenhuma categoria registrada ainda.</p>;
          const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--warning)', '#9D4EDD'];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sorted.map((g, i) => (
                <div key={g.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.pct}%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${g.pct}%`, height: '100%', background: colors[i % colors.length], borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Hidden File Inputs for Device Gallery / Camera */}
      <input ref={devicePhotoInputRef} type="file" accept="image/*" onChange={handleDevicePhotoChange} style={{ display: 'none' }} />
      <input ref={deviceBannerInputRef} type="file" accept="image/*" onChange={handleDeviceBannerChange} style={{ display: 'none' }} />

      {/* Banner Picker Modal */}
      {showBannerPicker && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.82)',
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
              maxWidth: '520px', 
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

            {/* Option 1: Device */}
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

            {/* Option 2: Presets */}
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

            {/* Option 3: URL */}
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
        </div>,
        document.body
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.82)',
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

            {/* Option 1: Device */}
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

            {/* Option 2: Presets */}
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

            {/* Option 3: URL */}
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
        </div>,
        document.body
      )}

      {/* Component Level Styles for Mobile Responsiveness & Carousel */}
      <style>{`
        @media (max-width: 640px) {
          .profile-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .carousel-nav-arrows {
            display: none !important;
          }
        }
        @media (min-width: 641px) {
          .profile-stats-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
};
