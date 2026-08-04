import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useTracking } from '../context/TrackingContext.js';
import { fetchMediaDetails, fetchSeasonEpisodes, fetchTVMazeSchedule, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

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

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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

function normalizeAirDateToKey(airDate: string): string {
  if (!airDate) return '';
  if (!airDate.includes('T')) return airDate.slice(0, 10);
  const parsed = new Date(airDate);
  if (Number.isNaN(parsed.getTime())) return airDate.slice(0, 10);
  return formatDateKey(parsed);
}

function formatHeaderDate(d: Date): string {
  return `${DAY_LABELS[d.getDay()]}, ${d.getDate()} de ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function formatEpisodeTime(airDate: string): string {
  if (!airDate) return 'Sem horario';
  if (!airDate.includes('T')) return 'Hoje';
  const parsed = new Date(airDate);
  if (Number.isNaN(parsed.getTime())) return 'Sem horario';
  return parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const Calendar: React.FC<CalendarProps> = ({ onViewMedia }) => {
  const { watchedEpisodes, followedShows, lists, fetchListItems } = useTracking();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [followedShowsData, setFollowedShowsData] = useState<any[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
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
    try {
      const raw = localStorage.getItem('showtime_calendar_reminders');
      if (raw) setReminders(JSON.parse(raw));
    } catch {
      setReminders([]);
    }
  }, []);

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

        for (const showId of Array.from(showIds)) {
          try {
            const show = await fetchMediaDetails(showId, 'show');
            if (!show?.seasons) continue;

            for (const season of show.seasons) {
              let episodes = season.episodes;
              if (!episodes || episodes.length === 0) {
                episodes = await fetchSeasonEpisodes(showId, season.seasonNumber);
              }

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
                  title: ep.title || 'Novo episodio',
                  overview: ep.overview || '',
                  airDate: ep.airDate,
                  airDateMs: airDateObj.getTime()
                });
              }
            }
          } catch (err) {
            console.warn(`Calendar: failed to process show ${showId}`, err);
          }
        }

        nextPersonal.sort((a, b) => a.airDateMs - b.airDateMs);

        let nextGlobal: any[] = [];
        try {
          const schedule = await fetchTVMazeSchedule();
          nextGlobal = schedule.slice(0, 40);
        } catch {
          nextGlobal = [];
        }

        if (!disposed) {
          setPersonalEvents(nextPersonal);
          setGlobalEvents(nextGlobal);
          // Build followed shows data for "Minha Lista" visual grid
          const showsMap = new Map<string, any>();
          for (const ev of nextPersonal) {
            if (!showsMap.has(ev.showId)) {
              showsMap.set(ev.showId, {
                showId: ev.showId,
                showTitle: ev.showTitle,
                showPoster: ev.showPoster,
                episodes: [],
              });
            }
            showsMap.get(ev.showId)!.episodes.push(ev);
          }
          setFollowedShowsData(Array.from(showsMap.values()));
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

  // Only future events (from tomorrow onwards) for Em Breve tab
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

  // Auto-select first upcoming date with events
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

  const toggleReminder = (id: string, label: string) => {
    const enabled = !reminders.includes(id);
    const next = enabled ? [...reminders, id] : reminders.filter((item) => item !== id);
    setReminders(next);
    localStorage.setItem('showtime_calendar_reminders', JSON.stringify(next));
    pushToast('info', enabled ? `Lembrete salvo: ${label}` : 'Lembrete removido.');
    trackEvent('calendar_reminder_toggled', { id, enabled });
  };

  const moveDateRange = (direction: -1 | 1) => {
    if (direction === -1 && rangeStartOffset === 0) return;

    setRangeStartOffset((prev) => {
      const next = Math.max(0, prev + direction);

      const nextStart = new Date(today);
      nextStart.setDate(nextStart.getDate() + next);
      const nextStartKey = formatDateKey(nextStart);

      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + (DATE_PAGE_SIZE - 1));
      const nextEndKey = formatDateKey(nextEnd);

      if (!selectedDateKey || selectedDateKey < nextStartKey || selectedDateKey > nextEndKey) {
        setSelectedDateKey(nextStartKey);
      }

      return next;
    });
  };

  const jumpToNextRelease = () => {
    const keys = Object.keys(groupedByDate).sort();
    const next = keys.find((key) => key > selectedDateKey && groupedByDate[key]?.length > 0);
    if (!next) {
      pushToast('info', 'Nao ha proximo lancamento no periodo exibido.');
      return;
    }
    setSelectedDateKey(next);
  };


  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '44px', width: '100%', maxWidth: '100%', overflowX: 'clip' }}>
      <div className="calendar-head">
        <div>
          <h2 className="calendar-title">Calendario de Lancamentos</h2>
          <p className="calendar-subtitle">Navegue dia por dia usando as setas da fileira de datas.</p>
        </div>

        <div className="calendar-tabs" role="tablist" aria-label="Modo do calendario">
          <button type="button" className={`calendar-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            Minha Lista
          </button>
          <button type="button" className={`calendar-tab ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>
            Em Breve
          </button>
        </div>
      </div>

      {loading && (
        <div className="st-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Carregando calendario...
        </div>
      )}

      {!loading && activeTab === 'personal' && (
        <>
          {/* Visual show grid — Minha Lista */}
          {followedShowsData.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Séries com episódios no período</p>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                {followedShowsData.map(show => {
                  const nextEp = show.episodes.find((e: PersonalEvent) => e.airDate >= todayKey);
                  const lastEp = show.episodes.filter((e: PersonalEvent) => e.airDate <= todayKey).pop();
                  const displayEp = nextEp || lastEp;
                  return (
                    <div
                      key={show.showId}
                      onClick={() => onViewMedia(show.showId, 'show')}
                      style={{ flexShrink: 0, width: '100px', cursor: 'pointer' }}
                    >
                      <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', marginBottom: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                        <img src={getImageUrl(show.showPoster)} alt={show.showTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {displayEp && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '6px 4px 4px', fontSize: '10px', fontWeight: 700, color: nextEp ? 'var(--primary)' : 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                            {nextEp ? `T${displayEp.seasonNumber}E${displayEp.episodeNumber}` : `T${displayEp.seasonNumber}E${displayEp.episodeNumber} ✓`}
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', textAlign: 'center', lineHeight: 1.2, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{show.showTitle}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="st-panel calendar-strip-panel">
            <div className="calendar-day-strip-shell">
              <div ref={dayStripRef} className="calendar-day-strip">
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
                      className={`calendar-day-pill ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => setSelectedDateKey(key)}
                    >
                      <span className="dow">{DAY_LABELS[date.getDay()]}</span>
                      <span className="dom">{date.getDate()}</span>
                      <span className="mon">{MONTH_LABELS[date.getMonth()]}</span>
                      <span className="cnt">{count > 0 ? `${count} ep` : '-'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="calendar-range-controls" aria-label="Navegacao de blocos de data">
              <button
                type="button"
                className="calendar-range-icon"
                onClick={() => moveDateRange(-1)}
                aria-label="Ver bloco de datas anterior"
                disabled={rangeStartOffset === 0}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                className="calendar-range-icon"
                onClick={() => moveDateRange(1)}
                aria-label="Ver proximo bloco de datas"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="calendar-selected-head">
            <h3>{selectedDate ? formatHeaderDate(selectedDate) : ''}</h3>
            {selectedItems.length > 0 && <span>{selectedItems.length} lancamentos</span>}
          </div>

          {selectedItems.length === 0 ? (
            <div className="st-panel" style={{ padding: '26px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '12px' }}>Sem lancamentos para este dia.</p>
              <button type="button" className="calendar-next-release" onClick={jumpToNextRelease}>
                Ir para proximo lancamento
              </button>
            </div>
          ) : (
            <div className="calendar-grid">
              {selectedItems.map((item) => {
                const reminderActive = reminders.includes(item.id);
                return (
                  <article
                    key={item.id}
                    className="st-card calendar-card"
                    onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                  >
                    <div className="poster-wrap">
                      <img src={getImageUrl(item.showPoster)} alt={item.showTitle} />
                      <div className="air-badge">
                        <Clock size={11} />
                        {formatEpisodeTime(item.airDate)}
                      </div>
                    </div>

                    <div className="card-content">
                      <h4>{item.showTitle}</h4>
                      <p className="ep-line">T{item.seasonNumber} E{item.episodeNumber} • {item.title || 'Novo episodio'}</p>
                      {item.overview ? <p className="overview">{item.overview}</p> : <div style={{ height: '8px' }} />}

                      <button
                        type="button"
                        className={`calendar-reminder ${reminderActive ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReminder(item.id, `${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`);
                        }}
                      >
                        {reminderActive ? 'Lembrete ativo' : 'Adicionar lembrete'}
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
          <div className="st-panel calendar-strip-panel">
            <div className="calendar-day-strip-shell">
              <div className="calendar-day-strip">
                {upcomingVisibleKeys.map(key => {
                  const date = parseDateKey(key);
                  const count = upcomingGroupedByDate[key]?.length || 0;
                  return (
                    <button key={key} data-date={key} type="button" className={`calendar-day-pill ${key === upcomingSelected ? 'active' : ''}`} onClick={() => setUpcomingSelected(key)}>
                      <span className="dow">{DAY_LABELS[date.getDay()]}</span>
                      <span className="dom">{date.getDate()}</span>
                      <span className="mon">{MONTH_LABELS[date.getMonth()]}</span>
                      <span className="cnt">{count > 0 ? `${count} ep` : '-'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="calendar-range-controls">
              <button type="button" className="calendar-range-icon" onClick={() => setUpcomingOffset(p => Math.max(1, p - DATE_PAGE_SIZE))} disabled={upcomingOffset <= 1}><ChevronLeft size={16} /></button>
              <button type="button" className="calendar-range-icon" onClick={() => setUpcomingOffset(p => p + DATE_PAGE_SIZE)}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="calendar-selected-head">
            <h3>{upcomingSelected ? formatHeaderDate(parseDateKey(upcomingSelected)) : ''}</h3>
            {(upcomingGroupedByDate[upcomingSelected]?.length || 0) > 0 && <span>{upcomingGroupedByDate[upcomingSelected].length} episódios</span>}
          </div>

          {(upcomingGroupedByDate[upcomingSelected] || []).length === 0 ? (
            <div className="st-panel" style={{ padding: '26px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '8px' }}>Nenhum episódio previsto para este dia.</p>
              {Object.keys(upcomingGroupedByDate).length === 0 && <p style={{ fontSize: '13px' }}>Siga mais séries para ver episódios futuros aqui.</p>}
            </div>
          ) : (
            <div className="calendar-grid">
              {(upcomingGroupedByDate[upcomingSelected] || []).map(item => {
                const reminderActive = reminders.includes(item.id);
                return (
                  <article key={item.id} className="st-card calendar-card" onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}>
                    <div className="poster-wrap">
                      <img src={getImageUrl(item.showPoster)} alt={item.showTitle} />
                      <div className="air-badge"><Clock size={11} />{formatEpisodeTime(item.airDate)}</div>
                    </div>
                    <div className="card-content">
                      <h4>{item.showTitle}</h4>
                      <p className="ep-line">T{item.seasonNumber} E{item.episodeNumber} • {item.title}</p>
                      {item.overview ? <p className="overview">{item.overview}</p> : <div style={{ height: '8px' }} />}
                      <button type="button" className={`calendar-reminder ${reminderActive ? 'active' : ''}`} onClick={e => { e.stopPropagation(); toggleReminder(item.id, `${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`); }}>
                        {reminderActive ? 'Lembrete ativo' : 'Adicionar lembrete'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <style>{`
        .calendar-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
          width: 100%;
          min-width: 0;
        }

        .calendar-head > div:first-child {
          flex: 1 1 260px;
          min-width: 0;
        }

        .calendar-title {
          font-family: var(--font-display);
          font-size: 28px;
          margin-bottom: 6px;
        }

        .calendar-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.35;
          word-break: break-word;
        }

        .calendar-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          width: 100%;
          max-width: 460px;
          margin-left: auto;
          flex: 1 1 320px;
          min-width: 0;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 5px;
        }

        .calendar-tab {
          width: 100%;
          min-width: 0;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          padding: 9px 8px;
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1;
        }

        .calendar-tab.active {
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000;
          box-shadow: 0 4px 12px rgba(245, 197, 24, 0.28);
        }

        .calendar-strip-panel {
          padding: 14px;
          margin-bottom: 16px;
        }

        .calendar-day-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          flex: 1;
          min-width: 0;
          gap: 8px;
          overflow-x: hidden;
          overflow-y: hidden;
          padding: 6px 0;
          width: 100%;
          max-width: 100%;
        }

        .calendar-day-strip-shell {
          width: 100%;
        }

        .calendar-range-controls {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .calendar-range-icon {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .calendar-range-icon:hover {
          border-color: rgba(245, 197, 24, 0.5);
          color: var(--primary);
          background: rgba(245, 197, 24, 0.1);
        }

        .calendar-range-icon:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          color: var(--text-muted);
          border-color: var(--border-color);
          background: rgba(255, 255, 255, 0.02);
        }

        .calendar-range-icon:disabled:hover {
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.02);
        }

        .calendar-day-strip::-webkit-scrollbar {
          display: none;
        }

        .calendar-day-pill {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          cursor: pointer;
        }

        .calendar-day-pill.today {
          border-color: rgba(245, 197, 24, 0.4);
        }

        .calendar-day-pill.active {
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000;
          border-color: transparent;
          box-shadow: 0 6px 14px rgba(245, 197, 24, 0.32);
        }

        .calendar-day-pill .dow { font-size: 10px; font-weight: 700; }
        .calendar-day-pill .dom { font-size: 19px; font-weight: 800; line-height: 1; }
        .calendar-day-pill .mon { font-size: 11px; opacity: 0.8; }
        .calendar-day-pill .cnt { font-size: 10px; opacity: 0.85; margin-top: 2px; }

        .calendar-selected-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }

        .calendar-selected-head h3 {
          font-family: var(--font-display);
          font-size: 26px;
          line-height: 1.1;
        }

        .calendar-selected-head span {
          border: 1px solid rgba(245, 197, 24, 0.3);
          background: rgba(245, 197, 24, 0.1);
          color: var(--primary);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .calendar-next-release {
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .calendar-card {
          display: flex;
          overflow: hidden;
          min-width: 0;
          cursor: pointer;
        }

        .poster-wrap {
          width: 86px;
          min-width: 86px;
          position: relative;
          background: rgba(255, 255, 255, 0.04);
        }

        .poster-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .air-badge {
          position: absolute;
          left: 6px;
          bottom: 6px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          display: inline-flex;
          gap: 4px;
          align-items: center;
        }

        .card-content {
          min-width: 0;
          flex: 1;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .card-content h4 {
          font-size: 15px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-content .ep-line {
          color: var(--text-secondary);
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-content .overview {
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .calendar-reminder {
          margin-top: auto;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
        }

        .calendar-reminder.active {
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000;
          border-color: transparent;
        }

        .calendar-global-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .calendar-global-card {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px;
        }

        .global-poster {
          width: 44px;
          height: 64px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .global-poster.fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
        }

        .global-main {
          flex: 1;
          min-width: 0;
        }

        .global-main h4 {
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-main p {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }

        .date-pill {
          font-size: 11px;
          font-weight: 700;
          color: var(--primary);
          border: 1px solid rgba(245, 197, 24, 0.28);
          background: rgba(245, 197, 24, 0.1);
          border-radius: 999px;
          padding: 4px 8px;
        }

        .time-pill {
          font-size: 11px;
          color: var(--text-muted);
        }

        @media (max-width: 760px) {
          .calendar-head {
            display: block;
          }

          .calendar-title {
            font-size: 24px;
          }

          .calendar-tabs {
            width: 100%;
            max-width: none;
            margin-left: 0;
            margin-top: 10px;
            flex: none;
          }

          .calendar-grid {
            grid-template-columns: 1fr;
          }

          .calendar-selected-head h3 {
            font-size: 22px;
          }

          .calendar-day-strip {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
          }

          .calendar-range-controls {
            margin-top: 8px;
          }

          .calendar-range-icon {
            width: 32px;
            height: 32px;
          }
        }

        @media (max-width: 520px) {
          .calendar-tabs {
            grid-template-columns: 1fr;
          }

          .calendar-tab {
            min-height: 40px;
            font-size: 12px;
          }
        }

        @media (max-width: 420px) {
          .calendar-tab {
            font-size: 11px;
            padding: 8px 7px;
          }

          .calendar-day-pill .dom {
            font-size: 17px;
          }
        }
      `}</style>
    </div>
  );
};
