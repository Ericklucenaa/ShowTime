import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { BarChart3, LogOut, Camera } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout, updateAvatar } = useAuth();
  const { watchedEpisodes, watchedMovies, genreCounts, totalGenresCount } = useTracking();

  // Avatar Picker State
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);

  const avatarPresets = [
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_1`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_2`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}_3`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_4`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}_5`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_6`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}_7`
  ];

  const handleSelectAvatar = async (url: string) => {
    setAvatarLoading(true);
    const success = await updateAvatar(url);
    if (success) {
      setShowAvatarPicker(false);
    }
    setAvatarLoading(false);
  };

  // Math stats (improved estimation based on genres)
  let totalEpTime = 0;
  watchedEpisodes.forEach(ep => {
    const g = ep.genres || [];
    if (g.includes('Animation') || g.includes('Animação')) {
      totalEpTime += 24; // Anime / Cartoons
    } else if (g.includes('Comedy') || g.includes('Comédia') || g.includes('Sitcom')) {
      totalEpTime += 25; // Sitcoms
    } else if (g.includes('Drama') || g.includes('Crime') || g.includes('Action') || g.includes('Ação')) {
      totalEpTime += 50; // Heavy Dramas / Action
    } else {
      totalEpTime += 40; // Default average
    }
  });

  const totalMovTime = watchedMovies.length * 110; // avg 110m for movies
  const totalHours = Math.round((totalEpTime + totalMovTime) / 60);
  const totalDays = (totalHours / 24).toFixed(1);

  return (
    <div className="profile-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Profile Header card */}
      <div className="st-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <div 
            style={{ position: 'relative', cursor: 'pointer', borderRadius: '50%', overflow: 'hidden', width: '90px', height: '90px' }} 
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            title="Clique para alterar a foto de perfil"
            className="avatar-container"
          >
            <img 
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} 
              alt={user?.username} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: 'rgba(255,255,255,0.05)', border: '2px solid var(--primary)', padding: '4px', transition: 'all 0.2s' }}
            />
            <div style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s' 
            }} className="avatar-hover-overlay">
              <Camera size={24} color="white" />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>@{user?.username}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>{user?.email}</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowAvatarPicker(!showAvatarPicker)} 
                className="st-btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', gap: '6px' }}
              >
                <Camera size={16} />
                Alterar Foto
              </button>
              <button onClick={logout} className="st-btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', gap: '6px', color: 'var(--error)', borderColor: 'rgba(239, 68, 110, 0.2)' }}>
                <LogOut size={16} />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>

        {showAvatarPicker && (
          <div className="st-card animate-fade-in" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Escolha um Avatar ou insira um link personalizado</h4>
            
            {/* Presets Grid */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {avatarPresets.map((preset, index) => (
                <div 
                  key={index}
                  onClick={() => handleSelectAvatar(preset)}
                  style={{ 
                    width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                    border: user?.avatarUrl === preset ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.02)', padding: '2px', transition: 'transform 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img src={preset} alt={`Preset ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            {/* Custom URL Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (customAvatarUrl.trim()) handleSelectAvatar(customAvatarUrl.trim());
              }}
              style={{ display: 'flex', gap: '10px' }}
            >
              <input 
                type="url"
                required
                placeholder="Insira a URL de uma imagem (ex: https://site.com/foto.jpg)"
                value={customAvatarUrl}
                onChange={e => setCustomAvatarUrl(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button type="submit" className="st-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={avatarLoading}>
                {avatarLoading ? 'Salvando...' : 'Salvar URL'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }} className="profile-grid">
        <section className="st-panel" style={{ padding: '24px', height: '100%' }}>
            <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              Estatísticas Detalhadas
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '30px' }}>
              <div className="st-card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>{totalDays}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Dias de Maratona</div>
              </div>
              <div className="st-card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
