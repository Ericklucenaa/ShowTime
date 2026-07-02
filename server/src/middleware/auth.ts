import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'showtime-secret-key-12345';

// Initialize Firebase Admin if it hasn't been initialized yet
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'showtime-78f63'
  });
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const tokenHeader = req.header('TVST_ACCESS_TOKEN') || req.header('Authorization');
  
  if (!tokenHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  let token = tokenHeader;
  if (tokenHeader.startsWith('Bearer ')) {
    token = tokenHeader.substring(7);
  }

  try {
    // 1. Decode token to inspect issuer
    const decodedPayload = jwt.decode(token) as any;
    const isFirebaseToken = decodedPayload && decodedPayload.iss && decodedPayload.iss.includes('securetoken.google.com');

    if (isFirebaseToken) {
      // 2. Verify with Firebase Admin Auth
      const fbDecoded = await getAuth().verifyIdToken(token);
      req.userId = fbDecoded.uid;
      req.userEmail = fbDecoded.email;
      next();
    } else {
      // 3. Verify with local JWT
      const localDecoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = localDecoded.userId;
      req.userEmail = localDecoded.email;
      next();
    }
  } catch (error: any) {
    console.error('Auth middleware verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
