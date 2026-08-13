import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Bell } from 'lucide-react';
import { useTracking } from '../context/TrackingContext.js';
import { useNotifications } from '../context/NotificationContext.js';
import { fetchMediaDetails, fetchSeasonEpisodes, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';

interface CalendarProps {
  onViewMedia: (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => void;
}

interface PersonalEvent {
  id: string;
  showId: string;
  showTitle: string;
  showPoster: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  airDate: string;
  airDateMs: number;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DATE_PAGE_SIZE = 5;

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function normalizeAirDateToKey(rawDate?: string): string {
  if (!rawDate) return '';
  if (rawDate.length === 10 && rawDate.includes('-')) return rawDate;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateKey(parsed);
}

function formatHeaderDate(d: Date): string {
  return `${DAY_LABELS[d.getDay()]}, ${d.getDate()} de ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function formatEpisodeTime(airDate: string): string {
  if (!airDate) return 'Sem horário';
  if (!airDate.includes('T')) return 'Hoje';
  const parsed = new Date(airDate);
  if (Number.isNaN(parsed.getTime())) return 'Sem horário';
  return parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const Calendar: React.FC<CalendarProps> = ({ onViewMedia }) => {
  const { watchedEpisodes, followedShows, lists, fetchListItems } = useTracking();
  const { isReminderActive, toggleEpisodeReminder, requestNotificationPermission, browserNotificationPermission } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [rangeStartOffset, setRangeStartOffset] = useState(0);
  const [upcomingOffset, setUpcomingOffset] = useState(1);
  const [upcomingSelected, setUpcomingSelected] = useState('');

  const dayStripRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayKey = useMemo(() => formatDateKey(today), [today]);

  useEffect(() => {
    let disposed = false;

    const loadCalendar = async () => {
      setLoading(true);
      try {
        const showIds = new Set<string>([
          ...followedShows,
          ...watchedEpisodes.map((item) => item.showId)
        ]);

        for (const list of lists || []) {
          try {
            const listData = await fetchListItems(list.id);
            for (const item of listData?.items || []) {
              if (item.mediaType === 'show' && item.mediaId) {
                showIds.add(item.mediaId);
              }
            }
          } catch (err) {
            console.warn('Calendar: failed to load list items', err);
          }
        }

        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - 90);
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 365);

        const nextPersonal: PersonalEvent[] = [];
        const showList = Array.from(showIds);
        const showResults = await Promise.allSettled(
          showList.map(showId => fetchMediaDetails(showId, 'show'))
        );

        const seasonFetchTasks: Array<Promise<{ show: any; season: any; episodes: any[] }>> = [];

        for (const res of showResults) {
          if (res.status !== 'fulfilled' || !res.value) continue;
          const show = res.value;
          if (!show.seasons) continue;

          for (const season of show.seasons) {
            if (season.episodes && season.episodes.length > 0) {
              seasonFetchTasks.push(Promise.resolve({ show, season, episodes: season.episodes }));
            } else {
              seasonFetchTasks.push(
                fetchSeasonEpisodes(show.id, season.seasonNumber)
                  .then(episodes => ({ show, season, episodes }))
                  .catch(() => ({ show, season, episodes: [] }))
              );
            }
          }
        }

        const seasonResults = await Promise.allSettled(seasonFetchTasks);

        for (const sRes of seasonResults) {
          if (sRes.status !== 'fulfilled' || !sRes.value) continue;
          const { show, season, episodes } = sRes.value;

          for (const ep of episodes || []) {
            if (!ep.airDate) continue;
            const airDateObj = new Date(ep.airDate);
            if (Number.isNaN(airDateObj.getTime())) continue;
            if (airDateObj < minDate || airDateObj > maxDate) continue;

            nextPersonal.push({
              id: `cal_${show.id}_${season.seasonNumber}_${ep.episodeNumber}`,
              showId: show.id,
              showTitle: show.title,
              showPoster: show.posterPath,
              seasonNumber: season.seasonNumber,
              episodeNumber: ep.episodeNumber,
              title: ep.title || 'Novo episódio',
              overview: ep.overview || '',
              airDate: ep.airDate,
              airDateMs: airDateObj.getTime()
            });
          }
        }

        nextPersonal.sort((a, b) => a.airDateMs - b.airDateMs);

        if (!disposed) {
          setPersonalEvents(nextPersonal);
        }
      } catch (err) {
        console.error('Calendar load error', err);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    loadCalendar();
    return () => {
      disposed = true;
    };
  }, [followedShows.join('|'), watchedEpisodes.length, lists.length, today]);

  const groupedByDate = useMemo(() => {
    const map: Record<string, PersonalEvent[]> = {};
    for (const item of personalEvents) {
      const key = normalizeAirDateToKey(item.airDate);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [personalEvents]);

  const upcomingGroupedByDate = useMemo(() => {
    const map: Record<string, PersonalEvent[]> = {};
    for (const item of personalEvents) {
      const key = normalizeAirDateToKey(item.airDate);
      if (!key || key <= todayKey) continue;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [personalEvents, todayKey]);

  useEffect(() => {
    const firstKey = Object.keys(upcomingGroupedByDate).sort()[0];
    if (firstKey) setUpcomingSelected(firstKey);
  }, [upcomingGroupedByDate]);

  const upcomingVisibleKeys = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() + upcomingOffset);
    const keys: string[] = [];
    const cur = new Date(start);
    for (let i = 0; i < DATE_PAGE_SIZE; i++) { keys.push(formatDateKey(cur)); cur.setDate(cur.getDate() + 1); }
    return keys;
  }, [today, upcomingOffset]);

  const visibleDateKeys = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() + rangeStartOffset);

    const keys: string[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < DATE_PAGE_SIZE; i += 1) {
      keys.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }, [today, rangeStartOffset]);

  useEffect(() => {
    if (selectedDateKey && visibleDateKeys.includes(selectedDateKey)) return;

    const eventKeys = Object.keys(groupedByDate).sort();
    const nextWithEvents = eventKeys.find((key) => key >= todayKey);

    if (nextWithEvents && visibleDateKeys.includes(nextWithEvents)) {
      setSelectedDateKey(nextWithEvents);
      return;
    }

    if (visibleDateKeys.includes(todayKey)) {
      setSelectedDateKey(todayKey);
      return;
    }
    setSelectedDateKey(visibleDateKeys[0] || '');
  }, [selectedDateKey, visibleDateKeys, todayKey, groupedByDate]);

  useEffect(() => {
    if (!selectedDateKey || !dayStripRef.current) return;
    const target = dayStripRef.current.querySelector<HTMLButtonElement>(`button[data-date="${selectedDateKey}"]`);
    if (target) {
      target.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedDateKey, rangeStartOffset]);

  const selectedDate = selectedDateKey ? parseDateKey(selectedDateKey) : null;
  const selectedItems = selectedDateKey ? groupedByDate[selectedDateKey] || [] : [];

  const handleToggleReminder = async (e: React.MouseEvent, item: PersonalEvent) => {
    e.stopPropagation();
    if (browserNotificationPermission === 'default') {
      requestNotificationPermission();
    }
    await toggleEpisodeReminder({
      showId: item.showId,
      showTitle: item.showTitle,
      posterPath: item.showPoster,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      episodeTitle: item.title,
      airDate: item.airDate
    });
  };

  const moveDay = (direction: -1 | 1) => {
    const currentKey = selectedDateKey || todayKey;
    const currentDate = parseDateKey(currentKey);
    const targetDate = new Date(currentDate);
    targetDate.setDate(targetDate.getDate() + direction);
    const targetKey = formatDateKey(targetDate);

    setSelectedDateKey(targetKey);

    const startOfVisible = new Date(today);
    startOfVisible.setDate(startOfVisible.getDate() + rangeStartOffset);
    const startVisibleKey = formatDateKey(startOfVisible);

    const endOfVisible = new Date(startOfVisible);
    endOfVisible.setDate(endOfVisible.getDate() + (DATE_PAGE_SIZE - 1));
    const endVisibleKey = formatDateKey(endOfVisible);

    if (targetKey < startVisibleKey) {
      setRangeStartOffset(prev => prev + direction);
    } else if (targetKey > endVisibleKey) {
      setRangeStartOffset(prev => prev + direction);
    }
  };

  const moveUpcomingDay = (direction: -1 | 1) => {
    const currentKey = upcomingSelected || upcomingVisibleKeys[0] || todayKey;
    const currentDate = parseDateKey(currentKey);
    const targetDate = new Date(currentDate);
    targetDate.setDate(targetDate.getDate() + direction);
    const targetKey = formatDateKey(targetDate);

    setUpcomingSelected(targetKey);

    const startOfVisible = new Date(today);
    startOfVisible.setDate(startOfVisible.getDate() + upcomingOffset);
    const startVisibleKey = formatDateKey(startOfVisible);

    const endOfVisible = new Date(startOfVisible);
    endOfVisible.setDate(endOfVisible.getDate() + (DATE_PAGE_SIZE - 1));
    const endVisibleKey = formatDateKey(endOfVisible);

    if (targetKey < startVisibleKey) {
      setUpcomingOffset(prev => prev + direction);
    } else if (targetKey > endVisibleKey) {
      setUpcomingOffset(prev => prev + direction);
    }
  };

  const jumpToNextRelease = () => {
    const keys = Object.keys(groupedByDate).sort();
    const next = keys.find((key) => key > selectedDateKey && groupedByDate[key]?.length > 0);
    if (!next) {
      pushToast('info', 'Não há próximo lançamento no período.');
      return;
    }
    setSelectedDateKey(next);
  };

  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Calendário</h2>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <button 
            type="button" 
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'personal' ? 600 : 500,
              background: activeTab === 'personal' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'personal' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('personal')}
          >
            Minhas Séries
          </button>
          <button 
            type="button" 
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'global' ? 600 : 500,
              background: activeTab === 'global' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'global' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('global')}
          >
            Em Breve
          </button>
        </div>
      </div>

      {loading && (
        <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
          Carregando calendário...
        </div>
      )}

      {!loading && activeTab === 'personal' && (
        <>
          {/* Day Navigation Strip */}
          <div className="st-panel" style={{ padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="st-btn-icon"
              onClick={() => moveDay(-1)}
              style={{ width: '28px', height: '28px', minWidth: '28px' }}
              title="Dia anterior"
            >
              <ChevronLeft size={15} />
            </button>

            <div ref={dayStripRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', flex: 1 }}>
              {visibleDateKeys.map((key) => {
                const date = parseDateKey(key);
                const isActive = key === selectedDateKey;
                const isToday = key === todayKey;
                const count = groupedByDate[key]?.length || 0;
                return (
                  <button
                    key={key}
                    data-date={key}
                    type="button"
                    onClick={() => setSelectedDateKey(key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '6px 4px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--primary)' : isToday ? 'var(--border-color)' : 'transparent',
                      background: isActive ? 'var(--bg-elevated)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>{DAY_LABELS[date.getDay()]}</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: isActive ? 'var(--primary)' : 'var(--text-primary)', margin: '1px 0' }}>{date.getDate()}</span>
                    <span style={{ fontSize: '10px', color: count > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{count > 0 ? `${count} ep` : '-'}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="st-btn-icon"
              onClick={() => moveDay(1)}
              style={{ width: '28px', height: '28px', minWidth: '28px' }}
              title="Próximo dia"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{selectedDate ? formatHeaderDate(selectedDate) : ''}</h3>
            {selectedItems.length > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedItems.length} {selectedItems.length === 1 ? 'lançamento' : 'lançamentos'}</span>}
          </div>

          {selectedItems.length === 0 ? (
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <p style={{ marginBottom: '10px' }}>Sem lançamentos para este dia.</p>
              <button type="button" className="st-btn-secondary" onClick={jumpToNextRelease} style={{ fontSize: '12px', height: '30px' }}>
                Ir para próximo lançamento
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {selectedItems.map((item) => {
                const reminderActive = isReminderActive(item.showId, item.seasonNumber, item.episodeNumber);
                const itemDateKey = normalizeAirDateToKey(item.airDate);
                const isReleasedToday = itemDateKey === todayKey;
                const isAlreadyReleased = itemDateKey && itemDateKey <= todayKey;

                return (
                  <article
                    key={item.id}
                    className="st-card"
                    onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                    style={{ 
                      display: 'flex', 
                      overflow: 'hidden', 
                      cursor: 'pointer',
                      borderLeft: isReleasedToday ? '3px solid var(--accent)' : reminderActive ? '3px solid var(--primary)' : undefined
                    }}
                  >
                    <div style={{ width: '74px', minWidth: '74px', position: 'relative', background: 'var(--bg-surface)' }}>
                      <img src={getImageUrl(item.showPoster)} alt={item.showTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.showTitle}
                        </h4>
                        {isReleasedToday && (
                          <span style={{ background: 'var(--accent)', color: '#000', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>
                            Lançado hoje!
                          </span>
                        )}
                        {!isReleasedToday && isAlreadyReleased && (
                          <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>
                            Disponível
                          </span>
                        )}
                      </div>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        T{item.seasonNumber} E{item.episodeNumber} • {item.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <Clock size={11} /> {formatEpisodeTime(item.airDate)}
                      </div>

                      <button
                        type="button"
                        className={reminderActive ? 'st-btn-primary' : 'st-btn-secondary'}
                        onClick={(e) => handleToggleReminder(e, item)}
                        style={{ marginTop: 'auto', fontSize: '11px', height: '26px', padding: '0 8px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Bell size={12} fill={reminderActive ? 'currentColor' : 'none'} />
                        {reminderActive 
                          ? (isReleasedToday ? '✓ Lançado hoje (Lembrete)' : 'Lembrete ativo') 
                          : (isReleasedToday ? 'Lembrar deste ep' : 'Lembrar')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'global' && (
        <>
          <div className="st-panel" style={{ padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="st-btn-icon"
              onClick={() => moveUpcomingDay(-1)}
              style={{ width: '28px', height: '28px', minWidth: '28px' }}
              title="Dia anterior"
            >
              <ChevronLeft size={15} />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', flex: 1 }}>
              {upcomingVisibleKeys.map(key => {
                const date = parseDateKey(key);
                const count = upcomingGroupedByDate[key]?.length || 0;
                const isActive = key === upcomingSelected;
                return (
                  <button
                    key={key}
                    data-date={key}
                    type="button"
                    onClick={() => setUpcomingSelected(key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '6px 4px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--primary)' : 'transparent',
                      background: isActive ? 'var(--bg-elevated)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 500
                    }}
                  >
                    <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>{DAY_LABELS[date.getDay()]}</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: isActive ? 'var(--primary)' : 'var(--text-primary)', margin: '1px 0' }}>{date.getDate()}</span>
                    <span style={{ fontSize: '10px', color: count > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{count > 0 ? `${count} ep` : '-'}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="st-btn-icon"
              onClick={() => moveUpcomingDay(1)}
              style={{ width: '28px', height: '28px', minWidth: '28px' }}
              title="Próximo dia"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{upcomingSelected ? formatHeaderDate(parseDateKey(upcomingSelected)) : ''}</h3>
            {(upcomingGroupedByDate[upcomingSelected]?.length || 0) > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{upcomingGroupedByDate[upcomingSelected].length} episódios</span>
            )}
          </div>

          {(upcomingGroupedByDate[upcomingSelected]?.length || 0) === 0 ? (
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Nenhum episódio previsto para esta data.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingGroupedByDate[upcomingSelected].map(item => {
                const globalReminderActive = isReminderActive(item.showId, item.seasonNumber, item.episodeNumber);
                return (
                  <div
                    key={item.id}
                    className="st-card"
                    onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '10px 12px', 
                      cursor: 'pointer',
                      borderLeft: globalReminderActive ? '3px solid var(--primary)' : undefined
                    }}
                  >
                    <img src={getImageUrl(item.showPoster)} alt={item.showTitle} style={{ width: '38px', height: '54px', borderRadius: 'var(--radius-xs)', objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.showTitle}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        T{item.seasonNumber} E{item.episodeNumber} • {item.title}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatEpisodeTime(item.airDate)}
                      </div>
                      <button
                        type="button"
                        className={globalReminderActive ? 'st-btn-primary' : 'st-btn-secondary'}
                        onClick={(e) => handleToggleReminder(e, item)}
                        style={{ fontSize: '11px', height: '26px', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                        title={globalReminderActive ? "Lembrete ativo para este lançamento" : "Ativar lembrete de lançamento"}
                      >
                        <Bell size={11} fill={globalReminderActive ? 'currentColor' : 'none'} />
                        {globalReminderActive ? 'Lembrete ativo' : 'Lembrar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
