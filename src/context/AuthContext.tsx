import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth as firebaseAuth, db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, setDoc } from 'firebase/firestore/lite';
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

        // Restore cached extras (avatarUrl, privacy) from localStorage to avoid a Firestore read on every login
        const cached = localStorage.getItem('showtime_user');
        const cachedParsed = cached ? JSON.parse(cached) : null;
        const mergedUser: User = {
          ...mappedUser,
          avatarUrl: (cachedParsed?.id === fbUser.uid ? cachedParsed?.avatarUrl : null) || mappedUser.avatarUrl,
          profileVisibility: (cachedParsed?.id === fbUser.uid ? cachedParsed?.profileVisibility : null) ?? 'public',
        };

        localStorage.setItem('showtime_token', fbToken);
        localStorage.setItem('showtime_user', JSON.stringify(mergedUser));
        setToken(fbToken);
        setUser(mergedUser);

        // Sync public profile (write only, no read)
        if (db) {
          const safeAvatarUrl = mergedUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${mappedUser.username}`;
          const safePhotoUrl = fbUser.photoURL || safeAvatarUrl || null;

          const profileRef = doc(db, 'profiles', fbUser.uid);
          await setDoc(profileRef, {
            id: fbUser.uid,
            username: mappedUser.username,
            usernameLower: mappedUser.username.toLowerCase(),
            avatarUrl: safeAvatarUrl,
            photoUrl: safePhotoUrl,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Also sync users collection if queried by external or legacy code
          const userRef = doc(db, 'users', fbUser.uid);
          await setDoc(userRef, {
            id: fbUser.uid,
            username: mappedUser.username,
            email: mappedUser.email || '',
            avatarUrl: safeAvatarUrl,
            photoUrl: safePhotoUrl,
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
    if (isFirebaseEnabled && firebaseAuth && firebaseAuth.currentUser) {
      try {
        const uid = firebaseAuth.currentUser.uid;

        if (avatarUrl.startsWith('data:image/')) {
          // Save compressed base64 directly to Firestore — no Storage needed
          if (db) {
            const profileRef = doc(db, 'profiles', uid);
            await setDoc(profileRef, { avatarUrl, updatedAt: new Date().toISOString() }, { merge: true });
          }
          if (user) {
            const updated = { ...user, avatarUrl };
            setUser(updated);
            localStorage.setItem('showtime_user', JSON.stringify(updated));
          }
          return true;
        }

        setLoading(true);
        await updateProfile(firebaseAuth.currentUser, { photoURL: avatarUrl });
        await handleAuthStateChange(firebaseAuth.currentUser);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase avatar update error:', err);
        setError('Erro ao atualizar foto de perfil.');
        setLoading(false);
        return false;
      }
    } else {
      if (user) {
        const mockUser = { ...user, avatarUrl };
        localStorage.setItem('showtime_user', JSON.stringify(mockUser));
        setUser(mockUser);
      }
      return true;
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
      localStorage.setItem('showtime_user', JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error updating privacy:', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, loginWithGoogle, resetPassword, updateAvatar, updatePrivacy, logout, clearError }}>
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
