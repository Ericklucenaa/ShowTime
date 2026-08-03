import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTVMazeSchedule, getImageUrl, fetchMediaDetails, fetchSeasonEpisodes } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { Calendar as CalendarIcon, Clock, Tv, ChevronLeft, ChevronRight, Bell, Check, CalendarDays, RotateCcw } from 'lucide-react';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

interface CalendarProps {
  onViewMedia: (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => void;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatDateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateFromKey(key: string): Date {
  if (!key) return new Date();
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

function formatDateHeaderLabel(d: Date): string {
  const dayName = DAY_LABELS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = MONTH_FULL_LABELS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${dayNum} de ${monthName} ${year}`;
}

function formatEpisodeBadge(airDate: string) {
  if (!airDate) return 'Sem horário';
  if (!airDate.includes('T')) return 'Hoje';
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
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [reminders, setReminders] = useState<string[]>([]);
  
  const dayStripRef = useRef<HTMLDivElement | null>(null);

  // Drag states for day strip
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDragMovementRef = useRef(false);

  // Touch swipe states for episode area
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

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
                const pastCutoff = new Date();
                pastCutoff.setDate(now.getDate() - 60);
                const futureCutoff = new Date();
                futureCutoff.setDate(now.getDate() + 365); // Support future dates up to 1 year

                if (airDate >= pastCutoff && airDate <= futureCutoff) {
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
          setGlobalCalendar(tvmazeData.slice(0, 30));
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

  const groupedPersonal = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const item of personalCalendar) {
      const key = normalizeAirDateToKey(item.airDate);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [personalCalendar]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => formatDateKeyFromDate(today), [today]);

  const visibleDates = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 30); // 30 days past

    const end = new Date(today);
    end.setDate(end.getDate() + 180); // 180 days future

    const days: string[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      days.push(formatDateKeyFromDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Ensure selected date is in visible list if set externally
    if (selectedDateKey && !days.includes(selectedDateKey)) {
      days.push(selectedDateKey);
      days.sort();
    }

    return days;
  }, [today, selectedDateKey]);

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

  // Scroll selected day button into center view
  useEffect(() => {
    const strip = dayStripRef.current;
    if (!strip || !selectedDateKey) return;
    const selectedEl = strip.querySelector<HTMLButtonElement>(`button[data-date="${selectedDateKey}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDateKey]);

  const handleSelectNearbyDate = (direction: -1 | 1) => {
    if (!selectedDateKey) return;
    const index = visibleDates.indexOf(selectedDateKey);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= visibleDates.length) return;
    setSelectedDateKey(visibleDates[nextIndex]);
  };

  const handleGoToToday = () => {
    setSelectedDateKey(todayStr);
  };

  // Find nearest future date with releases
  const handleJumpToNextRelease = () => {
    if (!selectedDateKey) return;
    const futureKeys = Object.keys(groupedPersonal).sort();
    const nextKey = futureKeys.find(k => k > selectedDateKey && (groupedPersonal[k]?.length || 0) > 0);
    if (nextKey) {
      setSelectedDateKey(nextKey);
    } else {
      pushToast('info', 'Nenhum lançamento posterior encontrado no seu cronograma.');
    }
  };

  // Mouse Drag functionality for horizontal day strip
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dayStripRef.current) return;
    isMouseDownRef.current = true;
    isDragMovementRef.current = false;
    startXRef.current = e.pageX - dayStripRef.current.offsetLeft;
    scrollLeftRef.current = dayStripRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !dayStripRef.current) return;
    const x = e.pageX - dayStripRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      isDragMovementRef.current = true;
    }
    dayStripRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  const handleDayButtonClick = (dateKey: string) => {
    if (isDragMovementRef.current) {
      isDragMovementRef.current = false;
      return;
    }
    setSelectedDateKey(dateKey);
  };

  // Touch Swipe functionality on Episode Panel
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartXRef.current || !touchStartYRef.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Check if horizontal swipe is prominent over vertical scroll
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        // Swiped Left -> Go to Next Day
        handleSelectNearbyDate(1);
      } else {
        // Swiped Right -> Go to Previous Day
        handleSelectNearbyDate(-1);
      }
    }

    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
  };

  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '50px', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* Header & Tab Switcher */}
      <div className="calendar-header-block">
        <div className="calendar-title-group">
          <h2>Calendário de Lançamentos</h2>
          <p>Navegue pelos dias e acompanhe os episódios de suas séries e estreias.</p>
        </div>

        {/* Restored Tab Switcher */}
        <div className="calendar-tab-switcher">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`calendar-tab-item ${activeTab === 'personal' ? 'active' : ''}`}
          >
            Meu Cronograma ({personalCalendar.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`calendar-tab-item ${activeTab === 'global' ? 'active' : ''}`}
          >
            Estreias Globais
          </button>
        </div>
      </div>

      {loading && (
        <div className="calendar-loading-state">
          <div className="calendar-spinner" />
          <span>Carregando seu cronograma...</span>
        </div>
      )}

      {!loading && activeTab === 'personal' && (
        <div className="calendar-personal-content">
          
          {/* Day Selector Panel */}
          <div className="calendar-strip-panel st-panel">
            <div className="calendar-strip-controls">
              <div className="calendar-date-display">
                <CalendarDays size={16} style={{ color: 'var(--primary)' }} />
                <span>
                  {selectedDateObj ? `${MONTH_FULL_LABELS[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()}` : ''}
                </span>
              </div>

              <div className="calendar-action-buttons">
                {selectedDateKey !== todayStr && (
                  <button
                    type="button"
                    className="calendar-btn-today"
                    onClick={handleGoToToday}
                    title="Voltar para Hoje"
                  >
                    <RotateCcw size={12} />
                    <span>Hoje</span>
                  </button>
                )}
                
                <input
                  type="date"
                  value={selectedDateKey}
                  onChange={(e) => e.target.value && setSelectedDateKey(e.target.value)}
                  className="calendar-date-picker-input"
                  title="Selecionar data específica"
                />

                <div className="calendar-nav-arrow-group">
                  <button
                    type="button"
                    className="calendar-nav-arrow"
                    onClick={() => handleSelectNearbyDate(-1)}
                    aria-label="Dia anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="calendar-nav-arrow"
                    onClick={() => handleSelectNearbyDate(1)}
                    aria-label="Próximo dia"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Drag & Touch Scrollable Day Strip */}
            <div
              ref={dayStripRef}
              className="calendar-day-strip"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              {visibleDates.map((dateKey) => {
                const dateObj = dateFromKey(dateKey);
                const isActive = dateKey === selectedDateKey;
                const isToday = dateKey === todayStr;
                const count = groupedPersonal[dateKey]?.length || 0;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    data-date={dateKey}
                    onClick={() => handleDayButtonClick(dateKey)}
                    className={`calendar-day-pill ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                  >
                    <span className="day-pill-name">{DAY_LABELS[dateObj.getDay()]}</span>
                    <span className="day-pill-number">{dateObj.getDate()}</span>
                    <span className="day-pill-month">{MONTH_LABELS[dateObj.getMonth()]}</span>
                    {count > 0 ? (
                      <span className="day-pill-badge">{count} {count === 1 ? 'ep' : 'eps'}</span>
                    ) : (
                      <span className="day-pill-empty">-</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Title & Swipe Area */}
          <div
            className="calendar-episodes-section"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="calendar-selected-date-header">
              <h3>{selectedDateObj ? formatDateHeaderLabel(selectedDateObj) : ''}</h3>
              {selectedItems.length > 0 && (
                <span className="calendar-count-tag">{selectedItems.length} {selectedItems.length === 1 ? 'Lançamento' : 'Lançamentos'}</span>
              )}
            </div>

            {/* List of Episodes / Empty State */}
            {selectedItems.length === 0 ? (
              <div className="calendar-empty-card st-panel">
                <p>Nenhum lançamento agendado para este dia no seu cronograma.</p>
                <button
                  type="button"
                  className="calendar-btn-next-release"
                  onClick={handleJumpToNextRelease}
                >
                  Ver próximo dia com lançamentos ➔
                </button>
              </div>
            ) : (
              <div className="calendar-cards-container">
                {selectedItems.map((item) => {
                  const isReminderActive = reminders.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className="st-card glow-hover calendar-item-card"
                      onClick={() => onViewMedia(item.showId, 'show', item.seasonNumber, item.episodeNumber)}
                    >
                      <div className="calendar-card-poster">
                        <img
                          src={getImageUrl(item.showPoster)}
                          alt={item.showTitle}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="calendar-card-airbadge">
                          <Clock size={11} />
                          <span>{formatEpisodeBadge(item.airDate)}</span>
                        </div>
                      </div>

                      <div className="calendar-card-info">
                        <h4 className="calendar-card-show-title">{item.showTitle}</h4>
                        <div className="calendar-card-ep-subtitle">
                          T{item.seasonNumber} • E{item.episodeNumber} • {item.title || 'Novo episódio'}
                        </div>

                        {item.overview && (
                          <p className="calendar-card-overview">{item.overview}</p>
                        )}

                        <div className="calendar-card-actions">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReminder(item.id, `${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`);
                            }}
                            className={`calendar-reminder-btn ${isReminderActive ? 'active' : ''}`}
                          >
                            {isReminderActive ? <Check size={13} /> : <Bell size={13} />}
                            <span>{isReminderActive ? 'Lembrete ativo' : 'Lembrete'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Releases Tab */}
      {!loading && activeTab === 'global' && (
        <div className="calendar-global-content">
          {globalCalendar.length === 0 ? (
            <div className="st-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhum lançamento global obtido para hoje.
            </div>
          ) : (
            <div className="calendar-global-list">
              {globalCalendar.map((item) => (
                <div key={item.id} className="st-card calendar-global-card">
                  {item.showPoster ? (
                    <img src={item.showPoster} alt={item.showTitle} className="calendar-global-poster" />
                  ) : (
                    <div className="calendar-global-poster-fallback">
                      <Tv size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}

                  <div className="calendar-global-info">
                    <h4>{item.showTitle}</h4>
                    <div className="calendar-global-sub">
                      T{item.seasonNumber?.toString().padStart(2, '0')}E{item.episodeNumber?.toString().padStart(2, '0')} - {item.title}
                    </div>
                  </div>

                  <div className="calendar-global-date">
                    <span className="calendar-global-date-badge">
                      <CalendarIcon size={12} />
                      {new Date(item.airDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                    {item.time && (
                      <span className="calendar-global-time">
                        <Clock size={10} />
                        {item.time}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS for Calendar component */}
      <style>{`
        .calendar-header-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
          width: 100%;
        }

        .calendar-title-group h2 {
          font-family: var(--font-display);
          font-size: 28px;
          margin-bottom: 6px;
          color: var(--text-primary);
        }

        .calendar-title-group p {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        /* Tab Switcher */
        .calendar-tab-switcher {
          display: flex;
          gap: 6px;
          background: rgba(255, 255, 255, 0.04);
          padding: 5px;
          border-radius: var(--radius-md, 12px);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          width: auto;
        }

        .calendar-tab-item {
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .calendar-tab-item.active {
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000;
          box-shadow: 0 4px 14px rgba(245, 197, 24, 0.35);
        }

        .calendar-loading-state {
          padding: 60px;
          text-align: center;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .calendar-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid var(--border-color, rgba(255,255,255,0.1));
          border-top-color: var(--primary, #f5c518);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Day Strip Container & Controls */
        .calendar-strip-panel {
          padding: 16px;
          margin-bottom: 24px;
          border-radius: var(--radius-lg, 16px);
          background: var(--surface-color, rgba(255, 255, 255, 0.02));
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        }

        .calendar-strip-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .calendar-date-display {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary);
        }

        .calendar-action-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .calendar-btn-today {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(245, 197, 24, 0.12);
          color: var(--primary, #f5c518);
          border: 1px solid rgba(245, 197, 24, 0.3);
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .calendar-btn-today:hover {
          background: rgba(245, 197, 24, 0.25);
        }

        .calendar-date-picker-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
          color: var(--text-primary);
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          color-scheme: dark;
        }

        .calendar-nav-arrow-group {
          display: inline-flex;
          gap: 4px;
        }

        .calendar-nav-arrow {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          color: var(--text-primary);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .calendar-nav-arrow:hover {
          border-color: var(--primary, #f5c518);
          color: var(--primary, #f5c518);
          background: rgba(245, 197, 24, 0.1);
        }

        /* Horizontal Day Strip */
        .calendar-day-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
          padding-top: 2px;
          width: 100%;
          maxWidth: 100%;
          touch-action: pan-x;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
          user-select: none;
          cursor: grab;
        }

        .calendar-day-strip:active {
          cursor: grabbing;
        }

        .calendar-day-strip::-webkit-scrollbar {
          display: none;
        }

        .calendar-day-pill {
          flex: 0 0 auto;
          width: 76px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          border-radius: 14px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .calendar-day-pill:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .calendar-day-pill.is-today {
          border-color: rgba(245, 197, 24, 0.5);
        }

        .calendar-day-pill.active {
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000 !important;
          border-color: transparent;
          box-shadow: 0 6px 18px rgba(245, 197, 24, 0.35);
          transform: translateY(-2px);
        }

        .day-pill-name {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          opacity: 0.85;
        }

        .day-pill-number {
          font-size: 20px;
          font-weight: 800;
          line-height: 1.1;
        }

        .day-pill-month {
          font-size: 11px;
          opacity: 0.75;
        }

        .day-pill-badge {
          font-size: 10px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.15);
          padding: 2px 6px;
          border-radius: 999px;
          margin-top: 2px;
        }

        .calendar-day-pill.active .day-pill-badge {
          background: rgba(0, 0, 0, 0.2);
          color: #000;
        }

        .day-pill-empty {
          font-size: 10px;
          opacity: 0.4;
          margin-top: 2px;
        }

        /* Episodes Section */
        .calendar-episodes-section {
          width: 100%;
          min-height: 200px;
        }

        .calendar-selected-date-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .calendar-selected-date-header h3 {
          font-family: var(--font-display);
          font-size: 22px;
          margin: 0;
          color: var(--text-primary);
        }

        .calendar-count-tag {
          font-size: 12px;
          font-weight: 700;
          background: rgba(245, 197, 24, 0.12);
          color: var(--primary, #f5c518);
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(245, 197, 24, 0.25);
        }

        /* Empty State */
        .calendar-empty-card {
          padding: 36px 20px;
          text-align: center;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .calendar-btn-next-release {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
          color: var(--primary, #f5c518);
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .calendar-btn-next-release:hover {
          background: rgba(245, 197, 24, 0.15);
          border-color: var(--primary, #f5c518);
        }

        /* Episode Cards Container */
        .calendar-cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
          width: 100%;
        }

        /* Desktop & Mobile Card Layout */
        .calendar-item-card {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          background: var(--surface-color, rgba(255, 255, 255, 0.03));
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          min-width: 0;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .calendar-item-card:hover {
          transform: translateY(-2px);
          border-color: rgba(245, 197, 24, 0.4);
        }

        .calendar-card-poster {
          position: relative;
          width: 90px;
          min-width: 90px;
          background: rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .calendar-card-poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .calendar-card-airbadge {
          position: absolute;
          left: 6px;
          bottom: 6px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: calc(100% - 12px);
          white-space: nowrap;
          overflow: hidden;
        }

        .calendar-card-info {
          flex: 1;
          min-width: 0;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .calendar-card-show-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-card-ep-subtitle {
          font-size: 12px;
          color: var(--primary, #f5c518);
          font-weight: 600;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-card-overview {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0 0 10px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }

        .calendar-card-actions {
          display: flex;
          align-items: center;
          margin-top: auto;
          padding-top: 4px;
        }

        .calendar-reminder-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .calendar-reminder-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .calendar-reminder-btn.active {
          border-color: transparent;
          background: linear-gradient(135deg, #f5c518 0%, #d4a912 100%);
          color: #000;
          box-shadow: 0 3px 10px rgba(245, 197, 24, 0.3);
        }

        /* Global Tab Styling */
        .calendar-global-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .calendar-global-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--surface-color, rgba(255, 255, 255, 0.03));
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        }

        .calendar-global-poster {
          width: 44px;
          height: 64px;
          object-fit: cover;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .calendar-global-poster-fallback {
          width: 44px;
          height: 64px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .calendar-global-info {
          flex: 1;
          min-width: 0;
        }

        .calendar-global-info h4 {
          font-size: 15px;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-global-sub {
          font-size: 13px;
          color: var(--primary, #f5c518);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-global-date {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }

        .calendar-global-date-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          background: rgba(245, 197, 24, 0.12);
          color: var(--primary, #f5c518);
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 700;
        }

        .calendar-global-time {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
        }

        /* Mobile Adjustments */
        @media (max-width: 640px) {
          .calendar-header-block {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .calendar-tab-switcher {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .calendar-tab-item {
            text-align: center;
            padding: 8px 10px;
            font-size: 12px;
          }

          .calendar-cards-container {
            grid-template-columns: 1fr;
          }

          .calendar-item-card {
            min-height: 105px;
          }

          .calendar-card-poster {
            width: 80px;
            min-width: 80px;
          }

          .calendar-card-info {
            padding: 10px;
          }

          .calendar-card-show-title {
            font-size: 14px;
          }

          .calendar-card-ep-subtitle {
            font-size: 11px;
          }

          .calendar-day-pill {
            width: 68px;
            padding: 8px 6px;
          }

          .day-pill-number {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
};
