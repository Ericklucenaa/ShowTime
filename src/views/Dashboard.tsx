import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { Play, Check, Clock, Tv, Sparkles, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';

interface NextEpisodeItem {
  showId: string;
  showTitle: string;
  posterPath: string;
  backdropPath?: string;
  nextEpisodeId: string;
  nextEpisodeNumber: number;
  nextSeasonNumber: number;
  nextEpisodeTitle: string;
  nextEpisodeOverview: string;
  airDate?: string;
  isReleased: boolean;
  fullShowData: any;
  fullEpisodeData: any;
}

interface UpcomingReleaseItem {
  showId: string;
  showTitle: string;
  posterPath: string;
  episodeNumber: number;
  seasonNumber: number;
  episodeTitle: string;
  airDate: string;
  isRecent: boolean; // aired in last 7 days or airing soon
}

function isEpisodeReleased(airDateValue?: string): boolean {
  if (!airDateValue) return true;
  const parsed = new Date(airDateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  const releaseDay = new Date(parsed);
  releaseDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return releaseDay <= today;
}

export const Dashboard: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie', seasonNum?: number, episodeNum?: number) => void }> = ({ onViewMedia }) => {
  const { watchedEpisodes, watchedMovies, followedShows, toggleWatchEpisode, streakDays } = useTracking();
  const [nextEpisodes, setNextEpisodes] = useState<NextEpisodeItem[]>([]);
  const [upcomingReleases, setUpcomingReleases] = useState<UpcomingReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate stats
  const totalEpTime = watchedEpisodes.length * 40;
  const totalMovTime = watchedMovies.length * 110;
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);

  // Calculate Next Episodes and Upcoming Releases from followedShows & watchedEpisodes
  useEffect(() => {
    let cancelled = false;

    const loadDashboardContent = async () => {
      // Gather list of show IDs to process (followedShows + shows with watched episodes)
      const watchedShowIds = Array.from(new Set(watchedEpisodes.map(e => e.showId)));
      const allActiveShowIds = Array.from(new Set([...followedShows, ...watchedShowIds]));

      if (allActiveShowIds.length === 0) {
        setNextEpisodes([]);
        setUpcomingReleases([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Build mapping of highest watched season/episode for each show
      const showProgress: Record<string, { lastSeason: number; lastEpisode: number }> = {};
      watchedEpisodes.forEach(ev => {
        const parts = ev.episodeId.split('_');
        if (parts.length >= 4) {
          const sNum = parseInt(parts[parts.length - 2], 10);
          const eNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(sNum) && !isNaN(eNum)) {
            if (!showProgress[ev.showId]) {
              showProgress[ev.showId] = { lastSeason: sNum, lastEpisode: eNum };
            } else {
              const curr = showProgress[ev.showId];
              if (sNum > curr.lastSeason || (sNum === curr.lastSeason && eNum > curr.lastEpisode)) {
                showProgress[ev.showId] = { lastSeason: sNum, lastEpisode: eNum };
              }
            }
          }
        }
      });

      const nextEpItems: NextEpisodeItem[] = [];
      const releases: UpcomingReleaseItem[] = [];

      for (const showId of allActiveShowIds) {
        try {
          const show = await fetchMediaDetails(showId, 'show');
          if (!show || !show.seasons || show.seasons.length === 0) continue;

          const progress = showProgress[showId];
          let nextSeasonNum = progress ? progress.lastSeason : 1;
          let nextEpNum = progress ? progress.lastEpisode + 1 : 1;

          let currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          
          if (currentSeason && nextEpNum > (currentSeason.episodeCount || 999)) {
            nextSeasonNum += 1;
            nextEpNum = 1;
            currentSeason = show.seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
          }

          if (currentSeason) {
            const nextEp = currentSeason.episodes?.find((e: any) => e.episodeNumber === nextEpNum) || {
              seasonNumber: nextSeasonNum,
              episodeNumber: nextEpNum,
              title: `Episódio ${nextEpNum}`
            };
            const nextEpId = `ep_${show.id}_${nextSeasonNum}_${nextEpNum}`;

            nextEpItems.push({
              showId: show.id,
              showTitle: show.title,
              posterPath: show.posterPath,
              backdropPath: show.backdropPath,
              nextEpisodeId: nextEpId,
              nextEpisodeNumber: nextEpNum,
              nextSeasonNumber: nextSeasonNum,
              nextEpisodeTitle: nextEp.title || `Episódio ${nextEpNum}`,
              nextEpisodeOverview: nextEp.overview || '',
              airDate: nextEp.airDate,
              isReleased: isEpisodeReleased(nextEp.airDate),
              fullShowData: show,
              fullEpisodeData: nextEp
            });
          }

          // Extract recent / upcoming episodes from show
          show.seasons.forEach((s: any) => {
            s.episodes?.forEach((ep: any) => {
              if (ep.airDate) {
                const epDate = new Date(ep.airDate);
                const now = new Date();
                const diffDays = Math.round((epDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                // Released in the last 14 days or airing in the next 30 days
                if (diffDays >= -14 && diffDays <= 30) {
                  releases.push({
                    showId: show.id,
                    showTitle: show.title,
                    posterPath: show.posterPath,
                    episodeNumber: ep.episodeNumber,
                    seasonNumber: s.seasonNumber,
                    episodeTitle: ep.title || `Episódio ${ep.episodeNumber}`,
                    airDate: ep.airDate,
                    isRecent: diffDays <= 0
                  });
                }
              }
            });
          });

        } catch (e) {
          console.warn(`Error computing dashboard for show ${showId}:`, e);
        }
      }

      if (!cancelled) {
        // Sort releases: newest air date first
        releases.sort((a, b) => new Date(b.airDate).getTime() - new Date(a.airDate).getTime());
        setNextEpisodes(nextEpItems);
        setUpcomingReleases(releases.slice(0, 10));
        setLoading(false);
      }
    };

    loadDashboardContent();
    return () => { cancelled = true; };
  }, [followedShows.join(','), watchedEpisodes.length]);

  const handleQuickWatch = async (e: React.MouseEvent, item: NextEpisodeItem) => {
    e.stopPropagation();
    await toggleWatchEpisode(item.nextEpisodeId, item.fullShowData, item.fullEpisodeData);
  };

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
          background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.1) 0%, rgba(255, 122, 89, 0.06) 50%, var(--bg-surface) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="welcome-copy" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <img
            src="/logo.png"
            alt="Epsync Logo"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 6px 16px rgba(124, 92, 255, 0.45))'
            }}
          />
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              <Sparkles size={14} />
              <span>Painel Epsync</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '6px', letterSpacing: '-0.02em' }}>
              Olá, pronto para a próxima maratona?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              Aqui estão os próximos episódios das séries e animes que você acompanha, além dos lançamentos mais recentes.
            </p>
          </div>
        </div>

        <div className="hero-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          <div className="st-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{followedShows.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Séries Seguidas</div>
          </div>
          <div className="st-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{watchedEpisodes.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Episódios Vistos</div>
          </div>
          <div className="st-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-display)' }}>{totalHours}h</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tempo Assistido</div>
          </div>
          <div className="st-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: streakDays > 0 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              {streakDays} 🔥
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dias Seguidos</div>
          </div>
        </div>
      </div>

      {/* Section 1: Próximos Episódios para Você (Com base no que está seguindo) */}
      <section style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.02em', margin: 0 }}>
              Próximos Episódios para Assistir ({nextEpisodes.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="st-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Carregando seus próximos episódios...
          </div>
        ) : nextEpisodes.length === 0 ? (
          <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <Tv size={36} style={{ color: 'var(--primary)', margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Nenhuma série em andamento
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 16px' }}>
              Siga séries e animes na aba <strong>Descobrir</strong> para acompanhar o progresso episódio a episódio!
            </p>
            <button onClick={() => window.location.hash = '#/descobrir'} className="st-btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              Explorar Catálogo <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {nextEpisodes.map((item) => (
              <div
                key={item.nextEpisodeId}
                className="st-card next-ep-card"
                onClick={() => onViewMedia(item.showId, 'show', item.nextSeasonNumber, item.nextEpisodeNumber)}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
                }}
              >
                {/* Poster */}
                <div style={{ width: '70px', height: '105px', flexShrink: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', position: 'relative', background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
                  <img
                    src={getImageUrl(item.posterPath)}
                    alt={item.showTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', padding: '2px', textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary)' }}>
                      S{item.nextSeasonNumber} E{item.nextEpisodeNumber}
                    </span>
                  </div>
                </div>

                {/* Episode Details */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                      {item.showTitle}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nextEpisodeTitle}
                    </p>
                    {item.airDate && (
                      <span style={{ fontSize: '10px', color: item.isReleased ? 'var(--text-muted)' : 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {item.isReleased ? `Lançado em ${new Date(item.airDate).toLocaleDateString('pt-BR')}` : `Estreia em ${new Date(item.airDate).toLocaleDateString('pt-BR')}`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                      Assistir Agora →
                    </span>
                    <button
                      onClick={(e) => handleQuickWatch(e, item)}
                      className="st-btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-elevated)' }}
                      title="Marcar como assistido"
                    >
                      <Check size={12} /> Marcar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Próximos Lançamentos & Estreias Recentes */}
      {upcomingReleases.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CalendarIcon size={18} style={{ color: 'var(--secondary)' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.02em', margin: 0 }}>
              Lançamentos Recentes & Próximas Estreias
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {upcomingReleases.map((rel, idx) => (
              <div
                key={idx}
                className="st-card"
                onClick={() => onViewMedia(rel.showId, 'show', rel.seasonNumber, rel.episodeNumber)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ width: '44px', height: '64px', flexShrink: 0, borderRadius: 'var(--radius-xs)', overflow: 'hidden', background: 'var(--bg-dark)' }}>
                  <img src={getImageUrl(rel.posterPath)} alt={rel.showTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rel.showTitle}
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, marginBottom: '2px' }}>
                    T{rel.seasonNumber}:E{rel.episodeNumber} • {rel.episodeTitle}
                  </div>
                  <div style={{ fontSize: '10px', color: rel.isRecent ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {rel.isRecent ? '⚡ Recém Lançado (' : '📅 Estreia: '}
                    {new Date(rel.airDate).toLocaleDateString('pt-BR')}
                    {rel.isRecent ? ')' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
