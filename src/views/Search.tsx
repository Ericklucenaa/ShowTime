import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchPersonalizedRecommendations, 
  searchMedia, 
  getImageUrl, 
  hasRealTmdbKey, 
  rankMediaResults 
} from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { 
  Search as SearchIcon, 
  Film, 
  Tv, 
  Star, 
  AlertCircle, 
  Sparkles, 
  Zap, 
  Flame,
  Loader2 
} from 'lucide-react';
import { trackEvent } from '../services/telemetry.js';

interface SearchProps {
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
}

type MediaFilterCategory = 'all' | 'shows' | 'movies' | 'anime';

export const Search: React.FC<SearchProps> = ({ onViewMedia }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recommendationData, setRecommendationData] = useState<{
    personalized: any[];
    trending: any[];
    series: any[];
    movies: any[];
    animes: any[];
  }>({
    personalized: [],
    trending: [],
    series: [],
    movies: [],
    animes: []
  });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MediaFilterCategory>('all');
  const [isDemoMode, setIsDemoMode] = useState(!hasRealTmdbKey());
  const { favoriteGenres, followedShows, watchedEpisodes, watchedMovies } = useTracking();

  const hasUserInterests = followedShows.length > 0 || watchedEpisodes.length > 0 || watchedMovies.length > 0 || favoriteGenres.length > 0;

  // Load recommendations on mount and whenever user follows or watches new content
  useEffect(() => {
    let cancelled = false;

    const loadRecommendations = async () => {
      setLoading(true);
      try {
        // Collect all interest IDs (followed shows + watched episodes + watched movies)
        const allInterestIds = Array.from(new Set([
          ...followedShows,
          ...watchedEpisodes.map(e => e.showId),
          ...watchedMovies.map(m => m.movieId)
        ]));

        const recs = await fetchPersonalizedRecommendations(allInterestIds, favoriteGenres);
        if (cancelled) return;

        setRecommendationData(recs);
      } catch (err) {
        console.error('Error loading recommendations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRecommendations();
    return () => { cancelled = true; };
  }, [
    followedShows.join(','), 
    favoriteGenres.join(','), 
    watchedEpisodes.length, 
    watchedMovies.length
  ]);

  // Handle active search typing
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchMedia(query.trim());
        const ranked = rankMediaResults(data, favoriteGenres);
        setSearchResults(ranked);
        trackEvent('search_media_query', { queryLength: query.trim().length, results: ranked.length });
      } catch (err) {
        console.error('Error searching media:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, favoriteGenres.join('|')]);

  useEffect(() => {
    setIsDemoMode(!hasRealTmdbKey());
  }, [recommendationData]);

  // Helper check for anime
  const isAnime = (item: any) => {
    return (
      item.genres?.some((g: string) => g.toLowerCase().includes('anim') || g.toLowerCase().includes('anime')) ||
      item.title?.toLowerCase().includes('anime') ||
      item.originalLanguage === 'ja' ||
      ['Attack on Titan', 'Demon Slayer', 'Jujutsu Kaisen', 'One Piece', 'Naruto', 'Death Note', 'Chainsaw Man', 'Frieren', 'Bleach', 'Solo Leveling', 'Hunter x Hunter', 'Dragon Ball'].some(t => item.title?.toLowerCase().includes(t.toLowerCase()))
    );
  };

  // Filter search results when searching
  const filteredSearchResults = useMemo(() => {
    if (selectedCategory === 'all') return searchResults;
    if (selectedCategory === 'shows') return searchResults.filter(i => i.mediaType === 'show' && !isAnime(i));
    if (selectedCategory === 'movies') return searchResults.filter(i => i.mediaType === 'movie');
    if (selectedCategory === 'anime') return searchResults.filter(isAnime);
    return searchResults;
  }, [searchResults, selectedCategory]);

  const renderMediaCard = (item: any) => (
    <div
      key={item.id || item.tmdbId}
      className="st-card"
      onClick={() => onViewMedia(item.id || item.tmdbId.toString(), item.mediaType)}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
      }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden', background: 'var(--bg-dark)' }}>
        <img
          src={getImageUrl(item.posterPath)}
          alt={item.title}
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform var(--transition-normal)'
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop';
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        />
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px', zIndex: 2 }}>
          <span style={{
            background: isAnime(item)
              ? 'linear-gradient(135deg, #FF5376 0%, #E83E63 100%)'
              : item.mediaType === 'show'
              ? 'linear-gradient(135deg, var(--primary) 0%, #6A4CEB 100%)'
              : 'linear-gradient(135deg, var(--secondary) 0%, #E86847 100%)',
            color: 'white',
            fontSize: '9px',
            fontWeight: 700,
            padding: '3px 7px',
            borderRadius: 'var(--radius-xs)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            letterSpacing: '0.04em',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
          }}>
            {isAnime(item) ? <Zap size={10} /> : item.mediaType === 'show' ? <Tv size={10} /> : <Film size={10} />}
            {isAnime(item) ? 'Anime' : item.mediaType === 'show' ? 'Série' : 'Filme'}
          </span>
        </div>
        {item.rating > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(13, 13, 18, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 2
          }}>
            <Star size={11} fill="var(--warning)" color="var(--warning)" />
            {item.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '4px', fontWeight: 600 }}>
          {item.title}
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>{item.releaseDate ? new Date(item.releaseDate).getFullYear() : (item.firstAirDate ? new Date(item.firstAirDate).getFullYear() : '')}</span>
          {item.genres && item.genres.length > 0 && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
              {item.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Skeleton Grid Placeholder while loading
  const renderSkeletonGrid = () => (
    <div className="grid-media">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div 
          key={idx} 
          className="st-card" 
          style={{ height: '280px', background: 'var(--bg-elevated)', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} 
        />
      ))}
    </div>
  );

  return (
    <div className="search-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Descobrir
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Sugestões inteligentes com base no que você assiste, tendências e lançamentos.
        </p>
      </div>

      {/* TMDB Demo Mode Alert */}
      {isDemoMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(124, 92, 255, 0.08)', border: '1px dashed rgba(124, 92, 255, 0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Catálogo Inteligente</strong>: Exibindo sugestões personalizadas com base nas suas preferências e histórico.
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="st-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', borderRadius: 'var(--radius-full)', marginBottom: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)' }}>
        <SearchIcon size={20} style={{ color: 'var(--text-muted)', marginRight: '12px', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar séries, animes ou filmes por título..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', padding: '10px 0', color: 'var(--text-primary)' }}
        />
        {searchLoading && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Loader2 size={13} className="animate-spin" /> Buscando...</div>}
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'shows', label: '📺 Séries' },
          { id: 'movies', label: '🎬 Filmes' },
          { id: 'anime', label: '⚡ Animes' }
        ].map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as MediaFilterCategory)}
              style={{
                background: isActive ? 'var(--primary)' : 'var(--bg-surface)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary)' : 'var(--border-color)',
                borderRadius: 'var(--radius-full)',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* When actively searching with text input */}
      {query.trim() !== '' ? (
        searchLoading ? (
          renderSkeletonGrid()
        ) : filteredSearchResults.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum resultado encontrado para "{query}"</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Tente outras palavras-chave ou troque a categoria.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
              Resultados para "{query}" ({filteredSearchResults.length})
            </h3>
            <div className="grid-media">
              {filteredSearchResults.map(renderMediaCard)}
            </div>
          </div>
        )
      ) : (
        /* Discovery Home by selected Category */
        <div>
          {loading && recommendationData.personalized.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <div style={{ width: '220px', height: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xs)', marginBottom: '16px' }} />
                {renderSkeletonGrid()}
              </div>
            </div>
          ) : (
            <>
              {/* TAB: ALL */}
              {selectedCategory === 'all' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                  
                  {/* 1. Recomendados para Você */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <Sparkles size={19} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                        Recomendados para Você
                      </h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        {hasUserInterests 
                          ? (favoriteGenres.length > 0 ? `(baseado no seu gosto por ${favoriteGenres.slice(0, 3).join(', ')})` : '(baseado nas séries e filmes que você segue)')
                          : '(sugestões mais populares e aclamadas)'
                        }
                      </span>
                    </div>
                    <div className="grid-media">
                      {(recommendationData.personalized.length > 0 ? recommendationData.personalized : recommendationData.trending).slice(0, 10).map(renderMediaCard)}
                    </div>
                  </section>

                  {/* 2. Tendências da Semana */}
                  {recommendationData.trending.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Flame size={19} style={{ color: '#FF7A59' }} />
                        <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                          Tendências & Populares da Semana
                        </h3>
                      </div>
                      <div className="grid-media">
                        {recommendationData.trending.slice(0, 10).map(renderMediaCard)}
                      </div>
                    </section>
                  )}

                  {/* 3. Animes em Destaque */}
                  {recommendationData.animes.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Zap size={19} style={{ color: '#FF5376' }} />
                        <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                          Animes em Destaque
                        </h3>
                      </div>
                      <div className="grid-media">
                        {recommendationData.animes.slice(0, 10).map(renderMediaCard)}
                      </div>
                    </section>
                  )}

                  {/* 4. Séries em Alta */}
                  {recommendationData.series.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Tv size={19} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                          Séries em Alta
                        </h3>
                      </div>
                      <div className="grid-media">
                        {recommendationData.series.slice(0, 10).map(renderMediaCard)}
                      </div>
                    </section>
                  )}

                  {/* 5. Filmes em Alta */}
                  {recommendationData.movies.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Film size={19} style={{ color: 'var(--secondary)' }} />
                        <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                          Filmes em Alta
                        </h3>
                      </div>
                      <div className="grid-media">
                        {recommendationData.movies.slice(0, 10).map(renderMediaCard)}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* TAB: SÉRIES ONLY */}
              {selectedCategory === 'shows' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Tv size={18} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                        Séries Recomendadas & Populares
                      </h3>
                    </div>
                    <div className="grid-media">
                      {recommendationData.series.map(renderMediaCard)}
                    </div>
                  </section>
                </div>
              )}

              {/* TAB: FILMES ONLY */}
              {selectedCategory === 'movies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Film size={18} style={{ color: 'var(--secondary)' }} />
                      <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                        Filmes Recomendados & Populares
                      </h3>
                    </div>
                    <div className="grid-media">
                      {recommendationData.movies.map(renderMediaCard)}
                    </div>
                  </section>
                </div>
              )}

              {/* TAB: ANIMES ONLY */}
              {selectedCategory === 'anime' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Zap size={18} style={{ color: '#FF5376' }} />
                      <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', margin: 0 }}>
                        Animes Recomendados & Populares
                      </h3>
                    </div>
                    <div className="grid-media">
                      {recommendationData.animes.map(renderMediaCard)}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
