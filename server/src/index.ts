import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import watchRouter from './routes/watch.js';
import showsRouter from './routes/shows.js';
import listsRouter from './routes/lists.js';
import commentsRouter from './routes/comments.js';
import { authMiddleware } from './middleware/auth.js';
import { getAllowedOrigins, isProdEnv } from './config/security.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = new Set(getAllowedOrigins());

if (isProdEnv() && allowedOrigins.size === 0) {
  throw new Error('CORS_ORIGINS must be configured in production.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

app.use(globalRateLimit);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Standard request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// TV Time direct signin routing at top level (matching: POST https://api2.tozelabs.com/v2/signin)
app.use('/signin', authRateLimit);
app.use('/signup', authRateLimit);
app.use('/', authRouter);

// Standard API routes
app.use('/api/auth', authRouter);

// Apply auth middleware to all data tracking and details endpoints
app.use('/api', authMiddleware);

// Mount trackers
app.use('/api', watchRouter);
app.use('/api', showsRouter);
app.use('/api', listsRouter);
app.use('/api', commentsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'EpSync backend is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin forbidden by CORS policy.' });
  }

  if (!isProdEnv()) {
    console.error(err.stack);
  }

  return res.status(500).json({ error: 'Something went wrong on the server!' });
});

const server = app.listen(PORT, () => {
  console.log(`EpSync Express server running on port ${PORT}`);
});

export default app;
export { server };
