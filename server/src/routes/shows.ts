import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../db.js';

const router = Router();

// GET /shows/calendar
// Returns calendar of episodes for followed shows.
// Followed shows = shows with at least one watched episode.
router.get('/shows/calendar', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const database = db.read();

  const watchedShowIds = Array.from(
    new Set(database.watch_episodes.filter(w => w.userId === userId).map(w => w.showId))
  );

  const followedShowsEpisodes = database.episodes.filter(e => watchedShowIds.includes(e.showId));

  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 14);
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(now.getDate() + 30);

  const calendarEpisodes = followedShowsEpisodes.filter(e => {
    if (!e.airDate) return false;
    const airDate = new Date(e.airDate);
    return airDate >= oneWeekAgo && airDate <= thirtyDaysAhead;
  });

  const result = calendarEpisodes.map(ep => {
    const show = database.shows.find(s => s.id === ep.showId);
    return {
      ...ep,
      showTitle: show ? show.title : 'Show Desconhecido',
      showPoster: show ? show.posterPath : '',
      showTmdbId: show ? show.tmdbId : 0
    };
  });

  result.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());

  res.json(result);
});

// GET /shows/:id
// Returns show details along with seasons list
router.get('/shows/:id', (req: AuthenticatedRequest, res: Response) => {
  const showId = req.params.id;
  const database = db.read();
  const numericShowId = Number.parseInt(showId, 10);

  const show = database.shows.find(s => s.id === showId || s.tmdbId === numericShowId);
  if (!show) {
    return res.status(404).json({ error: 'Show not found' });
  }

  const seasons = database.seasons.filter(s => s.showId === show.id);
  res.json({
    ...show,
    seasons
  });
});

// GET /shows/:id/seasons/:season_number
// Legacy TV Time format: /show/{id}/seasons/{season}
// Also handles /shows/:id/seasons/:season_number
router.get('/shows/:id/seasons/:season_number', (req: AuthenticatedRequest, res: Response) => {
  const showId = req.params.id;
  const seasonNumber = Number.parseInt(req.params.season_number, 10);
  const database = db.read();
  const numericShowId = Number.parseInt(showId, 10);

  if (Number.isNaN(seasonNumber)) {
    return res.status(400).json({ error: 'Invalid season number' });
  }

  // Find show by ID or tmdbId
  const show = database.shows.find(s => s.id === showId || s.tmdbId === numericShowId);
  if (!show) {
    return res.status(404).json({ error: 'Show not found' });
  }

  const episodes = database.episodes.filter(
    e => e.showId === show.id && e.seasonNumber === seasonNumber
  );

  res.json(episodes);
});

// Support exact TV Time routing `/show/:id/seasons/:season` (singular)
router.get('/show/:id/seasons/:season_number', (req: AuthenticatedRequest, res: Response) => {
  const showId = req.params.id;
  const seasonNumber = Number.parseInt(req.params.season_number, 10);
  const database = db.read();
  const numericShowId = Number.parseInt(showId, 10);

  if (Number.isNaN(seasonNumber)) {
    return res.status(400).json({ error: 'Invalid season number' });
  }

  const show = database.shows.find(s => s.id === showId || s.tmdbId === numericShowId);
  if (!show) {
    return res.status(404).json({ error: 'Show not found' });
  }

  const episodes = database.episodes.filter(
    e => e.showId === show.id && e.seasonNumber === seasonNumber
  );

  res.json(episodes);
});

export default router;
