import React, { useState, useEffect } from 'react';
import { backendApi, fetchTVMazeSchedule, getImageUrl } from '../services/api.js';
import { Calendar as CalendarIcon, Clock, Tv, AlertCircle } from 'lucide-react';

export const Calendar: React.FC = () => {
  const [personalCalendar, setPersonalCalendar] = useState<any[]>([]);
  const [globalCalendar, setGlobalCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');

  const loadCalendar = async () => {
    setLoading(true);
    try {
      // 1. Fetch personal calendar (tracked shows)
      const personalRes = await backendApi.get('/api/shows/calendar');
      setPersonalCalendar(personalRes.data || []);
      
      // If personal calendar is empty, default to global tab
      if (!personalRes.data || personalRes.data.length === 0) {
        setActiveTab('global');
      }

      // 2. Fetch global calendar from TVMaze
      const tvmazeData = await fetchTVMazeSchedule();
      setGlobalCalendar(tvmazeData.slice(0, 15)); // top 15 releases
    } catch (e) {
      console.error("Error loading calendars", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, []);

  return (
    <div className="calendar-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Calendário de Lançamentos</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Fique por dentro das datas de estreia dos episódios de suas séries.</p>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('personal')}
            className={activeTab === 'personal' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '12px', border: 'none', background: activeTab === 'personal' ? undefined : 'transparent' }}
          >
            Meu Cronograma ({personalCalendar.length})
          </button>
          <button 
            onClick={() => setActiveTab('global')}
            className={activeTab === 'global' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '12px', border: 'none', background: activeTab === 'global' ? undefined : 'transparent' }}
          >
            Estreias Globais (TVMaze)
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando lançamentos...</div>
      )}

      {!loading && activeTab === 'personal' && (
        personalCalendar.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Nenhum episódio no seu calendário pessoal.</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>
              Para ver lançamentos aqui, comece a marcar episódios assistidos de séries em andamento.
            </p>
            <button onClick={() => setActiveTab('global')} className="btn-primary" style={{ marginTop: '20px' }}>Ver Estreias Globais</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {personalCalendar.map(item => {
              return (
                <div 
                  key={item.id} 
                  className="glass-card glow-hover" 
                  style={{ display: 'flex', padding: '16px', gap: '16px', alignItems: 'center' }}
                >
                  <img 
                    src={getImageUrl(item.showPoster)} 
                    alt={item.showTitle} 
                    style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '15px', marginBottom: '4px' }}>{item.showTitle}</h4>
                    <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '2px' }}>
                      T{item.seasonNumber.toString().padStart(2, '0')}E{item.episodeNumber.toString().padStart(2, '0')} - {item.title}
                    </div>
                    {item.overview && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.overview}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>
                      <CalendarIcon size={12} />
                      {new Date(item.airDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {!loading && activeTab === 'global' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {globalCalendar.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Nenhum lançamento global obtido hoje.</div>
          ) : (
            globalCalendar.map(item => {
              return (
                <div 
                  key={item.id} 
                  className="glass-card" 
                  style={{ display: 'flex', padding: '16px', gap: '16px', alignItems: 'center' }}
                >
                  {item.showPoster ? (
                    <img 
                      src={item.showPoster} 
                      alt={item.showTitle} 
                      style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  ) : (
                    <div style={{ width: '50px', height: '75px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Tv size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '15px', marginBottom: '4px' }}>{item.showTitle}</h4>
                    <div style={{ fontSize: '13px', color: 'var(--secondary)', fontWeight: 'bold' }}>
                      T{item.seasonNumber.toString().padStart(2, '0')}E{item.episodeNumber.toString().padStart(2, '0')} - {item.title}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'end' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'rgba(236, 72, 153, 0.1)', color: 'var(--secondary)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>
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
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
