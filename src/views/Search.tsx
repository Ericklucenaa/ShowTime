import React, { useState, useEffect, useMemo } from 'react';
import { searchMedia, getImageUrl, hasRealTmdbKey, rankMediaResults } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { Search as SearchIcon, Film, Tv, Star, AlertCircle, Sparkles, Flame } from 'lucide-react';
import { trackEvent } from '../services/telemetry.js';

interface SearchProps {
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
}

type MediaFilterCategory = 'all' | 'shows' | 'movies' | 'anime';

export const Search: React.FC<SearchProps> = ({ onViewMedia }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [defaultMedia, setDefaultMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MediaFilterCategory>('all');
  const [isDemoMode, setIsDemoMode] = useState(!hasRealTmdbKey());
  const { favoriteGenres } = useTracking();

  // Load default catalog and suggestions when mounting
  useEffect(() => {
    let cancelled = false;
    const loadDefaults = async () => {
      setLoading(true);
      try {
        const popular = await searchMedia('');
        if (cancelled) return;
        const ranked = rankMediaResults(popular, favoriteGenres);
        setDefaultMedia(ranked);
        setResults(ranked);
      } catch (err) {
        console.error('Error loading default media:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDefaults();
    return () => { cancelled = true; };
  }, [favoriteGenres.join('|')]);

  // Search media when typing
  useEffect(() => {
    if (query.trim() === '') {
      setResults(defaultMedia);
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
    }, 350);

    return () => clearTimeout(timer);
  }, [query, defaultMedia, favoriteGenres.join('|')]);

  useEffect(() => {
    setIsDemoMode(!hasRealTmdbKey());
  }, [results]);

  // Filter results by category
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return results;
    if (selectedCategory === 'shows') return results.filter(i => i.mediaType === 'show' && !i.genres?.includes('Animation'));
    if (selectedCategory === 'movies') return results.filter(i => i.mediaType === 'movie');
    if (selectedCategory === 'anime') {
      return results.filter(i => 
        i.genres?.some((g: string) => g.toLowerCase().includes('anim') || g.toLowerCase().includes('anime')) ||
        i.title?.toLowerCase().includes('anime') ||
        i.originalLanguage === 'ja'
      );
    }
    return results;
  }, [results, selectedCategory]);

  // Categorized sections for discovery when not searching
  const recommendedForYou = useMemo(() => {
    return defaultMedia.slice(0, 8);
  }, [defaultMedia]);

  const animeHighlights = useMemo(() => {
    return defaultMedia.filter(i => 
      i.genres?.some((g: string) => g.toLowerCase().includes('anim')) || 
      i.originalLanguage === 'ja' ||
      ['Attack on Titan', 'Demon Slayer', 'Jujutsu Kaisen', 'One Piece', 'Naruto', 'Death Note', 'Chainsaw Man', 'Frieren', 'Bleach'].some(t => i.title?.toLowerCase().includes(t.toLowerCase()))
    ).slice(0, 8);
  }, [defaultMedia]);

  const trendingShows = useMemo(() => {
    return defaultMedia.filter(i => i.mediaType === 'show').slice(0, 8);
  }, [defaultMedia]);

  const trendingMovies = useMemo(() => {
    return defaultMedia.filter(i => i.mediaType === 'movie').slice(0, 8);
  }, [defaultMedia]);

  const renderMediaCard = (item: any) => (
    <div
      key={item.id || item.tmdbId}
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
          {item.releaseDate ? new Date(item.releaseDate).getFullYear() : (item.firstAirDate ? new Date(item.firstAirDate).getFullYear() : 'N/A')}
        </p>
      </div>
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
          Sugestões personalizadas com base no que você assiste, tendências e lançamentos.
        </p>
      </div>

      {/* TMDB Demo Mode Alert */}
      {isDemoMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(124, 92, 255, 0.08)', border: '1px dashed rgba(124, 92, 255, 0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Catálogo Demonstrativo Inteligente</strong>: Exibindo sugestões do catálogo local com base nas suas preferências.
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
        {loading && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>Buscando...</div>}
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

      {/* Results View when querying or filtered */}
      {query.trim() !== '' || selectedCategory !== 'all' ? (
        filteredResults.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum resultado encontrado</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Tente outras palavras-chave ou troque de categoria.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
              {query.trim() !== '' ? `Resultados para "${query}"` : 'Conteúdo Selecionado'} ({filteredResults.length})
            </h3>
            <div className="grid-media">
              {filteredResults.map(renderMediaCard)}
            </div>
          </div>
        )
      ) : (
        /* Discovery Home with Smart Personalized Sections */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          
          {/* Section 1: Recomendados para Você */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                Recomendados para Você
              </h3>
              {favoriteGenres.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  (baseado em {favoriteGenres.slice(0, 2).join(', ')})
                </span>
              )}
            </div>
            <div className="grid-media">
              {recommendedForYou.map(renderMediaCard)}
            </div>
          </section>

          {/* Section 2: Animes em Destaque */}
          {animeHighlights.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Flame size={18} style={{ color: 'var(--secondary)' }} />
                <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  Animes em Destaque
                </h3>
              </div>
              <div className="grid-media">
                {animeHighlights.map(renderMediaCard)}
              </div>
            </section>
          )}

          {/* Section 3: Séries Populares */}
          {trendingShows.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Tv size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  Séries Populares
                </h3>
              </div>
              <div className="grid-media">
                {trendingShows.map(renderMediaCard)}
              </div>
            </section>
          )}

          {/* Section 4: Filmes em Alta */}
          {trendingMovies.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Film size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  Filmes em Alta
                </h3>
              </div>
              <div className="grid-media">
                {trendingMovies.map(renderMediaCard)}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
};
