import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { TrackingProvider } from './context/TrackingContext.js';
import { 
  Tv, 
  Search as SearchIcon, 
  Calendar as CalendarIcon, 
  List, 
  User, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  LayoutGrid,
  LogOut,
  Sun,
  Moon,
  Bookmark,
  Users
} from 'lucide-react';

const Dashboard = lazy(() => import('./views/Dashboard.js').then((m) => ({ default: m.Dashboard })));
const Search = lazy(() => import('./views/Search.js').then((m) => ({ default: m.Search })));
const ShowDetail = lazy(() => import('./views/ShowDetail.js').then((m) => ({ default: m.ShowDetail })));
const Calendar = lazy(() => import('./views/Calendar.js').then((m) => ({ default: m.Calendar })));
const Lists = lazy(() => import('./views/Lists.js').then((m) => ({ default: m.Lists })));
const Profile = lazy(() => import('./views/Profile.js').then((m) => ({ default: m.Profile })));
const UserProfile = lazy(() => import('./views/UserProfile.js').then((m) => ({ default: m.UserProfile })));
const Following = lazy(() => import('./views/Following.js').then((m) => ({ default: m.Following })));
const Friends = lazy(() => import('./views/Friends.js').then((m) => ({ default: m.Friends })));

const ViewLoadingFallback: React.FC = () => (
  <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
    Carregando tela...
  </div>
);

const AppContent: React.FC = () => {
  const { user, login, register, loginWithGoogle, resetPassword, logout, error, clearError } = useAuth();
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('showtime_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('showtime_theme', next);
      return next;
    });
  };

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'calendar' | 'lists' | 'following' | 'friends' | 'profile'>('dashboard');
  const [selectedMedia, setSelectedMedia] = useState<{ 
    id: string; 
    type: 'show' | 'movie'; 
    initialSeasonNum?: number; 
    initialEpisodeNum?: number; 
  } | null>(null);
  const [previousTab, setPreviousTab] = useState<'dashboard' | 'search' | 'lists' | 'following' | 'friends' | null>(null);

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

    if (authPassword.length < 8) {
      setValidationError("A senha deve ter no mínimo 8 caracteres.");
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

  const handleForgotPassword = async () => {
    let email = authEmail.trim();
    if (!email) {
      email = prompt("Digite seu e-mail para recuperar a senha:") || "";
    } else {
      const confirmEmail = confirm(`Enviar e-mail de recuperação para: ${email}?`);
      if (!confirmEmail) {
        email = prompt("Digite seu e-mail para recuperar a senha:") || "";
      }
    }
    
    if (!email || !email.trim()) return;
    
    const success = await resetPassword(email);
    if (success) {
      alert(`E-mail de recuperação enviado com sucesso para ${email}! Verifique sua caixa de entrada (e pasta de spam).`);
    }
  };

  const [viewingProfile, setViewingProfile] = useState<{ userId: string; username: string } | null>(null);

  const handleViewMedia = (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => {
    setViewingProfile(null);
    setPreviousTab(activeTab as any);
    setSelectedMedia({ id, type, initialSeasonNum, initialEpisodeNum });
  };

  const handleViewProfile = (userId: string, username: string) => {
    setSelectedMedia(null);
    setViewingProfile({ userId, username });
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
      <div className="app-container">
        
        {/* Header Bar */}
        <header className="st-panel" style={{ 
          position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', 
          justifyContent: 'space-between', padding: '14px 4%', borderLeft: 'none', borderRight: 'none', borderTop: 'none',
          borderRadius: 0, background: 'rgba(7,7,10,0.85)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setSelectedMedia(null); setActiveTab('dashboard'); }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary) 0%, #d4a912 100%)', 
              width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px var(--primary-glow)'
            }}>
              <LayoutGrid size={16} color="black" />
            </div>
            <span style={{ 
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', 
              background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--primary) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>ShowTime</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={toggleTheme} className="st-btn-icon" title="Alternar Tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="user-greeting" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Olá, <strong>@{user.username}</strong></span>
            <img 
              src={user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
              alt={user.username} 
              onClick={() => { setSelectedMedia(null); setViewingProfile(null); setActiveTab('profile'); }}
              style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', cursor: 'pointer' }}
            />
          </div>
        </header>

        {/* Main Body Grid */}
        <div className="main-content-layout">
          
          {/* Desktop Left Navigation Bar */}
          <nav className="desktop-sidebar">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={18} /> },
              { id: 'following', label: 'Seguindo', icon: <Bookmark size={18} /> },
              { id: 'search', label: 'Descobrir', icon: <SearchIcon size={18} /> },
              { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={18} /> },
              { id: 'lists', label: 'Minhas Listas', icon: <List size={18} /> },
              { id: 'friends', label: 'Amigos', icon: <Users size={18} /> },
              { id: 'profile', label: 'Perfil & Stats', icon: <User size={18} /> }
            ].map(tab => {
              const isActive = activeTab === tab.id && !selectedMedia && !viewingProfile;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setSelectedMedia(null); setViewingProfile(null); setActiveTab(tab.id as any); }}
                  className={isActive ? 'st-btn-primary' : 'st-btn-secondary'}
                  style={{ 
                    justifyContent: 'start', padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: isActive ? undefined : 'transparent', color: isActive ? '#000' : 'var(--text-secondary)'
                  }}
                >
                  {tab.icon}
                  <span className="nav-label">{tab.label}</span>
                </button>
              );
            })}
            
            <button
              onClick={logout}
              className="st-btn-secondary"
              style={{ 
                justifyContent: 'start', padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'transparent', color: '#ff4a4a', marginTop: 'auto'
              }}
            >
              <LogOut size={18} />
              <span className="nav-label">Sair da Conta</span>
            </button>
          </nav>

          {/* Center viewport area */}
          <main style={{ flex: 1, padding: '30px 4%' }} className="viewport">
            <Suspense fallback={<ViewLoadingFallback />}>
              {selectedMedia ? (
                <ShowDetail 
                  mediaId={selectedMedia.id} 
                  mediaType={selectedMedia.type} 
                  onBack={handleCloseMedia} 
                  initialSeasonNum={selectedMedia.initialSeasonNum}
                  initialEpisodeNum={selectedMedia.initialEpisodeNum}
                />
              ) : (
                <>
                  {viewingProfile ? (
                    <UserProfile
                      targetUserId={viewingProfile.userId}
                      targetUsername={viewingProfile.username}
                      onBack={() => setViewingProfile(null)}
                      onViewMedia={handleViewMedia}
                    />
                  ) : (
                    <>
                      {activeTab === 'dashboard' && <Dashboard onViewMedia={handleViewMedia} />}
                      {activeTab === 'following' && <Following onViewMedia={handleViewMedia} />}
                      {activeTab === 'search' && <Search onViewMedia={handleViewMedia} onViewProfile={handleViewProfile} />}
                      {activeTab === 'calendar' && <Calendar onViewMedia={handleViewMedia} />}
                      {activeTab === 'lists' && <Lists onViewMedia={handleViewMedia} />}
                      {activeTab === 'friends' && <Friends onViewProfile={handleViewProfile} />}
                      {activeTab === 'profile' && <Profile />}
                    </>
                  )}
                </>
              )}
            </Suspense>
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="bottom-nav">
          {[
            { id: 'dashboard', label: 'Painel', icon: <LayoutGrid size={20} /> },
            { id: 'following', label: 'Seguindo', icon: <Bookmark size={20} /> },
            { id: 'search', label: 'Buscar', icon: <SearchIcon size={20} /> },
            { id: 'friends', label: 'Amigos', icon: <Users size={20} /> },
            { id: 'profile', label: 'Perfil', icon: <User size={20} /> }
          ].map(tab => {
            const isActive = activeTab === tab.id && !selectedMedia && !viewingProfile;
            return (
              <a
                key={tab.id}
                onClick={(e) => { e.preventDefault(); setSelectedMedia(null); setViewingProfile(null); setActiveTab(tab.id as any); }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
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
                placeholder="Mínimo 8 caracteres"
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

          {!isRegisterMode && (
            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <button 
                type="button"
                onClick={handleForgotPassword}
                style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

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
          Dados protegidos com boas práticas de segurança e políticas de privacidade configuráveis.
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
