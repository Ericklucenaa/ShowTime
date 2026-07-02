import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { setTmdbKey, hasRealTmdbKey } from '../services/api.js';
import { Key, BarChart3, UploadCloud, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { watchedEpisodes, watchedMovies, importTvTimeData, genreCounts, totalGenresCount } = useTracking();

  // API Key state
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(hasRealTmdbKey());

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Load key from storage
  useEffect(() => {
    const savedKey = localStorage.getItem('showtime_tmdb_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setTmdbKey(apiKey);
    setKeySaved(!!apiKey);
    alert(apiKey ? "Chave TMDB salva com sucesso! O catálogo dinâmico está ativado." : "Chave removida. O app voltou para o catálogo de demonstração.");
  };

  // Math stats
  const totalEpTime = watchedEpisodes.length * 40; // avg 40m
  const totalMovTime = watchedMovies.length * 120; // avg 120m
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const totalDays = (totalHours / 24).toFixed(1);

  // Parse and Import GDPR files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rawData = JSON.parse(text);
        
        let importedEpisodes: any[] = [];
        let importedMovies: any[] = [];

        // Check structure
        if (Array.isArray(rawData)) {
          // Detect if they are movies or episodes
          // TV Time Movie structure usually has: tmdb_id, title, updated_at
          // TV Time Episode structure usually has: tvdb_id, show_name, season_number, episode_number, updated_at
          if (rawData.length > 0) {
            const first = rawData[0];
            if ('episode_number' in first || 'season_number' in first) {
              importedEpisodes = rawData.map((item: any) => ({
                tmdbId: item.tmdb_id || item.tvdb_id || 0, // Fallback mapping
                title: item.show_name || item.show_title || 'Série Importada',
                seasonNumber: parseInt(item.season_number) || 1,
                episodeNumber: parseInt(item.episode_number) || 1,
                watchedAt: item.updated_at || item.watched_at || new Date().toISOString()
              }));
            } else if ('tmdb_id' in first || 'movie_title' in first) {
              importedMovies = rawData.map((item: any) => ({
                tmdbId: item.tmdb_id || 0,
                title: item.title || item.movie_title || 'Filme Importado',
                watchedAt: item.updated_at || item.watched_at || new Date().toISOString()
              }));
            } else {
              throw new Error("Formato de arquivo não reconhecido.");
            }
          }
        } else if (rawData.movies || rawData.episodes) {
          // If combined structure
          if (rawData.episodes) {
            importedEpisodes = rawData.episodes;
          }
          if (rawData.movies) {
            importedMovies = rawData.movies;
          }
        } else {
          throw new Error("Estrutura JSON inválida.");
        }

        if (importedEpisodes.length === 0 && importedMovies.length === 0) {
          setImportStatus({ success: false, msg: 'Nenhum registro de mídia válido encontrado no arquivo.' });
          setImportLoading(false);
          return;
        }

        // Call bulk import endpoint
        const result = await importTvTimeData(importedEpisodes, importedMovies);
        
        setImportStatus({
          success: true,
          msg: `Sincronização Concluída! Importados: ${result.importedEpisodes} episódios e ${result.importedMovies} filmes com sucesso.`
        });
      } catch (err: any) {
        setImportStatus({
          success: false,
          msg: `Erro de Importação: ${err.message || 'Arquivo corrompido ou formato inválido.'}`
        });
      } finally {
        setImportLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="profile-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Profile Header card */}
      <div className="glass-panel" style={{ padding: '30px', display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <img 
          src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} 
          alt={user?.username} 
          style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px solid var(--primary)', padding: '4px' }}
        />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>@{user?.username}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>{user?.email}</p>
          <button onClick={logout} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', gap: '6px', color: 'var(--error)', borderColor: 'rgba(239, 68, 110, 0.2)' }}>
            <LogOut size={14} />
            Sair da Conta
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }} className="profile-grid">
        
        {/* Left Column: API KEY & GDPR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* TMDB API Key settings */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} style={{ color: 'var(--primary)' }} />
              Chave da API TMDB
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              Insira sua chave de desenvolvedor gratuita do **The Movie Database (TMDB)** para buscar séries e filmes do catálogo global em tempo real. Se deixado em branco, o app funciona em modo de demonstração local.
            </p>
            <form onSubmit={handleSaveKey} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="password" 
                placeholder="Inserir API Key do TMDB..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '10px 16px' }}>
                Salvar
              </button>
            </form>
            {keySaved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '11px', marginTop: '10px', fontWeight: 'bold' }}>
                <CheckCircle2 size={12} />
                Catálogo Global Conectado
              </div>
            )}
          </section>

          {/* TV Time GDPR Migration Tool */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={18} style={{ color: 'var(--secondary)' }} />
              Migração do TV Time
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              Importe seus dados oficiais do TV Time obtidos via GDPR (`seen_episodes.json` ou `seen_movies.json`). 
              Basta fazer upload do arquivo JSON correspondente para sincronizar todo o seu histórico em segundos!
            </p>

            <div style={{ position: 'relative', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', transition: 'background var(--transition-fast)' }}
                 onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                 onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
            >
              <input 
                type="file" 
                accept=".json"
                onChange={handleFileUpload}
                disabled={importLoading}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
              <UploadCloud size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {importLoading ? 'Processando arquivo...' : 'Escolher arquivo JSON do TV Time'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Suporta seen_episodes.json e seen_movies.json</div>
            </div>

            {/* Import results Alert box */}
            {importStatus && (
              <div className="glass-card animate-fade-in" style={{ padding: '12px 16px', marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'start', background: importStatus.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', borderColor: importStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
                {importStatus.success ? <CheckCircle2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />}
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {importStatus.msg}
                </div>
              </div>
            )}
          </section>

        </div>

        {/* Right Column: Detailed Stats */}
        <div>
          <section className="glass-panel" style={{ padding: '24px', height: '100%' }}>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              Estatísticas Detalhadas
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '30px' }}>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>{totalDays}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Dias de Maratona</div>
              </div>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--secondary)' }}>{watchedEpisodes.length + watchedMovies.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Títulos Concluídos</div>
              </div>
            </div>

            {/* Custom SVG/CSS Charts for genres distribution */}
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Frequência por Categoria</h4>
            
            {(() => {
              const sortedGenres = Object.entries(genreCounts || {})
                .map(([name, count]) => ({
                  name,
                  count,
                  percentage: totalGenresCount > 0 ? Math.round((count / totalGenresCount) * 100) : 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 4);

              if (sortedGenres.length === 0) {
                return (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '13px' }}>
                    Nenhum gênero assistido ainda. Adicione séries ou filmes ao seu histórico!
                  </div>
                );
              }

              const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--warning)'];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sortedGenres.map((g, i) => {
                    const barColor = colors[i % colors.length];
                    return (
                      <div key={g.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span>{g.name}</span>
                          <span>{g.percentage}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: 'var(--radius-full)' }}>
                          <div style={{ width: `${g.percentage}%`, height: '100%', background: barColor, borderRadius: 'var(--radius-full)' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </section>
        </div>

      </div>

      <style>{`
        @media (max-width: 800px) {
          .profile-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
