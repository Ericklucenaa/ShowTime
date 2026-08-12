import React, { useState, useEffect } from 'react';
import { searchMedia, getImageUrl, hasRealTmdbKey, rankMediaResults } from '../services/api.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, getDocs } from 'firebase/firestore/lite';
import { useTracking } from '../context/TrackingContext.js';
import { Search as SearchIcon, Film, Tv, Star, AlertCircle, Users, UserPlus, UserCheck, Lock } from 'lucide-react';
import { trackEvent } from '../services/telemetry.js';

interface SearchProps {
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
  onViewProfile?: (userId: string, username: string) => void;
}

export const Search: React.FC<SearchProps> = ({ onViewMedia, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTab, setSearchTab] = useState<'media' | 'users'>('media');
  const [isDemoMode, setIsDemoMode] = useState(!hasRealTmdbKey());
  const { followedUsers, toggleFollowUser, favoriteGenres } = useTracking();

  // Search media when typing
  useEffect(() => {
    if (searchTab !== 'media') return;

    if (query.trim() === '') {
      const loadDefaults = async () => {
        setLoading(true);
        const popular = await searchMedia('');
        setResults(rankMediaResults(popular, favoriteGenres));
        setLoading(false);
      };
      loadDefaults();
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMedia(query);
        const ranked = rankMediaResults(data, favoriteGenres);
        setResults(ranked);
        trackEvent('search_media_query', { queryLength: query.trim().length, results: ranked.length });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, searchTab, favoriteGenres.join('|')]);

  // Search users
  useEffect(() => {
    if (searchTab !== 'users') return;
    if (query.trim().length < 3) { setUserResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (isFirebaseEnabled && db) {
          const q = query.trim().toLowerCase();

          const snap = await getDocs(collection(db, 'profiles'));
          const results = snap.docs
            .map(d => d.data())
            .filter(p =>
              p.profileVisibility !== 'private' &&
              p.usernameLower &&
              p.usernameLower.includes(q)
            )
            .slice(0, 20);

          setUserResults(results);
          trackEvent('search_user_query', { queryLength: q.length, results: results.length });
        } else {
          setUserResults([]);
        }
      } catch (e) {
        console.error('User search error:', e);
        setUserResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, searchTab]);

  useEffect(() => {
    setIsDemoMode(!hasRealTmdbKey());
  }, [results]);

  return (
    <div className="search-view animate-fade-in" style={{ paddingBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Descobrir
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Explore séries, filmes, animes e conecte-se com outros usuários no Epsync.
        </p>
      </div>

      {/* Search Type Tabs */}
      <div className="search-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setSearchTab('media')}
          className={searchTab === 'media' ? 'st-btn-primary' : 'st-btn-secondary'}
          style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Tv size={15} /> Séries & Filmes
        </button>
        <button
          onClick={() => setSearchTab('users')}
          className={searchTab === 'users' ? 'st-btn-primary' : 'st-btn-secondary'}
          style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Users size={15} /> Usuários
        </button>
      </div>

      {/* TMDB Demo Mode Alert */}
      {searchTab === 'media' && isDemoMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(124, 92, 255, 0.08)', border: '1px dashed rgba(124, 92, 255, 0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Modo Demonstração Ativo</strong>: Exibindo catálogo demonstrativo local.
            Configure sua chave TMDB no arquivo <strong>.env</strong> para busca global em tempo real!
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="st-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', borderRadius: 'var(--radius-full)', marginBottom: '28px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)' }}>
        <SearchIcon size={20} style={{ color: 'var(--text-muted)', marginRight: '12px', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={searchTab === 'media' ? 'Buscar séries, animes ou filmes...' : 'Buscar usuário pelo @nome...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', padding: '10px 0', color: 'var(--text-primary)' }}
        />
        {loading && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>Buscando...</div>}
      </div>

      {/* Media Results */}
      {searchTab === 'media' && (
        results.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum resultado encontrado para "{query}"</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Tente outras palavras-chave ou confira a grafia.</p>
          </div>
        ) : (
          <div className="grid-media">
            {results.map((item) => (
              <div
                key={item.id}
                className="st-card"
                onClick={() => onViewMedia(item.id || item.tmdbId.toString(), item.mediaType)}
                style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
                  <img
                    src={getImageUrl(item.posterPath)}
                    alt={item.title}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-normal)' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px' }}>
                    <span style={{
                      background: item.mediaType === 'show' ? 'linear-gradient(135deg, var(--primary) 0%, #6A4CEB 100%)' : 'linear-gradient(135deg, var(--secondary) 0%, #E86847 100%)',
                      color: 'white', fontSize: '9px', fontWeight: 700, padding: '3px 7px', borderRadius: 'var(--radius-xs)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.04em'
                    }}>
                      {item.mediaType === 'show' ? <Tv size={10} /> : <Film size={10} />}
                      {item.mediaType === 'show' ? 'Série' : 'Filme'}
                    </span>
                  </div>
                  {item.rating > 0 && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(13, 13, 18, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: 'var(--radius-xs)', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)' }}>
                      <Star size={11} fill="var(--warning)" color="var(--warning)" />
                      {item.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '4px', fontWeight: 600 }}>
                    {item.title}
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* User Results */}
      {searchTab === 'users' && (
        <div>
          {!isFirebaseEnabled && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Busca de usuários requer conexão com Firebase.</p>
            </div>
          )}

          {isFirebaseEnabled && query.trim().length < 3 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <SearchIcon size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Digite pelo menos 3 letras para buscar usuários no Epsync.</p>
            </div>
          )}

          {isFirebaseEnabled && query.trim().length >= 3 && userResults.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Nenhum usuário encontrado para "{query}"</p>
            </div>
          )}

          {isFirebaseEnabled && userResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {userResults.map(u => {
                const isFollowed = followedUsers.includes(u.id);
                return (
                  <div
                    key={u.id}
                    className="st-panel"
                    style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: '16px' }}
                  >
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                      alt={u.username}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--primary)', flexShrink: 0, cursor: 'pointer' }}
                      onClick={() => onViewProfile?.(u.id, u.username)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{ fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                        onClick={() => onViewProfile?.(u.id, u.username)}
                      >
                        @{u.username}
                        {u.profileVisibility === 'friends' && (
                          <span style={{ fontSize: '10px', background: 'rgba(124, 92, 255, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(124, 92, 255, 0.3)' }}>
                            <Lock size={10} /> Amigos
                          </span>
                        )}
                      </h4>
                    </div>
                    <div className="search-user-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        className="st-btn-secondary"
                        style={{ fontSize: '12px', padding: '0 12px', height: '32px' }}
                        onClick={() => onViewProfile?.(u.id, u.username)}
                      >
                        Ver Perfil
                      </button>
                      <button
                        className={isFollowed ? 'st-btn-secondary' : 'st-btn-primary'}
                        style={{ fontSize: '12px', padding: '0 12px', height: '32px' }}
                        onClick={() => toggleFollowUser(u.id)}
                        title={isFollowed ? 'Deixar de seguir' : 'Seguir usuário'}
                      >
                        {isFollowed ? <UserCheck size={14} /> : <UserPlus size={14} />}
                        {isFollowed ? 'Seguindo' : 'Seguir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .search-tabs {
            flex-wrap: wrap;
          }

          .search-tabs button {
            flex: 1 1 140px;
            justify-content: center;
          }

          .search-user-actions {
            width: 100%;
            flex-wrap: wrap;
            margin-top: 8px;
          }

          .search-user-actions button {
            flex: 1 1 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};
