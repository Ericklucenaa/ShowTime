import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db, Comment, Reaction } from '../db.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

const router = Router();
const ALLOWED_REACTIONS = new Set(['like', 'love', 'wow', 'sad', 'angry']);

function hasExactlyOneTarget(payload: { episodeId?: unknown; showId?: unknown; movieId?: unknown }): boolean {
  const count = [payload.episodeId, payload.showId, payload.movieId].filter(Boolean).length;
  return count === 1;
}

// GET /comments
// Fetches comments for an episode, show, or movie
router.get('/comments', (req: AuthenticatedRequest, res: Response) => {
  const { episodeId, showId, movieId } = req.query;
  const database = db.read();

  let comments: Comment[] = [];

  if (episodeId) {
    comments = database.comments.filter(c => c.episodeId === episodeId);
  } else if (showId) {
    comments = database.comments.filter(c => c.showId === showId && !c.episodeId);
  } else if (movieId) {
    comments = database.comments.filter(c => c.movieId === movieId);
  } else {
    return res.status(400).json({ error: 'Must provide episodeId, showId, or movieId parameter' });
  }

  // Sort comments by newest first
  comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(comments);
});

// POST /comments
// Post a new comment
router.post('/comments', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { episodeId, showId, movieId, content } = req.body;

  if (!hasExactlyOneTarget({ episodeId, showId, movieId })) {
    return res.status(400).json({ error: 'Exactly one target is required: episodeId, showId, or movieId.' });
  }

  const normalizedContent = String(content || '').trim();

  if (!normalizedContent) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  if (normalizedContent.length > 1000) {
    return res.status(400).json({ error: 'Comment content exceeds max length (1000).' });
  }

  const database = db.read();
  const user = database.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newComment: Comment = {
    id: 'c_' + generateId(),
    userId,
    username: user.username,
    episodeId: episodeId || undefined,
    showId: showId || undefined,
    movieId: movieId || undefined,
    content: normalizedContent,
    createdAt: new Date().toISOString()
  };

  database.comments.push(newComment);
  db.write(database);

  res.status(201).json(newComment);
});

// GET /reactions
// Fetches counts of each reaction type and current user's reaction
router.get('/reactions', (req: AuthenticatedRequest, res: Response) => {
  const { episodeId, showId, movieId } = req.query;
  const userId = req.userId!;
  const database = db.read();

  let reactions: Reaction[] = [];

  if (episodeId) {
    reactions = database.reactions.filter(r => r.episodeId === episodeId);
  } else if (showId) {
    reactions = database.reactions.filter(r => r.showId === showId && !r.episodeId);
  } else if (movieId) {
    reactions = database.reactions.filter(r => r.movieId === movieId);
  } else {
    return res.status(400).json({ error: 'Must provide episodeId, showId, or movieId' });
  }

  // Count by type
  const counts: Record<string, number> = {};
  reactions.forEach(r => {
    counts[r.type] = (counts[r.type] || 0) + 1;
  });

  // Find current user's reaction
  const userReaction = reactions.find(r => r.userId === userId);

  res.json({
    counts,
    total: reactions.length,
    userReactionType: userReaction ? userReaction.type : null,
    userReactionId: userReaction ? userReaction.id : null
  });
});

// POST /reactions
// Add or update a reaction. If same reaction exists, remove it (toggle).
router.post('/reactions', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { episodeId, showId, movieId, type } = req.body; // type: 'like', 'love', 'wow', 'sad', 'angry'

  if (!hasExactlyOneTarget({ episodeId, showId, movieId })) {
    return res.status(400).json({ error: 'Exactly one target is required: episodeId, showId, or movieId.' });
  }

  const normalizedType = String(type || '').trim().toLowerCase();

  if (!normalizedType) {
    return res.status(400).json({ error: 'Reaction type is required' });
  }

  if (!ALLOWED_REACTIONS.has(normalizedType)) {
    return res.status(400).json({ error: 'Invalid reaction type' });
  }

  const database = db.read();

  // Find existing reaction by this user
  let existingReactionIndex = -1;

  if (episodeId) {
    existingReactionIndex = database.reactions.findIndex(r => r.userId === userId && r.episodeId === episodeId);
  } else if (showId) {
    existingReactionIndex = database.reactions.findIndex(r => r.userId === userId && r.showId === showId && !r.episodeId);
  } else if (movieId) {
    existingReactionIndex = database.reactions.findIndex(r => r.userId === userId && r.movieId === movieId);
  }

  let action = '';
  if (existingReactionIndex > -1) {
    const existingReaction = database.reactions[existingReactionIndex];
    if (existingReaction.type === normalizedType) {
      // Toggle off: remove
      database.reactions.splice(existingReactionIndex, 1);
      action = 'removed';
    } else {
      // Change reaction type
      existingReaction.type = normalizedType;
      existingReaction.createdAt = new Date().toISOString();
      action = 'updated';
    }
  } else {
    // Add new reaction
    const newReaction: Reaction = {
      id: 'r_' + generateId(),
      userId,
      episodeId: episodeId || undefined,
      showId: showId || undefined,
      movieId: movieId || undefined,
      type: normalizedType,
      createdAt: new Date().toISOString()
    };
    database.reactions.push(newReaction);
    action = 'added';
  }

  db.write(database);
  res.json({ result: 'OK', action });
});

export default router;
