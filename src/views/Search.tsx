import React, { useState, useEffect } from 'react';
import { searchMedia, getImageUrl, hasRealTmdbKey } from '../services/api.js';
import { Search as SearchIcon, Film, Tv, Star, AlertCircle } from 'lucide-react';

export const Search: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(!hasRealTmdbKey());

  // Search when typing with a slight debounce
  useEffect(() => {
    if (query.trim() === '') {
      // Load some popular defaults if search is empty
      const loadDefaults = async () => {
        setLoading(true);
        const popular = await searchMedia('');
        setResults(popular);
        setLoading(false);
      };
      loadDefaults();
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMedia(query);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Check TMDB key status periodically
  useEffect(() => {
    setIsDemoMode(!hasRealTmdbKey());
  }, [results]);

  return (
    <div className="search-view animate-fade-in">
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Descobrir</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Busque por milhares de séries, animes e filmes do catálogo mundial.</p>
      </div>

      {/* TMDB Key Alert in Demo Mode */}
      {isDemoMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(99, 102, 241, 0.08)', border: '1px dashed rgba(99, 102, 241, 0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Modo de Demonstração Ativo</strong>: Exibindo catálogo local de séries/filmes populares. 
            Insira uma chave da API do TMDB na aba <strong>Perfil</strong> para liberar a busca global dinâmica em tempo real!
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderRadius: 'var(--radius-lg)', marginBottom: '30px', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
        <SearchIcon size={22} style={{ color: 'var(--text-muted)', marginRight: '12px' }} />
        <input 
          type="text" 
          placeholder="Digitar nome da série, anime ou filme..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', padding: '10px 0', color: 'var(--text-primary)' }}
        />
        {loading && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>Buscando...</div>}
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
          <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p>Nenhum resultado encontrado para "{query}"</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Tente outras palavras-chave ou confira a grafia do nome.</p>
        </div>
      ) : (
        <div className="grid-media">
          {results.map((item) => (
            <div 
              key={item.id} 
              className="glass-card glow-hover" 
              onClick={() => onViewMedia(item.id || item.tmdbId.toString(), item.mediaType)}
              style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              {/* Media Image Wrap */}
              <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
                <img 
                  src={getImageUrl(item.posterPath)} 
                  alt={item.title}
                  loading="lazy"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-normal)' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
                
                {/* Media Type Badge */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                  <span style={{ 
                    background: item.mediaType === 'show' ? 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)' : 'linear-gradient(135deg, var(--accent) 0%, #059669 100%)',
                    color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}>
                    {item.mediaType === 'show' ? <Tv size={10} /> : <Film size={10} />}
                    {item.mediaType === 'show' ? 'Série' : 'Filme'}
                  </span>
                </div>

                {/* Rating Badge */}
                {item.rating > 0 && (
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(7, 7, 10, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <Star size={12} fill="var(--warning)" color="var(--warning)" />
                    {item.rating.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Media Title Area */}
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
      )}
    </div>
  );
};
