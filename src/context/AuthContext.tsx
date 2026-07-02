import React, { createContext, useState, useContext, useEffect } from 'react';
import { backendApi } from '../services/api.js';
import { auth as firebaseAuth, isFirebaseEnabled } from '../services/firebase.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
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
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync Firebase User with our Express Backend
  const syncFirebaseUser = async (fbUser: any, fbToken: string, usernameOverride?: string) => {
    try {
      const response = await backendApi.post('/api/auth/firebase-sync', {
        uid: fbUser.uid,
        email: fbUser.email,
        username: usernameOverride || fbUser.displayName || fbUser.email.split('@')[0],
        avatarUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fbUser.uid}`
      }, {
        headers: {
          'TVST_ACCESS_TOKEN': fbToken,
          'Authorization': `Bearer ${fbToken}`
        }
      });
      
      const userData = response.data.user;
      localStorage.setItem('showtime_token', fbToken);
      localStorage.setItem('showtime_user', JSON.stringify(userData));
      setToken(fbToken);
      setUser(userData);
    } catch (err) {
      console.error('Error synchronizing Firebase user with backend:', err);
    }
  };

  useEffect(() => {
    if (isFirebaseEnabled && firebaseAuth) {
      // Set up Firebase auth listener
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
        setLoading(true);
        if (fbUser) {
          try {
            const fbToken = await fbUser.getIdToken();
            await syncFirebaseUser(fbUser, fbToken);
          } catch (err) {
            console.error('Error getting Firebase token:', err);
          }
        } else {
          // Firebase logged out
          localStorage.removeItem('showtime_token');
          localStorage.removeItem('showtime_user');
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Fallback local auth restore
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

    const isEmail = emailOrUsername.includes('@');

    if (isFirebaseEnabled && firebaseAuth && isEmail) {
      try {
        // Firebase Auth expects email
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, emailOrUsername, password);
        const fbToken = await userCredential.user.getIdToken();
        await syncFirebaseUser(userCredential.user, fbToken);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error('Firebase login error, attempting local database fallback:', err);
        // Fallback to local auth if Firebase fails
        try {
          const response = await backendApi.post('/signin', { username: emailOrUsername, password });
          const { tvst_access_token, user: userData } = response.data;
          
          localStorage.setItem('showtime_token', tvst_access_token);
          localStorage.setItem('showtime_user', JSON.stringify(userData));
          
          setToken(tvst_access_token);
          setUser(userData);
          setLoading(false);
          return true;
        } catch (localErr: any) {
          const errMsg = localErr.response?.data?.error || 'E-mail ou senha inválidos.';
          setError(errMsg);
          setLoading(false);
          return false;
        }
      }
    } else {
      // Legacy backend auth
      try {
        const response = await backendApi.post('/signin', { username: emailOrUsername, password });
        const { tvst_access_token, user: userData } = response.data;
        
        localStorage.setItem('showtime_token', tvst_access_token);
        localStorage.setItem('showtime_user', JSON.stringify(userData));
        
        setToken(tvst_access_token);
        setUser(userData);
        setLoading(false);
        return true;
      } catch (err: any) {
        const errMsg = err.response?.data?.error || 'Erro ao fazer login. Verifique suas credenciais.';
        setError(errMsg);
        setLoading(false);
        return false;
      }
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
        const fbToken = await userCredential.user.getIdToken();
        await syncFirebaseUser(userCredential.user, fbToken, username);
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
      // Legacy backend auth
      try {
        const response = await backendApi.post('/signup', { username, email, password });
        const { tvst_access_token, user: userData } = response.data;
        
        localStorage.setItem('showtime_token', tvst_access_token);
        localStorage.setItem('showtime_user', JSON.stringify(userData));
        
        setToken(tvst_access_token);
        setUser(userData);
        setLoading(false);
        return true;
      } catch (err: any) {
        const errMsg = err.response?.data?.error || 'Erro ao registrar. Username ou email podem já estar em uso.';
        setError(errMsg);
        setLoading(false);
        return false;
      }
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
        const fbToken = await userCredential.user.getIdToken();
        await syncFirebaseUser(userCredential.user, fbToken);
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

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, loginWithGoogle, logout, clearError }}>
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
