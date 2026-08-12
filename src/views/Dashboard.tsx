import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { useNotifications } from '../context/NotificationContext.js';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { Play, Check, Clock, Film, Tv, Flame, Bell, Sparkles } from 'lucide-react';

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

export const Dashboard: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie', seasonNum?: number, episodeNum?: number) => void }> = ({ onViewMedia }) => {
  const { watchedEpisodes, watchedMovies, toggleWatchEpisode, streakDays, lastWatchedAt, favoriteGenres, totalWatchEvents } = useTracking();
  const { reminders } = useNotifications();
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate stats
  const totalEpTime = watchedEpisodes.length * 40;
  const totalMovTime = watchedMovies.length * 120;
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const daysWithoutWatching = lastWatchedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastWatchedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  useEffect(() => {
    const calculateContinueWatching = async () => {
      if (watchedEpisodes.length === 0) {
        setContinueWatching([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const showProgress: Record<string, { lastSeason: number; lastEpisode: number }> = {};
      watchedEpisodes.forEach(ev => {
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

          let currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          
          if (currentSeason && nextEpNum > currentSeason.episodeCount) {
            nextSeasonNum += 1;
            nextEpNum = 1;
            currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          }

          if (currentSeason) {
            const nextEp = currentSeason.episodes?.find((e: any) => e.episodeNumber === nextEpNum);
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
    e.stopPropagation();
    await toggleWatchEpisode(item.nextEpisodeId, item.fullShowData, item.fullEpisodeData);
  };

  const sortedRecentEpisodes = [...watchedEpisodes]
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    .slice(0, 3);

  const sortedRecentMovies = [...watchedMovies]
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    .slice(0, 3);

  return (
    <div className="dashboard-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Welcome Banner & Quick Stats */}
      <div
        className="welcome-banner st-panel"
        style={{
          padding: '24px 28px',
          marginBottom: '28px',
          display: 'grid',
          gap: '20px',
          background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.08) 0%, rgba(255, 122, 89, 0.05) 50%, var(--bg-surface) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="welcome-copy">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <Sparkles size={14} />
            <span>Painel Principal</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Olá, Bem-vindo ao Epsync!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.4 }}>
            Sua central para sincronizar e acompanhar tudo o que você assiste em um só lugar.
          </p>
          {lastWatchedAt && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
              Última atividade: {new Date(lastWatchedAt).toLocaleDateString('pt-BR')} {daysWithoutWatching > 0 ? `• ${daysWithoutWatching} dia(s) sem assistir` : '• tudo em dia 🔥'}
            </p>
          )}
        </div>

        <div className="welcome-stats-grid">
          <div className="stat-badge" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '14px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(124, 92, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{totalHours}h</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tempo Assistido</div>
            </div>
          </div>

          <div className="stat-badge" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '14px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 122, 89, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Tv size={20} style={{ color: 'var(--secondary)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{watchedEpisodes.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Episódios Vistos</div>
            </div>
          </div>

          <div className="stat-badge" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '14px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Film size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{watchedMovies.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filmes Vistos</div>
            </div>
          </div>

          <div className="stat-badge" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '14px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{streakDays} dias</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Streak Atual</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px' }} className="dashboard-grid">
        
        {/* Main Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Continue Watching Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={18} style={{ color: 'var(--primary)' }} />
                Continuar Assistindo
              </h3>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando episódios pendentes...</div>
            ) : continueWatching.length === 0 ? (
              <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Nenhuma série em andamento.</p>
                <p style={{ fontSize: '13px' }}>Descubra uma série e marque o primeiro episódio para acompanhar seu progresso aqui!</p>
              </div>
            ) : (
              <div className="media-carousel">
                {continueWatching.map(item => {
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
                          <span style={{ fontSize: '11px', color: 'var(--secondary)', fontWeight: 600 }}>
                            S{item.nextSeasonNumber.toString().padStart(2, '0')} E{item.nextEpisodeNumber.toString().padStart(2, '0')}
                          </span>
                        </span>
                      </div>
                      
                      {/* Play/Check button hovering over poster */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleQuickWatch(e, item); }}
                        className="st-btn-primary"
                        style={{ position: 'absolute', top: '8px', right: '8px', width: '32px', height: '32px', padding: 0, minWidth: '32px', borderRadius: 'var(--radius-full)' }}
                        title="Marcar episódio como assistido"
                      >
                        <Check size={15} />
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

          {/* Smart Timeline Section */}
          <section className="st-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', marginBottom: '14px' }}>
              Linha do Tempo Inteligente
            </h3>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Eventos de Watch</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>{totalWatchEvents}</div>
              </div>
              <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dias Sem Assistir</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{daysWithoutWatching}</div>
              </div>
              <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gêneros em Alta</div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '6px', color: 'var(--text-secondary)' }}>
                  {favoriteGenres.length > 0 ? favoriteGenres.join(' • ') : 'Sem dados ainda'}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          
          {/* Active Reminders Card */}
          {reminders.length > 0 && (
            <section className="st-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={17} style={{ color: 'var(--secondary)' }} />
                Lembretes Ativos ({reminders.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reminders.slice(0, 4).map(rem => (
                  <div
                    key={rem.id}
                    onClick={() => onViewMedia(rem.showId, 'show', rem.seasonNumber, rem.episodeNumber)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'var(--bg-dark)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'var(--bg-dark)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rem.showTitle}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        T{rem.seasonNumber} E{rem.episodeNumber} {rem.airDate ? `• ${rem.airDate}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(124, 92, 255, 0.12)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(124, 92, 255, 0.25)' }}>
                      Ativo
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recently Watched */}
          <section className="st-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={17} style={{ color: 'var(--secondary)' }} />
              Atividades Recentes
            </h3>

            {sortedRecentEpisodes.length === 0 && sortedRecentMovies.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0', fontSize: '13px' }}>
                Nenhuma atividade recente registrada.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedRecentEpisodes.map((ev, i) => {
                  const parts = ev.episodeId.split('_');
                  const s = parts[2] || '1';
                  const e = parts[3] || '1';
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', paddingBottom: '10px', borderBottom: i < sortedRecentEpisodes.length - 1 || sortedRecentMovies.length > 0 ? '1px solid var(--border-color)' : 'none' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px', flexShrink: 0 }}></div>
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
                  <div key={ev.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', paddingBottom: '10px', borderBottom: i < sortedRecentMovies.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', marginTop: '6px', flexShrink: 0 }}></div>
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

      <style>{`
        .welcome-banner {
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          align-items: center;
        }

        .welcome-copy {
          min-width: 0;
        }

        .welcome-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
          align-self: stretch;
        }

        @media (max-width: 800px) {
          .welcome-banner {
            grid-template-columns: 1fr;
            padding: 20px !important;
          }

          .welcome-copy h2 {
            font-size: 22px !important;
          }

          .welcome-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .dashboard-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }

        @media (max-width: 420px) {
          .welcome-stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .stat-badge {
            padding: 10px !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};
