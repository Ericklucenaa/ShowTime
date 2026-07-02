import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { TrackingProvider } from './context/TrackingContext.js';
import { Dashboard } from './views/Dashboard.js';
import { Search } from './views/Search.js';
import { ShowDetail } from './views/ShowDetail.js';
import { Calendar } from './views/Calendar.js';
import { Lists } from './views/Lists.js';
import { Profile } from './views/Profile.js';
import { 
  Tv, 
  Search as SearchIcon, 
  Calendar as CalendarIcon, 
  List, 
  User, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  LayoutGrid
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, login, register, loginWithGoogle, error, clearError } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'calendar' | 'lists' | 'profile'>('dashboard');
  const [selectedMedia, setSelectedMedia] = useState<{ id: string; type: 'show' | 'movie' } | null>(null);
  const [previousTab, setPreviousTab] = useState<'dashboard' | 'search' | 'lists' | null>(null);

  // Auth Screen State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    // Validations
    if (!authEmail || !authPassword) {
      setValidationError("E-mail e senha são obrigatórios.");
      return;
    }

    if (isRegisterMode && !authUsername) {
      setValidationError("Nome de usuário é obrigatório.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authEmail)) {
      setValidationError("Por favor, insira um endereço de e-mail válido.");
      return;
    }

    if (authPassword.length < 6) {
      setValidationError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (isRegisterMode) {
      const success = await register(authUsername, authEmail, authPassword);
      if (success) resetAuthForm();
    } else {
      const success = await login(authEmail, authPassword);
      if (success) resetAuthForm();
    }
  };

  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthUsername('');
    setAuthPassword('');
    setValidationError(null);
    clearError();
  };

  const handleViewMedia = (id: string, type: 'show' | 'movie') => {
    setPreviousTab(activeTab as any);
    setSelectedMedia({ id, type });
  };

  const handleCloseMedia = () => {
    setSelectedMedia(null);
    if (previousTab) {
      setActiveTab(previousTab as any);
      setPreviousTab(null);
    }
  };

  // Render main layout if logged in
  if (user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
        
        {/* Header Bar */}
        <header className="glass-panel" style={{ 
          position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', 
          justifyContent: 'space-between', padding: '14px 4%', borderLeft: 'none', borderRight: 'none', borderTop: 'none',
          borderRadius: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setSelectedMedia(null); setActiveTab('dashboard'); }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', 
              width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px var(--primary-glow)'
            }}>
              <LayoutGrid size={16} color="white" />
            </div>
            <span style={{ 
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', 
              background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>ShowTime</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Olá, <strong>@{user.username}</strong></span>
            <img 
              src={user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
              alt={user.username} 
              style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)' }}
            />
          </div>
        </header>

        {/* Main Body Grid */}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'row' }} className="main-content-layout">
          
          {/* Left Navigation Bar */}
          <nav className="glass-panel nav-bar" style={{ 
            width: '240px', borderLeft: 'none', borderTop: 'none', borderBottom: 'none', 
            borderRadius: 0, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            {[
              { id: 'dashboard', label: 'Painel Geral', icon: <LayoutGrid size={18} /> },
              { id: 'search', label: 'Descobrir', icon: <SearchIcon size={18} /> },
              { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={18} /> },
              { id: 'lists', label: 'Minhas Listas', icon: <List size={18} /> },
              { id: 'profile', label: 'Perfil & Stats', icon: <User size={18} /> }
            ].map(tab => {
              const isActive = activeTab === tab.id && !selectedMedia;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setSelectedMedia(null); setActiveTab(tab.id as any); }}
                  className={isActive ? 'btn-primary' : 'btn-secondary'}
                  style={{ 
                    justifyContent: 'start', border: 'none', fontSize: '14px', padding: '12px 16px',
                    background: isActive ? undefined : 'transparent', color: isActive ? 'white' : 'var(--text-secondary)'
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Center viewport area */}
          <main style={{ flex: 1, padding: '30px 4%' }} className="viewport">
            {selectedMedia ? (
              <ShowDetail 
                mediaId={selectedMedia.id} 
                mediaType={selectedMedia.type} 
                onBack={handleCloseMedia} 
              />
            ) : (
              <>
                {activeTab === 'dashboard' && <Dashboard onViewMedia={handleViewMedia} />}
                {activeTab === 'search' && <Search onViewMedia={handleViewMedia} />}
                {activeTab === 'calendar' && <Calendar />}
                {activeTab === 'lists' && <Lists onViewMedia={handleViewMedia} />}
                {activeTab === 'profile' && <Profile />}
              </>
            )}
          </main>

        </div>

        {/* Global responsive styles */}
        <style>{`
          @media (max-width: 768px) {
            .main-content-layout {
              flex-direction: column !important;
            }
            .nav-bar {
              width: 100% !important;
              flex-direction: row !important;
              justify-content: space-around;
              padding: 10px !important;
              border-bottom: 1px solid var(--border-color) !important;
              border-right: none !important;
              overflow-x: auto;
            }
            .nav-bar button {
              padding: 8px 12px !important;
              font-size: 12px !important;
            }
            .viewport {
              padding: 20px 16px !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // Auth Screen (if not logged in)
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '35px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '30px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', 
            width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px var(--primary-glow)'
          }}>
            <Tv size={22} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '26px', letterSpacing: '-0.02em' }}>ShowTime</span>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>Sua nova central de séries, animes e filmes.</p>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button 
            onClick={() => { setIsRegisterMode(false); clearError(); setValidationError(null); }}
            className={!isRegisterMode ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '8px 0', border: 'none', background: !isRegisterMode ? undefined : 'transparent' }}
          >
            Entrar
          </button>
          <button 
            onClick={() => { setIsRegisterMode(true); clearError(); setValidationError(null); }}
            className={isRegisterMode ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '8px 0', border: 'none', background: isRegisterMode ? undefined : 'transparent' }}
          >
            Cadastrar
          </button>
        </div>

        {/* Error Boxes */}
        {(error || validationError) && (
          <div style={{ display: 'flex', alignItems: 'start', gap: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '13px', color: 'var(--error)' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>{validationError || error}</div>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegisterMode && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Nome de Usuário</label>
              <input 
                type="text" 
                required
                placeholder="Ex: joaosilva"
                value={authUsername}
                onChange={e => setAuthUsername(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>E-mail</label>
            <input 
              type="email" 
              required
              placeholder="Ex: joao@email.com"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="Mínimo 6 caracteres"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 40px 10px 14px', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '10px', padding: '12px' }}>
            {isRegisterMode ? 'Criar Minha Conta' : 'Acessar Conta'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span style={{ padding: '0 10px' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        <button 
          onClick={loginWithGoogle}
          className="btn-secondary"
          style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.24-.63-.37-1.3-.38-2.08c0-.79.13-1.46.38-2.09z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Entrar com o Google
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          Proteção de dados com criptografia de ponta a ponta e total conformidade com a LGPD.
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <TrackingProvider>
        <AppContent />
      </TrackingProvider>
    </AuthProvider>
  );
}
