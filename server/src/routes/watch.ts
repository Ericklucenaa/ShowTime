import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db, Show, Season, Episode, Movie, WatchEpisode, WatchMovie } from '../db.js';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const router = Router();

// POST /watched_episodes/episode/:episode_id
// Marks an episode as watched (or toggles watch state).
// Body can contain media metadata to auto-insert if show/episode does not exist in local DB.
router.post('/watched_episodes/episode/:episode_id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const episodeId = req.params.episode_id;
  const { show, episode, watchedAt } = req.body;

  const database = db.read();

  let ep = database.episodes.find(e => e.id === episodeId || (episode && e.showId === show?.id && e.seasonNumber === episode.seasonNumber && e.episodeNumber === episode.episodeNumber));

  // If episode doesn't exist, we can create it dynamically if metadata is provided
  if (!ep && show && episode) {
    let dbShow = database.shows.find(s => s.tmdbId === show.tmdbId);
    if (!dbShow) {
      dbShow = {
        id: 's_' + generateId(),
        tmdbId: show.tmdbId,
        title: show.title,
        overview: show.overview || '',
        posterPath: show.posterPath || '',
        backdropPath: show.backdropPath || '',
        firstAirDate: show.firstAirDate || '',
        genre: show.genres || [],
        status: show.status || 'Returning Series'
      };
      database.shows.push(dbShow);
    }

    let dbSeason = database.seasons.find(s => s.showId === dbShow!.id && s.seasonNumber === episode.seasonNumber);
    if (!dbSeason) {
      dbSeason = {
        id: 'sea_' + generateId(),
        showId: dbShow.id,
        seasonNumber: episode.seasonNumber,
        episodeCount: 1
      };
      database.seasons.push(dbSeason);
    } else {
      dbSeason.episodeCount += 1;
    }

    ep = {
      id: episodeId,
      showId: dbShow.id,
      seasonId: dbSeason.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title || `Episódio ${episode.episodeNumber}`,
      overview: episode.overview || '',
      airDate: episode.airDate || '',
      duration: episode.duration || 45
    };
    database.episodes.push(ep);
  }

  if (!ep) {
    return res.status(404).json({ error: 'Episode not found in database and no metadata was provided to create it.' });
  }

  // Check if already watched
  const watchIndex = database.watch_episodes.findIndex(
    w => w.userId === userId && w.episodeId === ep!.id
  );

  let watched = false;
  if (watchIndex > -1) {
    // Unwatch
    database.watch_episodes.splice(watchIndex, 1);
  } else {
    // Watch
    const newWatch: WatchEpisode = {
      id: 'we_' + generateId(),
      userId,
      showId: ep.showId,
      episodeId: ep.id,
      watchedAt: watchedAt || new Date().toISOString()
    };
    database.watch_episodes.push(newWatch);
    watched = true;
  }

  db.write(database);
  res.json({ result: 'OK', watched, episodeId: ep.id });
});

// POST /watch_movies/movie/:movie_id
// Marks a movie as watched (or toggles) or favorites it.
router.post('/watch_movies/movie/:movie_id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const movieId = req.params.movie_id;
  const { movie, action, isFavorite, watchedAt } = req.body; // action: 'watch' | 'favorite'

  const database = db.read();

  let dbMovie = database.movies.find(m => m.id === movieId || m.tmdbId === parseInt(movieId));

  if (!dbMovie && movie) {
    dbMovie = {
      id: 'm_' + generateId(),
      tmdbId: movie.tmdbId,
      title: movie.title,
      overview: movie.overview || '',
      posterPath: movie.posterPath || '',
      backdropPath: movie.backdropPath || '',
      releaseDate: movie.releaseDate || '',
      duration: movie.duration || 120,
      genre: movie.genres || []
    };
    database.movies.push(dbMovie);
  }

  if (!dbMovie) {
    return res.status(404).json({ error: 'Movie not found in database and no metadata was provided.' });
  }

  const watchEvent = database.watch_movies.find(
    w => w.userId === userId && w.movieId === dbMovie!.id
  );

  let watched = false;
  let favorite = isFavorite !== undefined ? isFavorite : false;

  if (action === 'favorite') {
    if (watchEvent) {
      watchEvent.isFavorite = !watchEvent.isFavorite;
      favorite = watchEvent.isFavorite;
      watched = true;
    } else {
      // If favorited but not watched yet, we also mark it as watched
      const newWatch: WatchMovie = {
        id: 'wm_' + generateId(),
        userId,
        movieId: dbMovie.id,
        watchedAt: new Date().toISOString(),
        isFavorite: true
      };
      database.watch_movies.push(newWatch);
      watched = true;
      favorite = true;
    }
  } else {
    // Action is watch (toggle)
    if (watchEvent) {
      database.watch_movies.splice(database.watch_movies.indexOf(watchEvent), 1);
    } else {
      const newWatch: WatchMovie = {
        id: 'wm_' + generateId(),
        userId,
        movieId: dbMovie.id,
        watchedAt: watchedAt || new Date().toISOString(),
        isFavorite: favorite
      };
      database.watch_movies.push(newWatch);
      watched = true;
    }
  }

  db.write(database);
  res.json({ result: 'OK', watched, isFavorite: favorite, movieId: dbMovie.id });
});

// GET /api/watch/history
// Returns all watch episodes and movies for the current user
router.get('/watch/history', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const database = db.read();

  const userWatchEpisodes = database.watch_episodes.filter(w => w.userId === userId);
  const userWatchMovies = database.watch_movies.filter(w => w.userId === userId);

  // 1. Hydrate movies and episodes with titles
  const hydratedMovies = userWatchMovies.map(wm => {
    const movie = database.movies.find(m => m.id === wm.movieId);
    return {
      ...wm,
      movieTitle: movie ? movie.title : 'Filme'
    };
  });

  const hydratedEpisodes = userWatchEpisodes.map(we => {
    const episode = database.episodes.find(e => e.id === we.episodeId);
    const show = database.shows.find(s => s.id === we.showId);
    return {
      ...we,
      episodeTitle: episode ? episode.title : 'Episódio',
      showTitle: show ? show.title : 'Série'
    };
  });

  // 2. Calculate genre frequencies
  const showIds = Array.from(new Set(userWatchEpisodes.map(w => w.showId)));
  const movieIds = Array.from(new Set(userWatchMovies.map(w => w.movieId)));

  const genreCounts: Record<string, number> = {};
  let totalGenresCount = 0;

  showIds.forEach(id => {
    const show = database.shows.find(s => s.id === id);
    if (show && show.genre) {
      show.genre.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
        totalGenresCount++;
      });
    }
  });

  movieIds.forEach(id => {
    const movie = database.movies.find(m => m.id === id);
    if (movie && movie.genre) {
      movie.genre.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
        totalGenresCount++;
      });
    }
  });

  res.json({
    episodes: hydratedEpisodes,
    movies: hydratedMovies,
    genreCounts,
    totalGenresCount
  });
});

// POST /api/watch/sync-import
// Bulk imports watch events (from TV Time GDPR)
router.post('/watch/sync-import', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { episodes, movies } = req.body; // Arrays of { tmdbId, title, watchedAt, seasonNumber, episodeNumber, mediaType }

  if (!Array.isArray(episodes) && !Array.isArray(movies)) {
    return res.status(400).json({ error: 'Invalid import data format. Must contain episodes or movies array.' });
  }

  const database = db.read();
  let importEpCount = 0;
  let importMovCount = 0;

  if (episodes && Array.isArray(episodes)) {
    episodes.forEach((importEp: any) => {
      // Find show by tmdbId or title
      let show = database.shows.find(s => s.tmdbId === importEp.tmdbId || s.title.toLowerCase() === importEp.title.toLowerCase());
      if (!show) {
        // Create skeleton show
        show = {
          id: 's_' + generateId(),
          tmdbId: importEp.tmdbId || 0,
          title: importEp.title,
          overview: 'Importado de TV Time',
          posterPath: '',
          backdropPath: '',
          firstAirDate: '',
          genre: [],
          status: 'Ended'
        };
        database.shows.push(show);
      }

      // Check season
      let season = database.seasons.find(s => s.showId === show!.id && s.seasonNumber === importEp.seasonNumber);
      if (!season) {
        season = {
          id: 'sea_' + generateId(),
          showId: show.id,
          seasonNumber: importEp.seasonNumber,
          episodeCount: 1
        };
        database.seasons.push(season);
      }

      // Check episode
      let episode = database.episodes.find(
        e => e.showId === show!.id && e.seasonNumber === importEp.seasonNumber && e.episodeNumber === importEp.episodeNumber
      );
      if (!episode) {
        episode = {
          id: 'ep_' + generateId(),
          showId: show.id,
          seasonId: season.id,
          seasonNumber: importEp.seasonNumber,
          episodeNumber: importEp.episodeNumber,
          title: `Episódio ${importEp.episodeNumber}`,
          overview: '',
          airDate: '',
          duration: 45
        };
        database.episodes.push(episode);
      }

      // Record watch event if not already present
      const alreadyWatched = database.watch_episodes.some(
        w => w.userId === userId && w.episodeId === episode!.id
      );

      if (!alreadyWatched) {
        database.watch_episodes.push({
          id: 'we_' + generateId(),
          userId,
          showId: show.id,
          episodeId: episode.id,
          watchedAt: importEp.watchedAt || new Date().toISOString()
        });
        importEpCount++;
      }
    });
  }

  if (movies && Array.isArray(movies)) {
    movies.forEach((importMov: any) => {
      let movie = database.movies.find(m => m.tmdbId === importMov.tmdbId || m.title.toLowerCase() === importMov.title.toLowerCase());
      if (!movie) {
        movie = {
          id: 'm_' + generateId(),
          tmdbId: importMov.tmdbId || 0,
          title: importMov.title,
          overview: 'Importado de TV Time',
          posterPath: '',
          backdropPath: '',
          releaseDate: '',
          duration: 120,
          genre: []
        };
        database.movies.push(movie);
      }

      const alreadyWatched = database.watch_movies.some(
        w => w.userId === userId && w.movieId === movie!.id
      );

      if (!alreadyWatched) {
        database.watch_movies.push({
          id: 'wm_' + generateId(),
          userId,
          movieId: movie.id,
          watchedAt: importMov.watchedAt || new Date().toISOString(),
          isFavorite: false
        });
        importMovCount++;
      }
    });
  }

  db.write(database);
  res.json({
    result: 'OK',
    importedEpisodes: importEpCount,
    importedMovies: importMovCount
  });
});

export default router;
