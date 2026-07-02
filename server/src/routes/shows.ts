import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../db.js';

const router = Router();

// GET /shows/:id
// Returns show details along with seasons list
router.get('/shows/:id', (req: AuthenticatedRequest, res: Response) => {
  const showId = req.params.id;
  const database = db.read();

  const show = database.shows.find(s => s.id === showId || s.tmdbId === parseInt(showId));
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
  const seasonNumber = parseInt(req.params.season_number);
  const database = db.read();

  // Find show by ID or tmdbId
  const show = database.shows.find(s => s.id === showId || s.tmdbId === parseInt(showId));
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
  const seasonNumber = parseInt(req.params.season_number);
  const database = db.read();

  const show = database.shows.find(s => s.id === showId || s.tmdbId === parseInt(showId));
  if (!show) {
    return res.status(404).json({ error: 'Show not found' });
  }

  const episodes = database.episodes.filter(
    e => e.showId === show.id && e.seasonNumber === seasonNumber
  );

  res.json(episodes);
});

// GET /shows/calendar
// Returns calendar of episodes for followed shows.
// Followed shows = shows with at least one watched episode.
router.get('/shows/calendar', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const database = db.read();

  // Get show IDs the user has watched
  const watchedShowIds = Array.from(
    new Set(database.watch_episodes.filter(w => w.userId === userId).map(w => w.showId))
  );

  // Find all episodes of these shows
  const followedShowsEpisodes = database.episodes.filter(e => watchedShowIds.includes(e.showId));

  // Let's filter to mock upcoming or recent releases (e.g. from -7 days to +30 days)
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 14);
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(now.getDate() + 30);

  // Filter episodes with valid airDate in this range
  const calendarEpisodes = followedShowsEpisodes.filter(e => {
    if (!e.airDate) return false;
    const airDate = new Date(e.airDate);
    // If it's a mock date that falls in range, or we can adjust them to make calendar look full!
    return airDate >= oneWeekAgo && airDate <= thirtyDaysAhead;
  });

  // Hydrate each episode with show title and poster details
  const result = calendarEpisodes.map(ep => {
    const show = database.shows.find(s => s.id === ep.showId);
    return {
      ...ep,
      showTitle: show ? show.title : 'Show Desconhecido',
      showPoster: show ? show.posterPath : '',
      showTmdbId: show ? show.tmdbId : 0
    };
  });

  // Sort by air date
  result.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());

  res.json(result);
});

export default router;
