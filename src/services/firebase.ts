import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore/lite';
import { getStorage } from 'firebase/storage';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'showtime-78f63';
const envStorageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();

const normalizeStorageBucket = (bucket: string): string => {
  const cleaned = bucket.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (!cleaned) return `${projectId}.appspot.com`;

  // The Web SDK expects bucket names (e.g. my-project.appspot.com), not HTTPS hosts.
  if (cleaned.includes('firebasestorage.app')) {
    return `${projectId}.appspot.com`;
  }

  return cleaned;
};

const resolvedStorageBucket = normalizeStorageBucket(envStorageBucket);

// Vite environment variables for Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId,
  storageBucket: resolvedStorageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Check if Firebase configuration is provided
export const isFirebaseEnabled = !!(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

let app;
let auth: any = null;
let db: any = null;
let storage: any = null;

if (isFirebaseEnabled) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    storage.maxUploadRetryTime = 10000;
    storage.maxOperationRetryTime = 10000;
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
  }
}

export { auth, db, storage };
