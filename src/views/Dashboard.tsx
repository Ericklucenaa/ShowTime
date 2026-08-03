import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { Play, Check, Clock, Film, Tv, Trophy } from 'lucide-react';

interface ContinueWatchingItem {
  showId: string;
  showTitle: string;
  posterPath: string;
  nextEpisodeId: string;
  nextEpisodeNumber: number;
  nextSeasonNumber: number;
  nextEpisodeTitle: string;
  nextEpisodeOverview: string;
  fullShowData: any;
  fullEpisodeData: any;
}

export const Dashboard: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { watchedEpisodes, watchedMovies, toggleWatchEpisode } = useTracking();
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate stats
  const totalEpTime = watchedEpisodes.length * 40; // Assume avg 40 mins per episode
  // Look up actual movie durations if available, otherwise assume 120 mins
  const totalMovTime = watchedMovies.length * 120;
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);

  useEffect(() => {
    const calculateContinueWatching = async () => {
      if (watchedEpisodes.length === 0) {
        setContinueWatching([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      // Group watched episodes by show
      const showProgress: Record<string, { lastSeason: number; lastEpisode: number }> = {};
      watchedEpisodes.forEach(ev => {
        // Extract season/episode details from episodeId or database metadata if possible
        // For simplicity, we parse our standard id format "ep_s{X}_{S}_{E}" or fetch show details
        const parts = ev.episodeId.split('_');
        if (parts.length >= 4) {
          const showId = ev.showId;
          const sNum = parseInt(parts[parts.length - 2]);
          const eNum = parseInt(parts[parts.length - 1]);
          if (!isNaN(sNum) && !isNaN(eNum)) {
            if (!showProgress[showId]) {
              showProgress[showId] = { lastSeason: sNum, lastEpisode: eNum };
            } else {
              const curr = showProgress[showId];
              if (sNum > curr.lastSeason || (sNum === curr.lastSeason && eNum > curr.lastEpisode)) {
                showProgress[showId] = { lastSeason: sNum, lastEpisode: eNum };
              }
            }
          }
        } else {
          // Default fallback if ID format is different (e.g. imported)
          // We can group and fetch
          if (!showProgress[ev.showId]) {
            showProgress[ev.showId] = { lastSeason: 1, lastEpisode: 1 };
          }
        }
      });

      const items: ContinueWatchingItem[] = [];
      const showIds = Object.keys(showProgress);

      for (const showId of showIds) {
        try {
          const show = await fetchMediaDetails(showId, 'show');
          if (!show || !show.seasons) continue;

          const progress = showProgress[showId];
          let nextSeasonNum = progress.lastSeason;
          let nextEpNum = progress.lastEpisode + 1;

          // Find the season
          let currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          
          // If episode number exceeds episodes in this season, move to next season
          if (currentSeason && nextEpNum > currentSeason.episodeCount) {
            nextSeasonNum += 1;
            nextEpNum = 1;
            currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          }

          if (currentSeason) {
            // Find episode metadata
            const nextEp = currentSeason.episodes?.find((e: any) => e.episodeNumber === nextEpNum);
            
            // Generate standard episode ID
            const nextEpId = `ep_${show.id}_${nextSeasonNum}_${nextEpNum}`;

            items.push({
              showId: show.id,
              showTitle: show.title,
              posterPath: show.posterPath,
              nextEpisodeId: nextEpId,
              nextEpisodeNumber: nextEpNum,
              nextSeasonNumber: nextSeasonNum,
              nextEpisodeTitle: nextEp ? nextEp.title : `Episódio ${nextEpNum}`,
              nextEpisodeOverview: nextEp ? nextEp.overview : '',
              fullShowData: show,
              fullEpisodeData: nextEp || { seasonNumber: nextSeasonNum, episodeNumber: nextEpNum }
            });
          }
        } catch (e) {
          console.error(`Error calculating next episode for show ${showId}`, e);
        }
      }

      setContinueWatching(items);
      setLoading(false);
    };

    calculateContinueWatching();
  }, [watchedEpisodes]);

  const handleQuickWatch = async (e: React.MouseEvent, item: ContinueWatchingItem) => {
    e.stopPropagation(); // Prevent opening show detail
    await toggleWatchEpisode(item.nextEpisodeId, item.fullShowData, item.fullEpisodeData);
  };

  // Get last 4 watch events for display
  const sortedRecentEpisodes = [...watchedEpisodes]
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    .slice(0, 3);

  const sortedRecentMovies = [...watchedMovies]
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    .slice(0, 3);

  return (
    <div className="dashboard-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Welcome Banner & Quick Stats */}
      <div className="welcome-banner glass-panel" style={{ padding: '24px', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '6px' }}>Olá, Bem-vindo ao ShowTime!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Acompanhe suas séries e filmes preferidos em um só lugar.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="stat-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', padding: '12px 18px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{totalHours}h</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tempo Assistido</div>
            </div>
          </div>
          <div className="stat-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', padding: '12px 18px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Tv size={24} style={{ color: 'var(--secondary)' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{watchedEpisodes.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Episódios Vistos</div>
            </div>
          </div>
          <div className="stat-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', padding: '12px 18px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Film size={24} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{watchedMovies.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filmes Vistos</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }} className="dashboard-grid">
        
        {/* Main Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Continue Watching Section */}
          <section>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={20} style={{ color: 'var(--primary)' }} />
              Continuar Assistindo
            </h3>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando episódios pendentes...</div>
            ) : continueWatching.length === 0 ? (
              <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>Nenhuma série em andamento.</p>
                <p style={{ fontSize: '13px', marginTop: '6px' }}>Busque por uma série e marque um episódio para começar a acompanhar!</p>
              </div>
            ) : (
              <div className="media-carousel">
                {continueWatching.map(item => {
                  // Calculate dummy progress percentage based on next episode number vs total
                  const totalEps = item.fullEpisodeData?.seasonNumber ? (item.fullEpisodeData.episodeCount || 10) : 10;
                  const progressPct = Math.min(100, Math.max(10, ((item.nextEpisodeNumber - 1) / totalEps) * 100));
                  
                  return (
                    <div 
                      key={item.showId} 
                      className="carousel-item" 
                      onClick={() => onViewMedia(item.showId, 'show')}
                    >
                      <img 
                        src={getImageUrl(item.posterPath)} 
                        alt={item.showTitle} 
                        className="carousel-poster"
                      />
                      <div className="carousel-item-overlay">
                        <span className="carousel-item-title">
                          {item.showTitle}<br/>
                          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'normal' }}>
                            S{item.nextSeasonNumber.toString().padStart(2, '0')} E{item.nextEpisodeNumber.toString().padStart(2, '0')}
                          </span>
                        </span>
                      </div>
                      
                      {/* Play/Check button hovering over poster */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleQuickWatch(e, item); }}
                        className="st-btn-primary"
                        style={{ position: 'absolute', top: '10px', right: '10px', width: '36px', height: '36px', padding: 0, minWidth: '36px' }}
                        title="Marcar como assistido"
                      >
                        <Check size={16} />
                      </button>

                      <div className="carousel-progress-bar-bg">
                        <div className="carousel-progress-bar-fill" style={{ width: `${progressPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        {/* Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Recently Watched */}
          <section className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} style={{ color: 'var(--secondary)' }} />
              Atividades Recentes
            </h3>

            {sortedRecentEpisodes.length === 0 && sortedRecentMovies.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '13px' }}>
                Nenhuma atividade recente registrada.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sortedRecentEpisodes.map((ev, i) => {
                  const parts = ev.episodeId.split('_');
                  const s = parts[2] || '1';
                  const e = parts[3] || '1';
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', paddingBottom: '10px', borderBottom: i < sortedRecentEpisodes.length - 1 || sortedRecentMovies.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '5px' }}></div>
                      <div>
                        <div>Assistiu o episódio <strong>T{s}E{e}</strong></div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                          {new Date(ev.watchedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedRecentMovies.map((ev, i) => (
                  <div key={ev.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', paddingBottom: '10px', borderBottom: i < sortedRecentMovies.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', marginTop: '5px' }}></div>
                    <div>
                      <div>Assistiu o filme <strong>{ev.movieTitle || 'Filme'}</strong></div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                        {new Date(ev.watchedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

      </div>

      {/* CSS overrides inside Dashboard view for smaller layouts */}
      <style>{`
        @media (max-width: 800px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
