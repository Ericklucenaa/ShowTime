import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtAudience, getJwtIssuer, getJwtSecret } from '../config/security.js';

const JWT_SECRET = getJwtSecret();
const JWT_ISSUER = getJwtIssuer();
const JWT_AUDIENCE = getJwtAudience();

let firebaseInitialized = false;

async function verifyFirebaseToken(token: string) {
  const adminAppModule = await import('firebase-admin/app');
  const adminAuthModule = await import('firebase-admin/auth');

  if (!firebaseInitialized && adminAppModule.getApps().length === 0) {
    adminAppModule.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'showtime-78f63'
    });
    firebaseInitialized = true;
  }

  return adminAuthModule.getAuth().verifyIdToken(token);
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
    const decodedPayload = jwt.decode(token) as jwt.JwtPayload | null;
    const issuer = decodedPayload?.iss;
    const isFirebaseToken = !!issuer && issuer.includes('securetoken.google.com');

    if (isFirebaseToken) {
      const fbDecoded = await verifyFirebaseToken(token);
      req.userId = fbDecoded.uid;
      req.userEmail = fbDecoded.email;
      next();
    } else {
      const localDecoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }) as { userId: string; email: string };

      req.userId = localDecoded.userId;
      req.userEmail = localDecoded.email;
      next();
    }
  } catch (error: any) {
    console.error('Auth middleware verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
