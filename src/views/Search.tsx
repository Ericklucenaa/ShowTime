import React, { useState, useEffect } from 'react';
import { searchMedia, getImageUrl, hasRealTmdbKey, rankMediaResults } from '../services/api.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, getDocs, query as fsQuery, orderBy, startAt, endAt, limit } from 'firebase/firestore/lite';
import { useTracking } from '../context/TrackingContext.js';
import { Search as SearchIcon, Film, Tv, Star, AlertCircle, Users, UserPlus, UserCheck } from 'lucide-react';
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
    if (!query.trim()) { setUserResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (isFirebaseEnabled && db) {
          const q = query.trim().toLowerCase();

          const usernameQuery = fsQuery(
            collection(db, 'profiles'),
            orderBy('usernameLower'),
            startAt(q),
            endAt(`${q}\uf8ff`),
            limit(20)
          );

          const emailQuery = fsQuery(
            collection(db, 'profiles'),
            orderBy('emailLower'),
            startAt(q),
            endAt(`${q}\uf8ff`),
            limit(20)
          );

          const [usernameSnap, emailSnap] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(emailQuery)
          ]);

          const merged = new Map<string, any>();
          usernameSnap.docs.forEach((d) => {
            const data = d.data();
            merged.set(data.id || d.id, data);
          });
          emailSnap.docs.forEach((d) => {
            const data = d.data();
            merged.set(data.id || d.id, data);
          });

          setUserResults(Array.from(merged.values()).slice(0, 20));
          trackEvent('search_user_query', { queryLength: q.length, results: merged.size });
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
    <div className="search-view animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Descobrir</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Busque séries, filmes e outros usuários da plataforma.</p>
      </div>

      {/* Search Type Tabs */}
      <div className="search-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setSearchTab('media')}
          className={searchTab === 'media' ? 'st-btn-primary' : 'st-btn-secondary'}
          style={{ border: 'none', fontSize: '14px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', background: searchTab === 'media' ? undefined : 'transparent' }}
        >
          <Tv size={16} /> Séries & Filmes
        </button>
        <button
          onClick={() => setSearchTab('users')}
          className={searchTab === 'users' ? 'st-btn-primary' : 'st-btn-secondary'}
          style={{ border: 'none', fontSize: '14px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', background: searchTab === 'users' ? undefined : 'transparent' }}
        >
          <Users size={16} /> Usuários
        </button>
      </div>

      {/* TMDB Demo Mode Alert */}
      {searchTab === 'media' && isDemoMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Modo de Demonstração Ativo</strong>: Exibindo catálogo local.
            Configure a chave TMDB no arquivo <strong>.env</strong> para busca global em tempo real!
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="st-panel" style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderRadius: 'var(--radius-full)', marginBottom: '30px', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
        <SearchIcon size={22} style={{ color: 'var(--text-muted)', marginRight: '12px' }} />
        <input
          type="text"
          placeholder={searchTab === 'media' ? 'Digitar nome da série, anime ou filme...' : 'Buscar usuário por nome...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', padding: '10px 0', color: 'var(--text-primary)' }}
        />
        {loading && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>Buscando...</div>}
      </div>

      {/* Media Results */}
      {searchTab === 'media' && (
        results.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Nenhum resultado encontrado para "{query}"</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Tente outras palavras-chave ou confira a grafia.</p>
          </div>
        ) : (
          <div className="grid-media">
            {results.map((item) => (
              <div
                key={item.id}
                className="st-card glow-hover"
                onClick={() => onViewMedia(item.id || item.tmdbId.toString(), item.mediaType)}
                style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
                  <img
                    src={getImageUrl(item.posterPath)}
                    alt={item.title}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-normal)' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                    <span style={{
                      background: item.mediaType === 'show' ? 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)' : 'linear-gradient(135deg, var(--accent) 0%, #059669 100%)',
                      color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {item.mediaType === 'show' ? <Tv size={10} /> : <Film size={10} />}
                      {item.mediaType === 'show' ? 'Série' : 'Filme'}
                    </span>
                  </div>
                  {item.rating > 0 && (
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(7,7,10,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)' }}>
                      <Star size={12} fill="var(--warning)" color="var(--warning)" />
                      {item.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '14px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '6px' }}>
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

          {isFirebaseEnabled && query.trim() === '' && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <SearchIcon size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Digite um nome de usuário para buscar.</p>
            </div>
          )}

          {isFirebaseEnabled && query.trim() !== '' && userResults.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Nenhum usuário encontrado para "{query}"</p>
            </div>
          )}

          {isFirebaseEnabled && userResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userResults.map(u => {
                const isFollowed = followedUsers.includes(u.id);
                return (
                  <div
                    key={u.id}
                    className="glass-card"
                    style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '16px' }}
                  >
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                      alt={u.username}
                      style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2px solid var(--primary)', flexShrink: 0, cursor: 'pointer' }}
                      onClick={() => onViewProfile?.(u.id, u.username)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{ fontSize: '16px', cursor: 'pointer' }}
                        onClick={() => onViewProfile?.(u.id, u.username)}
                      >
                        {u.username}
                      </h4>
                    </div>
                    <div className="search-user-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => onViewProfile?.(u.id, u.username)}
                      >
                        Ver Perfil
                      </button>
                      <button
                        className={isFollowed ? 'btn-secondary' : 'btn-primary'}
                        style={{ fontSize: '13px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
                        onClick={() => toggleFollowUser(u.id)}
                        title={isFollowed ? 'Deixar de seguir' : 'Seguir usuário'}
                      >
                        {isFollowed ? <UserCheck size={15} /> : <UserPlus size={15} />}
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
            flex: 1 1 160px;
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
