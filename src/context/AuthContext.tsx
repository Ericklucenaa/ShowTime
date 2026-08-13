import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth as firebaseAuth, db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, setDoc, getDoc } from 'firebase/firestore/lite';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { pushToast } from '../services/toast.js';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bannerUrl?: string;
  profileVisibility?: 'public' | 'friends' | 'private';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (emailOrUsername: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updateAvatar: (avatarUrl: string) => Promise<boolean>;
  updateBanner: (bannerUrl: string) => Promise<boolean>;
  updatePrivacy: (visibility: 'public' | 'friends' | 'private') => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapFirebaseUser = (fbUser: any): User => {
  return {
    id: fbUser.uid,
    username: fbUser.displayName || fbUser.email.split('@')[0],
    email: fbUser.email || '',
    avatarUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fbUser.uid}`
  };
};

const generateMockToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `mock-${crypto.randomUUID()}`;
  }

  return `mock-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export function formatLastActive(lastActiveAt?: string): { text: string; isOnline: boolean } {
  if (!lastActiveAt) {
    return { text: 'Offline', isOnline: false };
  }
  try {
    const date = new Date(lastActiveAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 3) {
      return { text: 'Online agora', isOnline: true };
    }
    if (diffMinutes < 60) {
      return { text: `Visto há ${diffMinutes} min`, isOnline: false };
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return { text: `Visto hoje às ${hours}:${mins}`, isOnline: false };
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return { text: `Visto ontem às ${hours}:${mins}`, isOnline: false };
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return { text: `Visto em ${day}/${month} às ${hours}:${mins}`, isOnline: false };
  } catch {
    return { text: 'Offline', isOnline: false };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuthStateChange = async (fbUser: any) => {
    if (fbUser) {
      try {
        const fbToken = await fbUser.getIdToken();
        const mappedUser = mapFirebaseUser(fbUser);

        let savedAvatarUrl: string | null = null;
        let savedBannerUrl: string | null = null;
        let savedVisibility: 'public' | 'friends' | 'private' = 'public';

        if (db) {
          try {
            const pSnap = await getDoc(doc(db, 'profiles', fbUser.uid));
            if (pSnap.exists()) {
              const pData = pSnap.data();
              if (pData.avatarUrl) savedAvatarUrl = pData.avatarUrl;
              if (pData.bannerUrl) savedBannerUrl = pData.bannerUrl;
              if (pData.profileVisibility) savedVisibility = pData.profileVisibility;
            }
          } catch (errP) {
            console.warn('Could not read user profile from Firestore:', errP);
          }
        }

        const cached = localStorage.getItem('epsync_user') || localStorage.getItem('showtime_user');
        const cachedParsed = cached ? JSON.parse(cached) : null;
        const cachedAvatar = cachedParsed?.id === fbUser.uid ? cachedParsed?.avatarUrl : null;
        const cachedBanner = cachedParsed?.id === fbUser.uid ? cachedParsed?.bannerUrl : null;

        const finalAvatarUrl = savedAvatarUrl || cachedAvatar || fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${mappedUser.username}`;
        const finalBannerUrl = savedBannerUrl || cachedBanner || undefined;

        const mergedUser: User = {
          ...mappedUser,
          avatarUrl: finalAvatarUrl,
          bannerUrl: finalBannerUrl,
          profileVisibility: (savedVisibility || (cachedParsed?.id === fbUser.uid ? cachedParsed?.profileVisibility : null)) ?? 'public',
        };

        localStorage.setItem('epsync_token', fbToken);
        localStorage.setItem('epsync_user', JSON.stringify(mergedUser));
        localStorage.setItem('showtime_token', fbToken);
        localStorage.setItem('showtime_user', JSON.stringify(mergedUser));
        setToken(fbToken);
        setUser(mergedUser);

        // Sync public profile in Firestore with lastActiveAt
        if (db) {
          const profileRef = doc(db, 'profiles', fbUser.uid);
          await setDoc(profileRef, {
            id: fbUser.uid,
            username: mappedUser.username,
            usernameLower: mappedUser.username.toLowerCase(),
            avatarUrl: finalAvatarUrl,
            profileVisibility: mergedUser.profileVisibility,
            lastActiveAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (err) {
        console.error('Error in auth state change:', err);
      }
    } else {
      localStorage.removeItem('showtime_token');
      localStorage.removeItem('showtime_user');
      setToken(null);
      setUser(null);
    }
  };

  // Heartbeat to keep lastActiveAt updated while user is active
  useEffect(() => {
    if (!user || !isFirebaseEnabled || !db) return;

    const updatePresence = async () => {
      try {
        await setDoc(doc(db, 'profiles', user.id), {
          lastActiveAt: new Date().toISOString()
        }, { merge: true });
      } catch (_) {}
    };

    updatePresence();
    const interval = setInterval(updatePresence, 120000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (isFirebaseEnabled && firebaseAuth) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
        setLoading(true);
        await handleAuthStateChange(fbUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Fallback local auth restore for offline/mock sessions
      const savedToken = localStorage.getItem('showtime_token');
      const savedUser = localStorage.getItem('showtime_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    }
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    if (isFirebaseEnabled && firebaseAuth) {
      try {
        const isEmail = emailOrUsername.includes('@');
        const email = isEmail ? emailOrUsername : `${emailOrUsername}@showtime.com`; // fallback
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        await handleAuthStateChange(userCredential.user);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase login error:', err);
        let errMsg = 'Erro ao conectar ao Firebase.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errMsg = 'E-mail ou senha inválidos.';
        } else if (err.code === 'auth/operation-not-allowed') {
          errMsg = 'O login com E-mail/Senha está desativado no Firebase Console. Ative em Authentication > Sign-in method.';
        } else if (err.code === 'auth/invalid-email') {
          errMsg = 'Formato de e-mail inválido.';
        } else if (err.code === 'auth/too-many-requests') {
          errMsg = 'Muitas tentativas malsucedidas. Tente novamente mais tarde.';
        } else if (err.code === 'auth/network-request-failed') {
          errMsg = 'Falha na conexão de rede ao comunicar com o Firebase.';
        } else if (err.message) {
          errMsg = `Erro ao fazer login: ${err.message}`;
        }
        setError(errMsg);
        setLoading(false);
        return false;
      }
    } else {
      // Offline mock authentication
      const mockUser = {
        id: 'u_mock',
        username: emailOrUsername.split('@')[0],
        email: emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@showtime.com`,
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${emailOrUsername}`
      };
      const mockToken = generateMockToken();
      localStorage.setItem('showtime_token', mockToken);
      localStorage.setItem('showtime_user', JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      setLoading(false);
      return true;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    if (isFirebaseEnabled && firebaseAuth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await updateProfile(userCredential.user, {
          displayName: username,
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
        });
        // Force refresh user profile
        const updatedUser = firebaseAuth.currentUser;
        await handleAuthStateChange(updatedUser || userCredential.user);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase signup error:', err);
        let errMsg = 'Erro ao registrar no Firebase.';
        if (err.code === 'auth/email-already-in-use') {
          errMsg = 'O endereço de e-mail já está em uso por outra conta.';
        } else if (err.code === 'auth/operation-not-allowed') {
          errMsg = 'O cadastro com E-mail/Senha está desativado no Firebase Console. Ative em Authentication > Sign-in method.';
        } else if (err.code === 'auth/invalid-email') {
          errMsg = 'Formato de e-mail inválido.';
        } else if (err.code === 'auth/weak-password') {
          errMsg = 'A senha é muito fraca. Ela deve ter pelo menos 6 caracteres.';
        } else if (err.code === 'auth/network-request-failed') {
          errMsg = 'Falha na conexão de rede ao comunicar com o Firebase.';
        } else if (err.message) {
          errMsg = `Erro ao registrar: ${err.message}`;
        }
        setError(errMsg);
        setLoading(false);
        return false;
      }
    } else {
      // Offline mock registration
      const mockUser = {
        id: 'u_mock',
        username,
        email,
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
      };
      const mockToken = generateMockToken();
      localStorage.setItem('showtime_token', mockToken);
      localStorage.setItem('showtime_user', JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      setLoading(false);
      return true;
    }
  };

  const logout = async () => {
    if (isFirebaseEnabled && firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch (err) {
        console.error('Error signing out of Firebase:', err);
      }
    } else {
      localStorage.removeItem('showtime_token');
      localStorage.removeItem('showtime_user');
      setToken(null);
      setUser(null);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    if (isFirebaseEnabled && firebaseAuth) {
      try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(firebaseAuth, provider);
        await handleAuthStateChange(userCredential.user);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase Google login error:', err);
        setError('Erro ao fazer login com o Google.');
        setLoading(false);
        return false;
      }
    } else {
      setError('Login com Google não está disponível (Firebase desativado).');
      setLoading(false);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    if (isFirebaseEnabled && firebaseAuth) {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase password reset error:', err);
        const errMsg = err.code === 'auth/user-not-found'
          ? 'Não há usuário cadastrado com este e-mail.'
          : 'Erro ao enviar e-mail de recuperação. Tente novamente.';
        setError(errMsg);
        setLoading(false);
        return false;
      }
    } else {
      pushToast('info', `[Offline] Link de redefinição simulado enviado para: ${email}`);
      setLoading(false);
      return true;
    }
  };

  const updateAvatar = async (avatarUrl: string): Promise<boolean> => {
    setError(null);
    if (!user) return false;
    try {
      if (isFirebaseEnabled && db) {
        const profileRef = doc(db, 'profiles', user.id);
        await setDoc(profileRef, { avatarUrl, updatedAt: new Date().toISOString() }, { merge: true });
      }

      if (firebaseAuth && firebaseAuth.currentUser && !avatarUrl.startsWith('data:')) {
        try {
          await updateProfile(firebaseAuth.currentUser, { photoURL: avatarUrl });
        } catch (_) {}
      }

      const updated = { ...user, avatarUrl };
      setUser(updated);
      localStorage.setItem('epsync_user', JSON.stringify(updated));
      localStorage.setItem('showtime_user', JSON.stringify(updated));
      return true;
    } catch (err: any) {
      console.error('Firebase avatar update error:', err);
      setError('Erro ao atualizar foto de perfil.');
      return false;
    }
  };

  const updateBanner = async (bannerUrl: string): Promise<boolean> => {
    setError(null);
    if (!user) return false;
    try {
      if (isFirebaseEnabled && db) {
        const profileRef = doc(db, 'profiles', user.id);
        await setDoc(profileRef, { bannerUrl, updatedAt: new Date().toISOString() }, { merge: true });
      }

      const updated = { ...user, bannerUrl };
      setUser(updated);
      localStorage.setItem('epsync_user', JSON.stringify(updated));
      localStorage.setItem('showtime_user', JSON.stringify(updated));
      return true;
    } catch (err: any) {
      console.error('Firebase banner update error:', err);
      setError('Erro ao atualizar banner do perfil.');
      return false;
    }
  };

  const clearError = () => setError(null);

  const updatePrivacy = async (visibility: 'public' | 'friends' | 'private'): Promise<boolean> => {
    if (!user) return false;
    try {
      if (isFirebaseEnabled && db) {
        await setDoc(doc(db, 'profiles', user.id), { profileVisibility: visibility, updatedAt: new Date().toISOString() }, { merge: true });
      }
      const updated = { ...user, profileVisibility: visibility };
      setUser(updated);
      localStorage.setItem('epsync_user', JSON.stringify(updated));
      localStorage.setItem('showtime_user', JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error updating privacy:', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, loginWithGoogle, resetPassword, updateAvatar, updateBanner, updatePrivacy, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
