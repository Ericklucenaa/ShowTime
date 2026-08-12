import React, { Suspense, lazy, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { TrackingProvider } from './context/TrackingContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import { MessagesCenter } from './components/MessagesCenter.js';
import { DirectChatModal, type ChatFriend } from './components/DirectChatModal.js';
import { ToastHost } from './components/ToastHost.js';
import { pushToast } from './services/toast.js';
import { trackEvent } from './services/telemetry.js';
import { EpsyncLogo } from './components/EpsyncLogo.js';
import { 
  Home,
  Search as SearchIcon, 
  Calendar as CalendarIcon, 
  List, 
  User, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  LogOut,
  Sun,
  Moon,
  Bookmark,
  Users
} from 'lucide-react';

const LAZY_RETRY_KEY = 'epsync_lazy_retry_once';

function lazyWithRetry<TModule>(
  importer: () => Promise<TModule>,
  pickDefault: (module: TModule) => React.ComponentType<any>
) {
  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(LAZY_RETRY_KEY);
      return { default: pickDefault(module) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      const isDynamicImportError =
        error instanceof TypeError ||
        /dynamically imported module|module script|Failed to fetch/i.test(message);
      const alreadyRetried = sessionStorage.getItem(LAZY_RETRY_KEY) === '1';

      if (isDynamicImportError && !alreadyRetried) {
        sessionStorage.setItem(LAZY_RETRY_KEY, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }

      sessionStorage.removeItem(LAZY_RETRY_KEY);
      throw error;
    }
  });
}

const Dashboard = lazyWithRetry(() => import('./views/Dashboard.js'), (m) => m.Dashboard);
const Search = lazyWithRetry(() => import('./views/Search.js'), (m) => m.Search);
const ShowDetail = lazyWithRetry(() => import('./views/ShowDetail.js'), (m) => m.ShowDetail);
const Calendar = lazyWithRetry(() => import('./views/Calendar.js'), (m) => m.Calendar);
const Lists = lazyWithRetry(() => import('./views/Lists.js'), (m) => m.Lists);
const Profile = lazyWithRetry(() => import('./views/Profile.js'), (m) => m.Profile);
const UserProfile = lazyWithRetry(() => import('./views/UserProfile.js'), (m) => m.UserProfile);
const Following = lazyWithRetry(() => import('./views/Following.js'), (m) => m.Following);
const Friends = lazyWithRetry(() => import('./views/Friends.js'), (m) => m.Friends);

const ViewLoadingFallback: React.FC = () => (
  <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
    Carregando Epsync...
  </div>
);

type ActiveTabType = 'dashboard' | 'following' | 'search' | 'calendar' | 'lists' | 'friends' | 'profile';

interface RouteState {
  tab: ActiveTabType;
  selectedMedia: { id: string; type: 'show' | 'movie'; initialSeasonNum?: number; initialEpisodeNum?: number } | null;
  viewingProfile: { userId: string; username: string } | null;
}

function parseHashRoute(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'inicio' || clean === 'dashboard') {
    return { tab: 'dashboard', selectedMedia: null, viewingProfile: null };
  }

  if (clean.startsWith('media/')) {
    const parts = clean.split('/');
    const type = (parts[1] === 'movie' ? 'movie' : 'show') as 'show' | 'movie';
    const idWithParams = parts[2] || '';
    const [id, queryStr] = idWithParams.split('?');
    const params = new URLSearchParams(queryStr || '');
    const s = params.get('s') ? parseInt(params.get('s')!, 10) : undefined;
    const ep = params.get('ep') ? parseInt(params.get('ep')!, 10) : undefined;
    return {
      tab: 'search',
      selectedMedia: { id, type, initialSeasonNum: s, initialEpisodeNum: ep },
      viewingProfile: null
    };
  }

  if (clean.startsWith('user/')) {
    const parts = clean.split('/');
    const userId = parts[1] || '';
    return {
      tab: 'friends',
      selectedMedia: null,
      viewingProfile: { userId, username: userId }
    };
  }

  if (clean === 'descobrir' || clean === 'search') return { tab: 'search', selectedMedia: null, viewingProfile: null };
  if (clean === 'calendario' || clean === 'calendar') return { tab: 'calendar', selectedMedia: null, viewingProfile: null };
  if (clean === 'biblioteca' || clean === 'following') return { tab: 'following', selectedMedia: null, viewingProfile: null };
  if (clean === 'listas' || clean === 'lists') return { tab: 'lists', selectedMedia: null, viewingProfile: null };
  if (clean === 'amigos' || clean === 'friends') return { tab: 'friends', selectedMedia: null, viewingProfile: null };
  if (clean === 'perfil' || clean === 'profile') return { tab: 'profile', selectedMedia: null, viewingProfile: null };

  return { tab: 'dashboard', selectedMedia: null, viewingProfile: null };
}

function buildTabHash(tab: ActiveTabType): string {
  const slugMap: Record<ActiveTabType, string> = {
    dashboard: '',
    search: 'descobrir',
    calendar: 'calendario',
    following: 'biblioteca',
    lists: 'listas',
    friends: 'amigos',
    profile: 'perfil'
  };
  const slug = slugMap[tab];
  return slug ? `#/${slug}` : '#/';
}

const AppContent: React.FC = () => {
  const { user, login, register, loginWithGoogle, resetPassword, logout, error, clearError } = useAuth();
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('epsync_theme') as 'dark' | 'light') || 
           (localStorage.getItem('showtime_theme') as 'dark' | 'light') || 
           'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('epsync_theme', next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // URL Hash Routing & Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTabType>(() => {
    if (typeof window !== 'undefined') {
      return parseHashRoute(window.location.hash).tab;
    }
    return 'dashboard';
  });

  const [selectedMedia, setSelectedMedia] = useState<{ 
    id: string; 
    type: 'show' | 'movie'; 
    initialSeasonNum?: number; 
    initialEpisodeNum?: number; 
  } | null>(() => {
    if (typeof window !== 'undefined') {
      return parseHashRoute(window.location.hash).selectedMedia;
    }
    return null;
  });

  const [viewingProfile, setViewingProfile] = useState<{ userId: string; username: string } | null>(() => {
    if (typeof window !== 'undefined') {
      return parseHashRoute(window.location.hash).viewingProfile;
    }
    return null;
  });

  const [activeChatFriend, setActiveChatFriend] = useState<ChatFriend | null>(null);

  // Sync route on hash change (Browser Back / Forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute(window.location.hash);
      setActiveTab(route.tab);
      setSelectedMedia(route.selectedMedia);
      setViewingProfile(route.viewingProfile);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Event listener for opening media via custom events
  useEffect(() => {
    const handleOpenMedia = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; type?: 'show' | 'movie'; seasonNumber?: number; episodeNumber?: number }>;
      if (customEvent.detail && customEvent.detail.id) {
        handleViewMedia(
          customEvent.detail.id, 
          customEvent.detail.type || 'show',
          customEvent.detail.seasonNumber,
          customEvent.detail.episodeNumber
        );
      }
    };

    window.addEventListener('epsync:open-media', handleOpenMedia);
    window.addEventListener('showtime:open-media', handleOpenMedia);
    return () => {
      window.removeEventListener('epsync:open-media', handleOpenMedia);
      window.removeEventListener('showtime:open-media', handleOpenMedia);
    };
  }, []);

  const handleTabNavigate = (tab: ActiveTabType) => {
    trackEvent('tab_changed', { tab });
    window.location.hash = buildTabHash(tab);
  };

  const handleViewMedia = (id: string, type: 'show' | 'movie', initialSeasonNum?: number, initialEpisodeNum?: number) => {
    trackEvent('media_opened', { id, type, initialSeasonNum, initialEpisodeNum });
    let hash = `#/media/${type}/${id}`;
    if (initialSeasonNum && initialEpisodeNum) {
      hash += `?s=${initialSeasonNum}&ep=${initialEpisodeNum}`;
    }
    window.location.hash = hash;
  };

  const handleViewProfile = (userId: string, username: string) => {
    trackEvent('profile_opened', { userId, username });
    window.location.hash = `#/user/${userId}`;
  };

  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = buildTabHash(activeTab);
    }
  };

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
      if (success) {
        trackEvent('auth_register_success', { emailDomain: authEmail.split('@')[1] || 'unknown' });
        pushToast('success', 'Conta criada com sucesso no Epsync.');
        resetAuthForm();
      }
    } else {
      const success = await login(authEmail, authPassword);
      if (success) {
        trackEvent('auth_login_success', { emailDomain: authEmail.split('@')[1] || 'unknown' });
        pushToast('success', 'Bem-vindo de volta ao Epsync!');
        resetAuthForm();
      }
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
    const email = authEmail.trim();
    if (!email) {
      setValidationError('Informe seu e-mail no campo acima para recuperar a senha.');
      pushToast('info', 'Preencha o e-mail para enviar recuperação.');
      return;
    }
    
    const success = await resetPassword(email);
    if (success) {
      trackEvent('auth_password_reset_requested', { emailDomain: email.split('@')[1] || 'unknown' });
      pushToast('success', `E-mail de recuperação enviado para ${email}.`);
    }
  };

  // Nav Items definition
  const navigationItems: { id: ActiveTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Início', icon: <Home size={17} /> },
    { id: 'search', label: 'Descobrir', icon: <SearchIcon size={17} /> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={17} /> },
    { id: 'following', label: 'Minha Biblioteca', icon: <Bookmark size={17} /> },
    { id: 'lists', label: 'Listas', icon: <List size={17} /> },
    { id: 'friends', label: 'Amigos', icon: <Users size={17} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={17} /> }
  ];

  // Render main layout if logged in
  if (user) {
    return (
      <div className="app-container">
        
        {/* Header Bar */}
        <header style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 100, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 24px', 
          height: '56px', 
          background: 'var(--header-bg)', 
          borderBottom: '1px solid var(--border-color)' 
        }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }} 
            onClick={() => handleTabNavigate('dashboard')}
          >
            <EpsyncLogo size={28} variant="full" />
          </div>

          <div className="header-user-area" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={toggleTheme} className="st-btn-icon" title="Alternar tema">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <MessagesCenter
              onOpenChat={setActiveChatFriend}
              onViewProfile={handleViewProfile}
            />
            <NotificationCenter 
              onViewMedia={handleViewMedia} 
              onViewProfile={handleViewProfile} 
              onOpenChat={setActiveChatFriend}
            />
            <span className="user-greeting" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              @{user.username}
            </span>
            <img 
              src={user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
              alt={user.username} 
              onClick={() => handleTabNavigate('profile')}
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-color)', 
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)'
              }}
              title="Meu perfil"
            />
          </div>
        </header>

        {/* Main Body Grid */}
        <div className="main-content-layout">
          
          {/* Desktop Left Navigation Bar */}
          <nav className="desktop-sidebar">
            {navigationItems.map(tab => {
              const isActive = activeTab === tab.id && !selectedMedia && !viewingProfile;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabNavigate(tab.id)}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    height: '38px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(124, 92, 255, 0.3)' : 'transparent',
                    background: isActive ? 'rgba(124, 92, 255, 0.12)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: isActive ? 'var(--primary)' : 'inherit' }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
            
            <button
              onClick={logout}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                marginTop: 'auto',
                transition: 'all var(--transition-fast)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.color = 'var(--error)';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </nav>

          {/* Center viewport area */}
          <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1400px' }} className="viewport">
            <Suspense fallback={<ViewLoadingFallback />}>
              {selectedMedia ? (
                <ShowDetail 
                  mediaId={selectedMedia.id} 
                  mediaType={selectedMedia.type} 
                  onBack={handleBackNavigation} 
                  initialSeasonNum={selectedMedia.initialSeasonNum}
                  initialEpisodeNum={selectedMedia.initialEpisodeNum}
                />
              ) : (
                <>
                  {viewingProfile ? (
                    <UserProfile
                      targetUserId={viewingProfile.userId}
                      targetUsername={viewingProfile.username}
                      onBack={handleBackNavigation}
                      onViewMedia={handleViewMedia}
                      onViewProfile={handleViewProfile}
                      onOpenChat={setActiveChatFriend}
                    />
                  ) : (
                    <>
                      {activeTab === 'dashboard' && <Dashboard onViewMedia={handleViewMedia} />}
                      {activeTab === 'search' && <Search onViewMedia={handleViewMedia} />}
                      {activeTab === 'calendar' && <Calendar onViewMedia={handleViewMedia} />}
                      {activeTab === 'following' && <Following onViewMedia={handleViewMedia} />}
                      {activeTab === 'lists' && <Lists onViewMedia={handleViewMedia} />}
                      {activeTab === 'friends' && <Friends onViewProfile={handleViewProfile} onOpenChat={setActiveChatFriend} />}
                      {activeTab === 'profile' && <Profile onViewMedia={handleViewMedia} onViewProfile={handleViewProfile} />}
                    </>
                  )}
                </>
              )}
            </Suspense>
          </main>
        </div>

        {/* Floating Facebook Messenger Chat Box */}
        <DirectChatModal
          isOpen={Boolean(activeChatFriend)}
          onClose={() => setActiveChatFriend(null)}
          friend={activeChatFriend}
          onViewProfile={handleViewProfile}
        />

        {/* Mobile Bottom Navigation Bar */}
        <nav className="bottom-nav">
          {navigationItems.map(tab => {
            const isActive = activeTab === tab.id && !selectedMedia && !viewingProfile;
            return (
              <a
                key={tab.id}
                onClick={(e) => { e.preventDefault(); handleTabNavigate(tab.id); }}
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
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px', 
      background: 'radial-gradient(ellipse at top, #181528 0%, #0D0D12 70%)' 
    }}>
      <div className="st-panel" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: '36px', 
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)'
      }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '14px' }}>
            <EpsyncLogo size={42} variant="icon" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Epsync
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {isRegisterMode ? 'Crie sua conta e sincronize sua biblioteca' : 'Acesse seu universo de séries, filmes e animes'}
          </p>
        </div>

        {/* Error Alert */}
        {(validationError || error) && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '12px 14px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            borderRadius: 'var(--radius-sm)', 
            color: 'var(--error)', 
            fontSize: '13px', 
            marginBottom: '20px' 
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <div>{validationError || error}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {isRegisterMode && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Nome de Usuário
              </label>
              <input 
                type="text" 
                required 
                value={authUsername} 
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Ex: erick"
                style={{
                  width: '100%',
                  height: '42px',
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              E-mail
            </label>
            <input 
              type="email" 
              required 
              value={authEmail} 
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: '100%',
                height: '42px',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Senha
              </label>
              {!isRegisterMode && (
                <span 
                  onClick={handleForgotPassword}
                  style={{ fontSize: '11px', color: 'var(--primary)', cursor: 'pointer' }}
                >
                  Esqueceu a senha?
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{
                  width: '100%',
                  height: '42px',
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 40px 0 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="st-btn-primary" 
            style={{ 
              width: '100%', 
              height: '42px', 
              justifyContent: 'center', 
              fontSize: '14px', 
              fontWeight: 600, 
              marginTop: '8px' 
            }}
          >
            {isRegisterMode ? 'Criar Conta no Epsync' : 'Entrar no Epsync'}
          </button>
        </form>

        {/* Google Login Alternative */}
        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        <button 
          onClick={loginWithGoogle}
          className="st-btn-secondary" 
          style={{ 
            width: '100%', 
            height: '42px', 
            justifyContent: 'center', 
            fontSize: '13px', 
            fontWeight: 600,
            gap: '10px'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continuar com o Google
        </button>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isRegisterMode ? (
            <span>Já tem uma conta? <button onClick={() => { setIsRegisterMode(false); clearError(); }} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Entrar</button></span>
          ) : (
            <span>Não tem uma conta? <button onClick={() => { setIsRegisterMode(true); clearError(); }} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Cadastre-se</button></span>
          )}
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TrackingProvider>
        <NotificationProvider>
          <AppContent />
          <ToastHost />
        </NotificationProvider>
      </TrackingProvider>
    </AuthProvider>
  );
};

export default App;
