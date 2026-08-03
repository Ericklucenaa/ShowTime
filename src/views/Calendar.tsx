import React, { useState, useEffect, useRef } from 'react';
import { fetchTVMazeSchedule, getImageUrl, fetchMediaDetails, fetchSeasonEpisodes } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { Calendar as CalendarIcon, Clock, Tv } from 'lucide-react';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

interface CalendarProps {
  onViewMedia: (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => void;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateLabel(d: Date) {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Hoje';
  if (isSameDay(d, tomorrow)) return 'Amanhã';
  if (isSameDay(d, yesterday)) return 'Ontem';
  return `${DAY_LABELS[d.getDay()]}, ${d.getDate()} de ${MONTH_LABELS[d.getMonth()]}`;
}

function formatEpisodeBadge(airDate: string) {
  if (!airDate) return 'Sem horário';
  if (!airDate.includes('T')) return 'Lança hoje';
  const dt = new Date(airDate);
  if (Number.isNaN(dt.getTime())) return 'Sem horário';
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const Calendar: React.FC<CalendarProps> = ({ onViewMedia }) => {
  const { watchedEpisodes, followedShows, lists, fetchListItems } = useTracking();
  const [personalCalendar, setPersonalCalendar] = useState<any[]>([]);
  const [globalCalendar, setGlobalCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'next7'>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [reminders, setReminders] = useState<string[]>([]);

  useEffect(() => {
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

  const followedShowsRef = useRef(followedShows);
  const watchedEpisodesRef = useRef(watchedEpisodes);
  const listsRef = useRef(lists);
  const fetchListItemsRef = useRef(fetchListItems);

  // Keep refs in sync without triggering re-renders
  followedShowsRef.current = followedShows;
  watchedEpisodesRef.current = watchedEpisodes;
  listsRef.current = lists;
  fetchListItemsRef.current = fetchListItems;

  const loadCalendar = async () => {
    setLoading(true);
    try {
      // Gather all unique show IDs from followed + watched + lists
      const showIds = new Set<string>([
        ...followedShowsRef.current,
        ...watchedEpisodesRef.current.map(we => we.showId)
      ]);

      // Add show IDs from list items (read from ref, no state updates)
      try {
        for (const list of (listsRef.current || [])) {
          const listData = await fetchListItemsRef.current(list.id);
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
              } catch (_) {
                continue;
              }
            }

            if (!episodes) continue;

            for (const ep of episodes) {
              if (!ep.airDate) continue;
              const airDate = new Date(ep.airDate);
              const now = new Date();
              const threeMonthsAgo = new Date(); threeMonthsAgo.setDate(now.getDate() - 90);
              const threeMonthsAhead = new Date(); threeMonthsAhead.setDate(now.getDate() + 90);

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

      // Global calendar from TVMaze
      try {
        const tvmazeData = await fetchTVMazeSchedule();
        setGlobalCalendar(tvmazeData.slice(0, 20));
      } catch (_) {
        setGlobalCalendar([]);
      }
    } catch (e) {
      console.error('Error loading calendar', e);
    } finally {
      setLoading(false);
    }
  };

  const followedKey = followedShows.join('|');
  const watchedKey = watchedEpisodes.length;
  const listsKey = lists.length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCalendar();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [followedKey, watchedKey, listsKey]);

  // Group calendar events by date string (YYYY-MM-DD)
  const groupedPersonal: Record<string, any[]> = {};
  for (const item of personalCalendar) {
    const key = item.airDate.slice(0, 10);
    if (!groupedPersonal[key]) groupedPersonal[key] = [];
    groupedPersonal[key].push(item);
  }
  const sortedDates = Object.keys(groupedPersonal).sort();
  const todayStr = new Date().toISOString().slice(0, 10);
  const next7Str = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const filteredDates = sortedDates.filter((dateKey) => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return dateKey === todayStr;
    return dateKey >= todayStr && dateKey <= next7Str;
  });

  useEffect(() => {
    if (filteredDates.length === 0) {
      setSelectedDateKey('');
      return;
    }

    if (selectedDateKey && filteredDates.includes(selectedDateKey)) return;

    if (filteredDates.includes(todayStr)) {
      setSelectedDateKey(todayStr);
      return;
    }

    setSelectedDateKey(filteredDates[0]);
  }, [selectedDateKey, filteredDates, todayStr]);

  const selectedDateObj = selectedDateKey ? new Date(`${selectedDateKey}T12:00:00`) : null;
  const selectedItems = selectedDateKey ? groupedPersonal[selectedDateKey] || [] : [];

  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Calendário de Lançamentos</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Suas séries favoritas, organizadas por dia de estreia.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('personal')}
            className={activeTab === 'personal' ? 'st-btn-primary' : 'st-btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '13px', border: 'none', background: activeTab === 'personal' ? undefined : 'transparent' }}
          >
            Meu Cronograma ({personalCalendar.length})
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={activeTab === 'global' ? 'st-btn-primary' : 'st-btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '13px', border: 'none', background: activeTab === 'global' ? undefined : 'transparent' }}
          >
            Estreias Globais
          </button>
        </div>

        {activeTab === 'personal' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setDateFilter('all')} className={dateFilter === 'all' ? 'st-btn-primary' : 'st-btn-secondary'} style={{ padding: '6px 12px', fontSize: '12px' }}>
              Tudo
            </button>
            <button onClick={() => setDateFilter('today')} className={dateFilter === 'today' ? 'st-btn-primary' : 'st-btn-secondary'} style={{ padding: '6px 12px', fontSize: '12px' }}>
              Hoje
            </button>
            <button onClick={() => setDateFilter('next7')} className={dateFilter === 'next7' ? 'st-btn-primary' : 'st-btn-secondary'} style={{ padding: '6px 12px', fontSize: '12px' }}>
              Próx. 7 dias
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Carregando seu cronograma...
        </div>
      )}

      {!loading && activeTab === 'personal' && (
        personalCalendar.length === 0 ? (
          <div className="st-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CalendarIcon size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Nenhum episódio no seu cronograma</p>
            <p style={{ fontSize: '13px' }}>Siga séries ou adicione-as às suas listas para ver as datas de estreia aqui.</p>
            <button onClick={() => setActiveTab('global')} className="st-btn-primary" style={{ marginTop: '20px' }}>Ver Estreias Globais</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="st-panel" style={{ padding: '14px' }}>
              <div className="calendar-day-strip" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {filteredDates.map((dateKey) => {
                  const dateObj = new Date(`${dateKey}T12:00:00`);
                  const isActive = dateKey === selectedDateKey;
                  const count = groupedPersonal[dateKey]?.length || 0;
                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={isActive ? 'st-btn-primary' : 'st-btn-secondary'}
                      style={{
                        minWidth: '86px',
                        borderRadius: '12px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '12px',
                        background: isActive ? undefined : 'transparent',
                        border: isActive ? 'none' : '1px solid var(--border-color)'
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
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', lineHeight: 1.1 }}>
                {formatDateLabel(selectedDateObj)}
              </h3>
            )}

            {selectedItems.length === 0 ? (
              <div className="st-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Sem lançamentos nesse dia.
              </div>
            ) : (
              <div className="calendar-episode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '14px' }}>
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="st-card glow-hover calendar-episode-card"
                    onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '142px' }}>
                      <img
                        src={getImageUrl(item.showPoster)}
                        alt={item.showTitle}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div style={{ position: 'absolute', left: '8px', bottom: '8px', background: 'rgba(0,0,0,0.65)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}>
                        {formatEpisodeBadge(item.airDate)}
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <h4 style={{ fontSize: '17px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.showTitle}</h4>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        T{item.seasonNumber} • E{item.episodeNumber} • {item.title || 'Novo episódio'}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReminder(item.id, `${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`);
                        }}
                        className={reminders.includes(item.id) ? 'st-btn-primary' : 'st-btn-secondary'}
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
              .calendar-day-strip::-webkit-scrollbar {
                display: none;
              }

              @media (max-width: 760px) {
                .calendar-episode-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }
              }

              @media (max-width: 520px) {
                .calendar-episode-grid {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>
          </div>
        )
      )}

      {!loading && activeTab === 'global' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {globalCalendar.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Nenhum lançamento global obtido hoje.</div>
          ) : (
            globalCalendar.map(item => (
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
