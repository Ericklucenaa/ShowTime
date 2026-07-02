import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import watchRouter from './routes/watch.js';
import showsRouter from './routes/shows.js';
import listsRouter from './routes/lists.js';
import commentsRouter from './routes/comments.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: '*',
  credentials: true
}));

// Support JSON payloads and URL encoded payloads (needed for legacy curl signin)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Standard request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// TV Time direct signin routing at top level (matching: POST https://api2.tozelabs.com/v2/signin)
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
  res.json({ status: 'OK', message: 'ShowTime backend is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

const server = app.listen(PORT, () => {
  console.log(`ShowTime Express server running on port ${PORT}`);
});

export default app;
export { server };
