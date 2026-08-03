import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Tv } from 'lucide-react';
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
  const [globalEvents, setGlobalEvents] = useState<any[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [canScrollDatesLeft, setCanScrollDatesLeft] = useState(false);
  const [canScrollDatesRight, setCanScrollDatesRight] = useState(false);

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
  }, [followedShows.join('|'), watchedEpisodes.length, lists.length, today, fetchListItems]);

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

  const visibleDateKeys = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    const end = new Date(today);
    end.setDate(end.getDate() + 180);

    const keys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      keys.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }, [today]);

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
      const strip = dayStripRef.current;
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const nextScrollLeft = Math.max(0, targetCenter - strip.clientWidth / 2);
      strip.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
      window.setTimeout(() => refreshDateStripControls(), 120);
    }
  }, [selectedDateKey]);

  const refreshDateStripControls = () => {
    const strip = dayStripRef.current;
    if (!strip) return;

    const maxLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const current = strip.scrollLeft;
    setCanScrollDatesLeft(current > 4);
    setCanScrollDatesRight(current < maxLeft - 4);
  };

  useEffect(() => {
    if (loading || activeTab !== 'personal') return;

    const strip = dayStripRef.current;
    if (!strip) return;

    const onScroll = () => refreshDateStripControls();
    strip.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => refreshDateStripControls();
    window.addEventListener('resize', onResize);

    const timer = window.setTimeout(refreshDateStripControls, 80);

    return () => {
      window.clearTimeout(timer);
      strip.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [loading, activeTab, visibleDateKeys.length]);

  const stepDateStrip = (direction: 'left' | 'right') => {
    const strip = dayStripRef.current;
    if (!strip) return;
    const amount = Math.max(180, Math.floor(strip.clientWidth * 0.68));
    const delta = direction === 'right' ? amount : -amount;
    strip.scrollBy({ left: delta, behavior: 'smooth' });
  };

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

  const navigateDay = (direction: -1 | 1) => {
    if (!selectedDateKey) return;
    const idx = visibleDateKeys.indexOf(selectedDateKey);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= visibleDateKeys.length) return;
    setSelectedDateKey(visibleDateKeys[nextIdx]);
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
          <p className="calendar-subtitle">Arraste a fileira de dias ou use as setas para navegar por datas futuras.</p>
        </div>

        <div className="calendar-tabs" role="tablist" aria-label="Modo do calendario">
          <button type="button" className={`calendar-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            Meu Cronograma ({personalEvents.length})
          </button>
          <button type="button" className={`calendar-tab ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>
            Estreias Globais
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
          <div className="st-panel calendar-strip-panel">
            <div className="calendar-strip-top">
              <div className="calendar-month-label">
                <CalendarIcon size={15} />
                <span>
                  {selectedDate ? `${MONTH_FULL[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` : 'Selecionar data'}
                </span>
              </div>

              <div className="calendar-strip-actions">
                <button type="button" className="calendar-nav-btn" onClick={() => setSelectedDateKey(todayKey)}>
                  Hoje
                </button>
                <input type="date" className="calendar-date-input" value={selectedDateKey} onChange={(e) => setSelectedDateKey(e.target.value)} />
                <button type="button" className="calendar-nav-btn icon" onClick={() => navigateDay(-1)} aria-label="Dia anterior">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="calendar-nav-btn icon" onClick={() => navigateDay(1)} aria-label="Proximo dia">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="calendar-day-strip-shell">
              {canScrollDatesLeft && (
                <button
                  type="button"
                  className="calendar-strip-fab left"
                  onClick={() => stepDateStrip('left')}
                  aria-label="Ver datas anteriores"
                >
                  <ChevronLeft size={16} />
                </button>
              )}

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

              {canScrollDatesRight && (
                <button
                  type="button"
                  className="calendar-strip-fab right"
                  onClick={() => stepDateStrip('right')}
                  aria-label="Ver datas futuras"
                >
                  <ChevronRight size={16} />
                </button>
              )}
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
        <div className="calendar-global-list">
          {globalEvents.length === 0 ? (
            <div className="st-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhuma estreia global encontrada agora.
            </div>
          ) : (
            globalEvents.map((item) => (
              <article key={item.id} className="st-card calendar-global-card">
                {item.showPoster ? (
                  <img src={item.showPoster} alt={item.showTitle} className="global-poster" />
                ) : (
                  <div className="global-poster fallback">
                    <Tv size={18} />
                  </div>
                )}

                <div className="global-main">
                  <h4>{item.showTitle}</h4>
                  <p>
                    T{String(item.seasonNumber ?? 0).padStart(2, '0')}E{String(item.episodeNumber ?? 0).padStart(2, '0')} - {item.title}
                  </p>
                </div>

                <div className="global-meta">
                  <span className="date-pill">{new Date(item.airDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                  {item.time && <span className="time-pill">{item.time}</span>}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      <style>{`
        .calendar-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .calendar-title {
          font-family: var(--font-display);
          font-size: 28px;
          margin-bottom: 6px;
        }

        .calendar-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .calendar-tabs {
          display: flex;
          gap: 6px;
          width: min(100%, 460px);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 5px;
        }

        .calendar-tab {
          flex: 1;
          min-width: 0;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          padding: 9px 10px;
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

        .calendar-strip-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .calendar-month-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
        }

        .calendar-strip-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .calendar-nav-btn {
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          height: 32px;
          padding: 0 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .calendar-nav-btn.icon {
          width: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .calendar-date-input {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          height: 32px;
          padding: 0 8px;
          font-size: 12px;
          color-scheme: dark;
        }

        .calendar-day-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 6px;
          width: 100%;
          max-width: 100%;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
        }

        .calendar-day-strip-shell {
          position: relative;
          width: 100%;
        }

        .calendar-strip-fab {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 3;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: rgba(7, 7, 10, 0.86);
          color: var(--text-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.28);
        }

        .calendar-strip-fab.left {
          left: 6px;
        }

        .calendar-strip-fab.right {
          right: 6px;
        }

        .calendar-strip-fab:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .calendar-day-strip::-webkit-scrollbar {
          display: none;
        }

        .calendar-day-pill {
          flex: 0 0 auto;
          width: 74px;
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
            align-items: stretch;
          }

          .calendar-title {
            font-size: 24px;
          }

          .calendar-tabs {
            width: 100%;
          }

          .calendar-grid {
            grid-template-columns: 1fr;
          }

          .calendar-selected-head h3 {
            font-size: 22px;
          }

          .calendar-strip-fab {
            width: 30px;
            height: 30px;
          }

          .calendar-strip-fab.left {
            left: 4px;
          }

          .calendar-strip-fab.right {
            right: 4px;
          }
        }

        @media (max-width: 420px) {
          .calendar-tab {
            font-size: 11px;
            padding: 8px 7px;
          }

          .calendar-day-pill {
            width: 68px;
          }

          .calendar-day-pill .dom {
            font-size: 17px;
          }
        }
      `}</style>
    </div>
  );
};
