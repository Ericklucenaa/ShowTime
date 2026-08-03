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

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
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
        localStorage.setItem('showtime_token', fbToken);
        localStorage.setItem('showtime_user', JSON.stringify(mappedUser));
        setToken(fbToken);
        setUser(mappedUser);

        // Sync public profile
        if (db) {
          const profileRef = doc(db, 'profiles', fbUser.uid);
          await setDoc(profileRef, {
            id: fbUser.uid,
            username: mappedUser.username,
            usernameLower: mappedUser.username.toLowerCase(),
            email: mappedUser.email,
            emailLower: mappedUser.email.toLowerCase(),
            avatarUrl: mappedUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${mappedUser.username}`,
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
        const errMsg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'E-mail ou senha inválidos.' 
          : 'Erro ao conectar ao Firebase. Verifique suas credenciais.';
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
        const errMsg = err.code === 'auth/email-already-in-use'
          ? 'O endereço de e-mail já está em uso por outra conta.'
          : 'Erro ao registrar no Firebase. Tente uma senha mais forte.';
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
      alert(`[Offline Mode] Link de redefinição simulado enviado para: ${email}`);
      setLoading(false);
      return true;
    }
  };

  const updateAvatar = async (avatarUrl: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    if (isFirebaseEnabled && firebaseAuth && firebaseAuth.currentUser) {
      try {
        await updateProfile(firebaseAuth.currentUser, { photoURL: avatarUrl });
        await handleAuthStateChange(firebaseAuth.currentUser);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase avatar update error:', err);
        setError('Erro ao atualizar foto de perfil no Firebase.');
        setLoading(false);
        return false;
      }
    } else {
      if (user) {
        const mockUser = { ...user, avatarUrl };
        localStorage.setItem('showtime_user', JSON.stringify(mockUser));
        setUser(mockUser);
      }
      setLoading(false);
      return true;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, loginWithGoogle, resetPassword, updateAvatar, logout, clearError }}>
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
