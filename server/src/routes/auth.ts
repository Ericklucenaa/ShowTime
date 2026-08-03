import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { getJwtAudience, getJwtIssuer, getJwtSecret } from '../config/security.js';

// Helper to generate IDs if uuid is not loaded
function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

const router = Router();
const JWT_SECRET = getJwtSecret();
const JWT_ISSUER = getJwtIssuer();
const JWT_AUDIENCE = getJwtAudience();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUsername(username: string): string {
  return username.trim();
}

// POST /signin (Legacy TV Time exact endpoint format)
router.post('/signin', (req: Request, res: Response) => {
  const username = String(req.body.username || req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Invalid credentials format' });
  }

  const database = db.read();
  // Find user by username or email
  const user = database.users.find(
    u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    {
      expiresIn: '30d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256'
    }
  );

  res.json({
    result: 'OK',
    id: user.id,
    tvst_access_token: token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl
    }
  });
});

// POST /signup
router.post('/signup', (req: Request, res: Response) => {
  const username = normalizeUsername(String(req.body.username || ''));
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be between 3 and 32 characters' });
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username contains invalid characters' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  }

  const database = db.read();
  
  // Check if user already exists
  const userExists = database.users.some(
    u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
  );

  if (userExists) {
    return res.status(400).json({ error: 'Username or email already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = {
    id: 'u_' + generateId(),
    username,
    email,
    passwordHash,
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
    createdAt: new Date().toISOString()
  };

  database.users.push(newUser);
  db.write(database);

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    JWT_SECRET,
    {
      expiresIn: '30d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256'
    }
  );

  res.status(201).json({
    result: 'OK',
    id: newUser.id,
    tvst_access_token: token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl
    }
  });
});

// POST /firebase-sync
// Sincroniza usuário do Firebase no banco de dados local
router.post('/firebase-sync', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const email = req.userEmail || '';
  const username = String(req.body.username || '').trim();
  const avatarUrl = String(req.body.avatarUrl || '').trim();

  const database = db.read();
  let user = database.users.find(u => u.id === userId);

  if (!user) {
    // Cria o registro local caso não exista, mapeando o ID para o UID do Firebase
    user = {
      id: userId,
      username: username || email.split('@')[0],
      email: email,
      passwordHash: '', // Não precisa de senha local
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username || userId}`,
      createdAt: new Date().toISOString()
    };
    database.users.push(user);
    db.write(database);
    console.log(`Novo usuário Firebase sincronizado localmente: @${user.username} (${user.id})`);
  } else {
    // Atualiza nome ou avatar se necessário
    let changed = false;
    if (username && user.username !== username) {
      user.username = username;
      changed = true;
    }
    if (avatarUrl && user.avatarUrl !== avatarUrl) {
      user.avatarUrl = avatarUrl;
      changed = true;
    }
    if (changed) {
      db.write(database);
    }
  }

  res.json({
    result: 'OK',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl
    }
  });
});

export default router;
