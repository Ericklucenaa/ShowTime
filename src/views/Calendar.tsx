import React, { useEffect, useMemo, useState } from 'react';
import { fetchTVMazeSchedule, getImageUrl, fetchMediaDetails, fetchSeasonEpisodes } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { Calendar as CalendarIcon, Clock, Tv } from 'lucide-react';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

interface CalendarProps {
  onViewMedia: (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => void;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function normalizeAirDateToKey(airDate: string): string {
  if (!airDate) return '';
  if (!airDate.includes('T')) return airDate.slice(0, 10);
  const dt = new Date(airDate);
  if (Number.isNaN(dt.getTime())) return airDate.slice(0, 10);
  return formatDateKeyFromDate(dt);
}

function formatDateLabel(d: Date) {
  return `${DAY_LABELS[d.getDay()]}, ${d.getDate()} de ${MONTH_LABELS[d.getMonth()]}`;
}

function formatEpisodeBadge(airDate: string) {
  if (!airDate) return 'Sem horario';
  if (!airDate.includes('T')) return 'Lanca hoje';
  const dt = new Date(airDate);
  if (Number.isNaN(dt.getTime())) return 'Sem horario';
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const Calendar: React.FC<CalendarProps> = ({ onViewMedia }) => {
  const { watchedEpisodes, followedShows, lists, fetchListItems } = useTracking();

  const [personalCalendar, setPersonalCalendar] = useState<any[]>([]);
  const [globalCalendar, setGlobalCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [reminders, setReminders] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    try {
      const raw = localStorage.getItem('showtime_calendar_reminders');
      if (raw) setReminders(JSON.parse(raw));
    } catch {
      setReminders([]);
    }
  }, []);

  const persistReminders = (next: string[]) => {
    setReminders(next);
    localStorage.setItem('showtime_calendar_reminders', JSON.stringify(next));
  };

  const toggleReminder = (id: string, label: string) => {
    const exists = reminders.includes(id);
    const next = exists ? reminders.filter((x) => x !== id) : [...reminders, id];
    persistReminders(next);
    pushToast('info', exists ? 'Lembrete removido.' : `Lembrete salvo: ${label}`);
    trackEvent('calendar_reminder_toggled', { id, enabled: !exists });
  };

  useEffect(() => {
    const loadCalendar = async () => {
      setLoading(true);
      try {
        const showIds = new Set<string>([
          ...followedShows,
          ...watchedEpisodes.map((we) => we.showId)
        ]);

        try {
          for (const list of lists || []) {
            const listData = await fetchListItems(list.id);
            if (listData?.items) {
              for (const item of listData.items) {
                if (item.mediaType === 'show' && item.mediaId) {
                  showIds.add(item.mediaId);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not load list items for calendar:', e);
        }

        const personalEvents: any[] = [];

        for (const showId of showIds) {
          try {
            const show = await fetchMediaDetails(showId, 'show');
            if (!show || !show.seasons) continue;

            for (const season of show.seasons) {
              let episodes = season.episodes;
              if (!episodes || episodes.length === 0) {
                try {
                  episodes = await fetchSeasonEpisodes(showId, season.seasonNumber);
                } catch {
                  continue;
                }
              }

              if (!episodes) continue;

              for (const ep of episodes) {
                if (!ep.airDate) continue;
                const airDate = new Date(ep.airDate);
                const now = new Date();
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setDate(now.getDate() - 90);
                const threeMonthsAhead = new Date();
                threeMonthsAhead.setDate(now.getDate() + 90);

                if (airDate >= threeMonthsAgo && airDate <= threeMonthsAhead) {
                  personalEvents.push({
                    id: `cal_${show.id}_${season.seasonNumber}_${ep.episodeNumber}`,
                    showId: show.id,
                    showTitle: show.title,
                    showPoster: show.posterPath,
                    seasonNumber: season.seasonNumber,
                    episodeNumber: ep.episodeNumber,
                    title: ep.title,
                    overview: ep.overview || '',
                    airDate: ep.airDate,
                    airDateMs: airDate.getTime()
                  });
                }
              }
            }
          } catch (err) {
            console.warn(`Calendar: failed to load show ${showId}:`, err);
          }
        }

        personalEvents.sort((a, b) => a.airDateMs - b.airDateMs);
        setPersonalCalendar(personalEvents);

        try {
          const tvmazeData = await fetchTVMazeSchedule();
          setGlobalCalendar(tvmazeData.slice(0, 20));
        } catch {
          setGlobalCalendar([]);
        }
      } catch (e) {
        console.error('Error loading calendar', e);
      } finally {
        setLoading(false);
      }
    };

    const timer = window.setTimeout(loadCalendar, 120);
    return () => window.clearTimeout(timer);
  }, [followedShows.join('|'), watchedEpisodes.length, lists.length]);

  const groupedPersonal: Record<string, any[]> = {};
  for (const item of personalCalendar) {
    const key = normalizeAirDateToKey(item.airDate);
    if (!key) continue;
    if (!groupedPersonal[key]) groupedPersonal[key] = [];
    groupedPersonal[key].push(item);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateKeyFromDate(today);

  const visibleDates = useMemo(() => {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const days: string[] = [];
    const cursor = new Date(monthStart);

    while (cursor <= monthEnd) {
      days.push(formatDateKeyFromDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [today.getFullYear(), today.getMonth()]);

  useEffect(() => {
    if (visibleDates.length === 0) {
      setSelectedDateKey('');
      return;
    }

    if (selectedDateKey && visibleDates.includes(selectedDateKey)) return;

    if (visibleDates.includes(todayStr)) {
      setSelectedDateKey(todayStr);
      return;
    }

    setSelectedDateKey(visibleDates[0]);
  }, [selectedDateKey, visibleDates, todayStr]);

  const selectedDateObj = selectedDateKey ? dateFromKey(selectedDateKey) : null;
  const selectedItems = selectedDateKey ? groupedPersonal[selectedDateKey] || [] : [];

  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '40px', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <div className="calendar-top-block" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '16px', width: '100%', maxWidth: '100%' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Calendario de Lancamentos</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Arraste os dias para o lado e veja o que estreia em cada data.</p>
        </div>

        <div className="calendar-tab-switch" style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('personal')}
            className={`calendar-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          >
            Meu Cronograma ({personalCalendar.length})
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`calendar-tab-btn ${activeTab === 'global' ? 'active' : ''}`}
          >
            Estreias Globais
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Carregando seu cronograma...
        </div>
      )}

      {!loading && activeTab === 'personal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="st-panel" style={{ padding: '14px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Arraste para o lado para navegar pelos dias do mes</p>
            <div className="calendar-day-strip" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', width: '100%', maxWidth: '100%', touchAction: 'pan-x' }}>
              {visibleDates.map((dateKey) => {
                const dateObj = dateFromKey(dateKey);
                const isActive = dateKey === selectedDateKey;
                const count = groupedPersonal[dateKey]?.length || 0;

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDateKey(dateKey)}
                    className={`calendar-day-btn ${isActive ? 'active' : ''}`}
                    style={{
                      minWidth: '86px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '12px',
                      borderRadius: '12px'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{DAY_LABELS[dateObj.getDay()]}</span>
                    <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1 }}>{dateObj.getDate()}</span>
                    <span style={{ fontSize: '11px', opacity: 0.85 }}>{MONTH_LABELS[dateObj.getMonth()]}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>{count} ep</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDateObj && (
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', lineHeight: 1.1 }}>
              {formatDateLabel(selectedDateObj)}
            </h3>
          )}

          {selectedItems.length === 0 ? (
            <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Sem lancamentos nesse dia.
            </div>
          ) : (
            <div className="calendar-episode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="st-card glow-hover calendar-episode-card"
                  onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                  style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div className="calendar-episode-image" style={{ position: 'relative', width: '100%', height: '130px' }}>
                    <img
                      src={getImageUrl(item.showPoster)}
                      alt={item.showTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{ position: 'absolute', left: '8px', bottom: '8px', background: 'rgba(0,0,0,0.65)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}>
                      {formatEpisodeBadge(item.airDate)}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px' }}>
                    <h4 className="calendar-episode-title" style={{ fontSize: '15px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.showTitle}
                    </h4>
                    <div className="calendar-episode-subtitle" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      T{item.seasonNumber} • E{item.episodeNumber} • {item.title || 'Novo episodio'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReminder(item.id, `${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`);
                      }}
                      className={`calendar-reminder-btn ${reminders.includes(item.id) ? 'active' : ''}`}
                      style={{ width: '100%', fontSize: '12px', padding: '8px 10px' }}
                    >
                      {reminders.includes(item.id) ? 'Lembrete ativo' : 'Adicionar lembrete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <style>{`
            .calendar-tab-btn {
              border: 1px solid var(--border-color);
              border-radius: 10px;
              padding: 6px 12px;
              font-size: 13px;
              font-weight: 700;
              background: transparent;
              color: var(--text-secondary);
              cursor: pointer;
              min-width: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .calendar-tab-btn.active {
              background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
              color: #000;
              border-color: transparent;
              box-shadow: 0 5px 14px rgba(245, 197, 24, 0.3);
            }

            .calendar-day-strip::-webkit-scrollbar {
              display: none;
            }

            .calendar-day-strip {
              -webkit-overflow-scrolling: touch;
              overscroll-behavior-x: contain;
              overflow-y: hidden;
              scroll-snap-type: x proximity;
            }

            .calendar-day-btn {
              flex: 0 0 auto;
              border: 1px solid var(--border-color);
              background: transparent;
              color: var(--text-primary);
              cursor: pointer;
              scroll-snap-align: start;
            }

            .calendar-day-btn.active {
              border-color: transparent;
              background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
              color: #000;
              box-shadow: 0 6px 16px rgba(245, 197, 24, 0.3);
            }

            .calendar-episode-card {
              min-width: 0;
            }

            .calendar-episode-title,
            .calendar-episode-subtitle {
              min-width: 0;
            }

            .calendar-reminder-btn {
              border-radius: 999px;
              border: 1px solid var(--border-color);
              background: rgba(255, 255, 255, 0.02);
              color: var(--text-primary);
              font-weight: 700;
              cursor: pointer;
            }

            .calendar-reminder-btn.active {
              border-color: transparent;
              background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
              color: #000;
            }

            @media (max-width: 760px) {
              .calendar-top-block {
                position: relative;
                padding-bottom: 10px;
                align-items: stretch;
              }

              .calendar-tab-switch {
                width: 100%;
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }

              .calendar-tab-btn {
                width: 100%;
                text-align: center;
              }

              .calendar-episode-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }

              .calendar-episode-image {
                height: 112px !important;
              }

              .calendar-episode-subtitle {
                white-space: normal !important;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
              }
            }

            @media (max-width: 390px) {
              .calendar-tab-btn {
                font-size: 12px;
                padding: 7px 8px;
              }

              .calendar-episode-image {
                height: 100px !important;
              }

              .calendar-episode-grid {
                gap: 10px !important;
              }
            }
          `}</style>
        </div>
      )}

      {!loading && activeTab === 'global' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {globalCalendar.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Nenhum lancamento global obtido hoje.</div>
          ) : (
            globalCalendar.map((item) => (
              <div
                key={item.id}
                className="st-card calendar-card"
                style={{ display: 'flex', padding: '14px', gap: '14px', alignItems: 'center' }}
              >
                {item.showPoster ? (
                  <img
                    src={item.showPoster}
                    alt={item.showTitle}
                    style={{ width: '45px', height: '67px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: '45px', height: '67px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tv size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '15px', marginBottom: '3px' }}>{item.showTitle}</h4>
                  <div style={{ fontSize: '13px', color: 'var(--secondary)', fontWeight: 700 }}>
                    T{item.seasonNumber.toString().padStart(2, '0')}E{item.episodeNumber.toString().padStart(2, '0')} - {item.title}
                  </div>
                </div>
                <div className="card-date" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'end', flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'rgba(236,72,153,0.1)', color: 'var(--secondary)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>
                    <CalendarIcon size={12} />
                    {new Date(item.airDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </span>
                  {item.time && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Clock size={10} />
                      {item.time}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
