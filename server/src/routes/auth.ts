import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

// Helper to generate IDs if uuid is not loaded
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'showtime-secret-key-12345';

// POST /signin (Legacy TV Time exact endpoint format)
router.post('/signin', (req: Request, res: Response) => {
  // Support both application/json and application/x-www-form-urlencoded
  const username = req.body.username || req.body.email;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
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
    { expiresIn: '30d' }
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
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
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
    { expiresIn: '30d' }
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
  const { username, avatarUrl } = req.body;

  const database = db.read();
  let user = database.users.find(u => u.id === userId);

  if (!user) {
    // Cria o registro local caso não exista, mapeando o ID para o UID do Firebase
    user = {
      id: userId,
      username: username || email.split('@')[0],
      email: email,
      passwordHash: '', // Não precisa de senha local
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
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
