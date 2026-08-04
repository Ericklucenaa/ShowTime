import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { useAuth } from './AuthContext.js';
import { fetchSeasonEpisodes } from '../services/api.js';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  writeBatch
} from 'firebase/firestore/lite';

export interface WatchEpisodeEvent {
  id: string;
  userId: string;
  showId: string;
  episodeId: string;
  watchedAt: string;
  genres?: string[];
  showTitle?: string;
  episodeTitle?: string;
}

export interface WatchMovieEvent {
  id: string;
  userId: string;
  movieId: string;
  watchedAt: string;
  isFavorite: boolean;
  movieTitle?: string;
  genres?: string[];
}

export interface CustomList {
  id: string;
  name: string;
  description: string;
  type: 'show' | 'movie' | 'mixed';
  itemCount: number;
}

interface TrackingContextType {
  watchedEpisodes: WatchEpisodeEvent[];
  watchedMovies: WatchMovieEvent[];
  lists: CustomList[];
  followedShows: string[];
  followedUsers: string[];
  loading: boolean;
  genreCounts: Record<string, number>;
  totalGenresCount: number;
  favoriteGenres: string[];
  streakDays: number;
  lastWatchedAt: string | null;
  totalWatchEvents: number;
  refreshData: () => Promise<void>;
  toggleWatchEpisode: (episodeId: string, showMetadata?: any, episodeMetadata?: any) => Promise<boolean>;
  toggleWatchMovie: (movieId: string, movieMetadata?: any) => Promise<boolean>;
  toggleFavoriteMovie: (movieId: string, movieMetadata?: any) => Promise<boolean>;
  createList: (name: string, description: string, type: 'show' | 'movie' | 'mixed') => Promise<boolean>;
  deleteList: (listId: string) => Promise<void>;
  addToList: (listId: string, mediaType: 'show' | 'movie', mediaId: string, mediaMetadata?: any) => Promise<boolean>;
  removeFromList: (listId: string, mediaId: string) => Promise<boolean>;
  fetchListItems: (listId: string) => Promise<any>;
  toggleFollowShow: (showId: string, showMetadata?: any) => Promise<boolean>;
  toggleFollowUser: (targetUserId: string) => Promise<boolean>;
  watchAllEpisodesOfShow: (showMetadata: any) => Promise<void>;
  importTvTimeData: (episodes: any[], movies: any[]) => Promise<{ importedEpisodes: number; importedMovies: number }>;
  watchAllEpisodesOfSeason: (showMetadata: any, episodes: any[], seasonNumber: number) => Promise<void>;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

// LocalStorage helpers for offline/mock mode
const getLocalData = (key: string, defaultVal: any) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
};

const setLocalData = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function isEpisodeReleased(airDateValue?: string): boolean {
  if (!airDateValue) return false;
  const parsed = new Date(airDateValue);
  if (Number.isNaN(parsed.getTime())) return false;

  const releaseDay = new Date(parsed);
  releaseDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return releaseDay <= today;
}

const REFRESH_MIN_INTERVAL_MS = 8000;
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
const LIST_ITEMS_CACHE_TTL_MS = 60000;
const QUOTA_COOLDOWN_STORAGE_KEY = 'showtime_firestore_quota_cooldown_until';

function isQuotaExceededError(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return code.includes('resource-exhausted') || msg.includes('quota exceeded');
}

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchEpisodeEvent[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<WatchMovieEvent[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [followedShows, setFollowedShows] = useState<string[]>([]);
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>({});
  const [totalGenresCount, setTotalGenresCount] = useState<number>(0);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [lastWatchedAt, setLastWatchedAt] = useState<string | null>(null);
  const [totalWatchEvents, setTotalWatchEvents] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const initialQuotaCooldown = typeof window !== 'undefined'
    ? Number(localStorage.getItem(QUOTA_COOLDOWN_STORAGE_KEY) || 0)
    : 0;
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef<number>(0);
  const quotaCooldownUntilRef = useRef<number>(initialQuotaCooldown);
  const quotaWarnedAtRef = useRef<number>(0);
  const listItemsCacheRef = useRef<Record<string, { at: number; data: any }>>({});

  const hydrateTrackingSnapshot = useCallback((uid: string) => {
    const eps = getLocalData(`showtime_watch_episodes_${uid}`, []);
    const movs = getLocalData(`showtime_watch_movies_${uid}`, []);
    const customLists = getLocalData(`showtime_custom_lists_${uid}`, []);
    const follows = getLocalData(`showtime_followed_shows_${uid}`, []);
    const followsUsers = getLocalData(`showtime_followed_users_${uid}`, []);

    setWatchedEpisodes(eps);
    setWatchedMovies(movs);
    setLists(customLists);
    setFollowedShows(follows);
    setFollowedUsers(followsUsers);
    calculateGenreStats(eps, movs);
    calculateEngagementStats(eps, movs);
  }, []);

  const calculateEngagementStats = (eps: WatchEpisodeEvent[], movs: WatchMovieEvent[]) => {
    const events = [...eps, ...movs].sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
    setTotalWatchEvents(events.length);
    setLastWatchedAt(events.length > 0 ? events[0].watchedAt : null);

    if (events.length === 0) {
      setStreakDays(0);
      setFavoriteGenres([]);
      return;
    }

    const daySet = new Set<string>();
    events.forEach((ev) => {
      daySet.add(new Date(ev.watchedAt).toISOString().slice(0, 10));
    });

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (;;) {
      const dayKey = cursor.toISOString().slice(0, 10);
      if (!daySet.has(dayKey)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreakDays(streak);

    const genreCounter: Record<string, number> = {};
    eps.forEach((ev) => {
      (ev.genres || []).forEach((g) => {
        genreCounter[g] = (genreCounter[g] || 0) + 1;
      });
    });
    movs.forEach((ev) => {
      (ev.genres || []).forEach((g) => {
        genreCounter[g] = (genreCounter[g] || 0) + 1;
      });
    });

    const topGenres = Object.entries(genreCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);
    setFavoriteGenres(topGenres);
  };

  // Compute genre statistics on the client-side
  const calculateGenreStats = (eps: WatchEpisodeEvent[], movs: WatchMovieEvent[]) => {
    const counts: Record<string, number> = {};
    let total = 0;

    // We collect genres from watched episodes (grouped by show to avoid duplicating show genres per episode count, or just count shows)
    const uniqueShows = Array.from(new Set(eps.map(e => e.showId)));
    uniqueShows.forEach(showId => {
      // Find one episode event for this show to get the genres
      const ev = eps.find(e => e.showId === showId);
      if (ev && ev.genres && Array.isArray(ev.genres)) {
        ev.genres.forEach(g => {
          counts[g] = (counts[g] || 0) + 1;
          total++;
        });
      }
    });

    movs.forEach(m => {
      if (m.genres && Array.isArray(m.genres)) {
        m.genres.forEach(g => {
          counts[g] = (counts[g] || 0) + 1;
          total++;
        });
      }
    });

    setGenreCounts(counts);
    setTotalGenresCount(total);
  };

  const refreshData = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    if (now < quotaCooldownUntilRef.current) {
      hydrateTrackingSnapshot(user.id);
      if (now - quotaWarnedAtRef.current > 20000) {
        quotaWarnedAtRef.current = now;
        pushToast('info', 'Limite temporario do Firestore atingido. Tentando novamente em instantes.');
      }
      return;
    }

    if (now - lastRefreshAtRef.current < REFRESH_MIN_INTERVAL_MS) {
      return;
    }

    const runRefresh = async () => {
      setLoading(true);
    
      if (isFirebaseEnabled && db) {
        try {
          // 1. Fetch watched episodes
          const qEp = query(collection(db, 'watch_episodes'), where('userId', '==', user.id));
          const snapEp = await getDocs(qEp);
          const eps = snapEp.docs.map(d => d.data() as WatchEpisodeEvent);
          setWatchedEpisodes(eps);

          // 2. Fetch watched movies
          const qMov = query(collection(db, 'watch_movies'), where('userId', '==', user.id));
          const snapMov = await getDocs(qMov);
          const movs = snapMov.docs.map(d => d.data() as WatchMovieEvent);
          setWatchedMovies(movs);

          // 3. Fetch custom lists (avoid N+1 reads for list items count)
          const qLists = query(collection(db, 'custom_lists'), where('userId', '==', user.id));
          const snapLists = await getDocs(qLists);
          const loadedLists = snapLists.docs.map((d) => {
            const listData = d.data();
            return {
              id: d.id,
              name: listData.name,
              description: listData.description || '',
              type: listData.type || 'mixed',
              itemCount: Number.isFinite(listData.itemCount) ? listData.itemCount : 0
            } as CustomList;
          });
          setLists(loadedLists);

          // 4. Fetch followed shows
          const qFollow = query(collection(db, 'followed_shows'), where('userId', '==', user.id));
          const snapFollow = await getDocs(qFollow);
          const follows = snapFollow.docs.map(d => d.data().showId as string);
          setFollowedShows(follows);

          // 5. Fetch followed profiles
          const qFollowUsers = query(collection(db, 'profile_follows'), where('followerId', '==', user.id));
          const snapFollowUsers = await getDocs(qFollowUsers);
          const followsUsers = snapFollowUsers.docs.map(d => d.data().followedId as string);
          setFollowedUsers(followsUsers);

          // 6. Calculate genre stats
          calculateGenreStats(eps, movs);
          calculateEngagementStats(eps, movs);

          // Keep local snapshot updated for quota fallback mode.
          setLocalData(`showtime_watch_episodes_${user.id}`, eps);
          setLocalData(`showtime_watch_movies_${user.id}`, movs);
          setLocalData(`showtime_custom_lists_${user.id}`, loadedLists);
          setLocalData(`showtime_followed_shows_${user.id}`, follows);
          setLocalData(`showtime_followed_users_${user.id}`, followsUsers);

          if (quotaCooldownUntilRef.current > 0) {
            quotaCooldownUntilRef.current = 0;
            localStorage.removeItem(QUOTA_COOLDOWN_STORAGE_KEY);
          }

          lastRefreshAtRef.current = Date.now();
        } catch (e: any) {
          if (isQuotaExceededError(e)) {
            const cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
            quotaCooldownUntilRef.current = cooldownUntil;
            localStorage.setItem(QUOTA_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
            hydrateTrackingSnapshot(user.id);
            if (Date.now() - quotaWarnedAtRef.current > 20000) {
              quotaWarnedAtRef.current = Date.now();
              pushToast('info', 'Cota do Firestore em uso alto. Operando em modo local temporario.');
            }
            lastRefreshAtRef.current = Date.now();
          } else {
            console.error('Error fetching Firestore tracking data:', e);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Offline fallback
        hydrateTrackingSnapshot(user.id);
        lastRefreshAtRef.current = Date.now();
        setLoading(false);
      }
    };

    refreshInFlightRef.current = runRefresh().finally(() => {
      refreshInFlightRef.current = null;
    });
    await refreshInFlightRef.current;
  }, [user, hydrateTrackingSnapshot]);

  useEffect(() => {
    if (user) {
      refreshData();
    } else {
      setWatchedEpisodes([]);
      setWatchedMovies([]);
      setLists([]);
      setFollowedShows([]);
      setFollowedUsers([]);
      setGenreCounts({});
      setTotalGenresCount(0);
      setFavoriteGenres([]);
      setStreakDays(0);
      setLastWatchedAt(null);
      setTotalWatchEvents(0);
    }
  }, [user]);

  const toggleWatchEpisode = async (episodeId: string, showMetadata?: any, episodeMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    // Check current state
    const alreadyWatchedIndex = watchedEpisodes.findIndex(w => w.episodeId === episodeId);
    const isWatched = alreadyWatchedIndex > -1;

    // Optimistic Update
    let newEps = [...watchedEpisodes];
    if (isWatched) {
      newEps.splice(alreadyWatchedIndex, 1);
    } else {
      newEps.push({
        id: 'we_' + generateId(),
        userId: user.id,
        showId: showMetadata?.id || episodeMetadata?.showId || episodeId.split('_')[1],
        episodeId,
        watchedAt: new Date().toISOString(),
        genres: showMetadata?.genres || showMetadata?.genre || [],
        showTitle: showMetadata?.title || 'Série',
        episodeTitle: episodeMetadata?.title || `Episódio`
      });
    }
    setWatchedEpisodes(newEps);
    calculateGenreStats(newEps, watchedMovies);
    calculateEngagementStats(newEps, watchedMovies);
    trackEvent('watch_episode_toggled', { episodeId, watched: !isWatched, mediaType: 'show' });

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'watch_episodes', `${user.id}_${episodeId}`);
        if (isWatched) {
          await deleteDoc(docRef);
        } else {
          const newEvent: WatchEpisodeEvent = {
            id: 'we_' + generateId(),
            userId: user.id,
            showId: showMetadata?.id || episodeMetadata?.showId || episodeId.split('_')[1],
            episodeId,
            watchedAt: new Date().toISOString(),
            genres: showMetadata?.genres || showMetadata?.genre || [],
            showTitle: showMetadata?.title || 'Série',
            episodeTitle: episodeMetadata?.title || `Episódio`
          };
          await setDoc(docRef, newEvent);
        }
        return !isWatched;
      } catch (e) {
        console.error('Error toggling Firestore watch episode:', e);
        // Rollback
        setWatchedEpisodes(watchedEpisodes);
        calculateGenreStats(watchedEpisodes, watchedMovies);
        calculateEngagementStats(watchedEpisodes, watchedMovies);
        pushToast('error', 'Não foi possível atualizar episódio agora.');
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_watch_episodes_${user.id}`, newEps);
      return !isWatched;
    }
  };

  const watchAllEpisodesOfSeason = async (showMetadata: any, episodes: any[], seasonNumber: number): Promise<void> => {
    if (!user) return;

    const unwatchedEpisodes = episodes.filter(ep => {
      const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
      const alreadyWatched = watchedEpisodes.some(we => we.episodeId === epId);
      if (alreadyWatched) return false;
      // Skip episodes with unknown or future release dates in bulk actions.
      return isEpisodeReleased(ep.airDate);
    });

    if (unwatchedEpisodes.length === 0) return;
    setLoading(true);

    if (isFirebaseEnabled && db) {
      try {
        const batch = writeBatch(db);
        unwatchedEpisodes.forEach(ep => {
          const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
          const docRef = doc(db, 'watch_episodes', `${user.id}_${epId}`);
          const newEvent: WatchEpisodeEvent = {
            id: 'we_' + generateId(),
            userId: user.id,
            showId: showMetadata.id,
            episodeId: epId,
            watchedAt: new Date().toISOString(),
            genres: showMetadata.genres || showMetadata.genre || [],
            showTitle: showMetadata.title,
            episodeTitle: ep.title
          };
          batch.set(docRef, newEvent);
        });
        await batch.commit();
        await refreshData();
      } catch (e) {
        console.error('Error in Firestore watchAllEpisodesOfSeason:', e);
      } finally {
        setLoading(false);
      }
    } else {
      // Offline fallback
      const eps = [...watchedEpisodes];
      unwatchedEpisodes.forEach(ep => {
        const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
        eps.push({
          id: 'we_' + generateId(),
          userId: user.id,
          showId: showMetadata.id,
          episodeId: epId,
          watchedAt: new Date().toISOString(),
          genres: showMetadata.genres || showMetadata.genre || [],
          showTitle: showMetadata.title,
          episodeTitle: ep.title
        });
      });
      setLocalData(`showtime_watch_episodes_${user.id}`, eps);
      setWatchedEpisodes(eps);
      calculateGenreStats(eps, watchedMovies);
      setLoading(false);
    }
  };

  const toggleWatchMovie = async (movieId: string, movieMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    const alreadyWatchedIndex = watchedMovies.findIndex(w => w.movieId === movieId);
    const isWatched = alreadyWatchedIndex > -1;

    // Optimistic Update
    let newMovs = [...watchedMovies];
    if (isWatched) {
      newMovs.splice(alreadyWatchedIndex, 1);
    } else {
      newMovs.push({
        id: 'wm_' + generateId(),
        userId: user.id,
        movieId,
        watchedAt: new Date().toISOString(),
        isFavorite: false,
        movieTitle: movieMetadata?.title || 'Filme',
        genres: movieMetadata?.genres || movieMetadata?.genre || []
      });
    }
    setWatchedMovies(newMovs);
    calculateGenreStats(watchedEpisodes, newMovs);
    calculateEngagementStats(watchedEpisodes, newMovs);
    trackEvent('watch_movie_toggled', { movieId, watched: !isWatched, mediaType: 'movie' });

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'watch_movies', `${user.id}_${movieId}`);
        if (isWatched) {
          await deleteDoc(docRef);
        } else {
          const newEvent: WatchMovieEvent = {
            id: 'wm_' + generateId(),
            userId: user.id,
            movieId,
            watchedAt: new Date().toISOString(),
            isFavorite: false,
            movieTitle: movieMetadata?.title || 'Filme',
            genres: movieMetadata?.genres || movieMetadata?.genre || []
          };
          await setDoc(docRef, newEvent);
        }
        return !isWatched;
      } catch (e) {
        console.error('Error toggling Firestore watch movie:', e);
        // Rollback
        setWatchedMovies(watchedMovies);
        calculateGenreStats(watchedEpisodes, watchedMovies);
        calculateEngagementStats(watchedEpisodes, watchedMovies);
        pushToast('error', 'Falha ao atualizar filme assistido.');
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_watch_movies_${user.id}`, newMovs);
      return !isWatched;
    }
  };

  const toggleFavoriteMovie = async (movieId: string, movieMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    const movieIndex = watchedMovies.findIndex(w => w.movieId === movieId);
    const isWatched = movieIndex > -1;

    // Optimistic Update
    let newMovs = [...watchedMovies];
    let newFavoriteStatus = true;
    if (isWatched) {
      newFavoriteStatus = !watchedMovies[movieIndex].isFavorite;
      newMovs[movieIndex] = { ...newMovs[movieIndex], isFavorite: newFavoriteStatus };
    } else {
      newMovs.push({
        id: 'wm_' + generateId(),
        userId: user.id,
        movieId,
        watchedAt: new Date().toISOString(),
        isFavorite: true,
        movieTitle: movieMetadata?.title || 'Filme',
        genres: movieMetadata?.genres || movieMetadata?.genre || []
      });
    }
    setWatchedMovies(newMovs);
    trackEvent('movie_favorite_toggled', { movieId, favorite: newFavoriteStatus });

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'watch_movies', `${user.id}_${movieId}`);
        if (isWatched) {
          await setDoc(docRef, { ...watchedMovies[movieIndex], isFavorite: newFavoriteStatus });
        } else {
          const newEvent: WatchMovieEvent = {
            id: 'wm_' + generateId(),
            userId: user.id,
            movieId,
            watchedAt: new Date().toISOString(),
            isFavorite: true,
            movieTitle: movieMetadata?.title || 'Filme',
            genres: movieMetadata?.genres || movieMetadata?.genre || []
          };
          await setDoc(docRef, newEvent);
        }
        return newFavoriteStatus;
      } catch (e) {
        console.error('Error toggling Firestore favorite movie:', e);
        // Rollback
        setWatchedMovies(watchedMovies);
        pushToast('error', 'Falha ao atualizar favorito.');
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_watch_movies_${user.id}`, newMovs);
      return newFavoriteStatus;
    }
  };

  const createList = async (name: string, description: string, type: 'show' | 'movie' | 'mixed'): Promise<boolean> => {
    if (!user) return false;

    const listId = 'l_' + generateId();
    const newList: CustomList = {
      id: listId,
      name,
      description,
      type,
      itemCount: 0
    };

    const persistListLocally = () => {
      setLists((prev) => {
        const next = [newList, ...prev.filter((l) => l.id !== listId)];
        setLocalData(`showtime_custom_lists_${user.id}`, next);
        return next;
      });
      listItemsCacheRef.current[listId] = {
        at: Date.now(),
        data: {
          list: newList,
          items: []
        }
      };
    };

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'custom_lists', listId);
        await setDoc(docRef, {
          id: listId,
          userId: user.id,
          name,
          description,
          type,
          itemCount: 0,
          createdAt: new Date().toISOString()
        });
        persistListLocally();
        listItemsCacheRef.current = {};
        lastRefreshAtRef.current = 0;
        await refreshData();
        trackEvent('list_created', { listId, type });
        pushToast('success', 'Lista criada com sucesso.');
        return true;
      } catch (e: any) {
        if (isQuotaExceededError(e)) {
          persistListLocally();
          pushToast('info', 'Cota do Firebase no limite. Lista criada localmente por enquanto.');
          return true;
        }
        console.error('Error creating custom list in Firestore:', e);
        pushToast('error', 'Não foi possível criar a lista no Firebase.');
        return false;
      }
    } else {
      // Offline fallback
      persistListLocally();
      trackEvent('list_created_offline', { listId, type });
      pushToast('success', 'Lista criada localmente.');
      return true;
    }
  };

  const deleteList = async (listId: string) => {
    if (!user) return;

    if (isFirebaseEnabled && db) {
      try {
        // Delete list document
        await deleteDoc(doc(db, 'custom_lists', listId));
        // Delete list items subcollection
        const itemsSnap = await getDocs(collection(db, 'custom_lists', listId, 'items'));
        const batch = writeBatch(db);
        itemsSnap.docs.forEach(d => {
          batch.delete(doc(db, 'custom_lists', listId, 'items', d.id));
        });
        await batch.commit();
        delete listItemsCacheRef.current[listId];
        await refreshData();
        trackEvent('list_deleted', { listId });
        pushToast('success', 'Lista removida.');
      } catch (e) {
        console.error('Error deleting list from Firestore:', e);
        pushToast('error', 'Erro ao remover lista.');
      }
    } else {
      // Offline fallback
      const customLists = getLocalData(`showtime_custom_lists_${user.id}`, []);
      const updated = customLists.filter((l: any) => l.id !== listId);
      localStorage.removeItem(`showtime_list_items_${user.id}_${listId}`);
      setLocalData(`showtime_custom_lists_${user.id}`, updated);
      setLists(updated);
      trackEvent('list_deleted_offline', { listId });
      pushToast('success', 'Lista removida localmente.');
    }
  };

  const addToList = async (listId: string, mediaType: 'show' | 'movie', mediaId: string, mediaMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    const localItemsKey = `showtime_list_items_${user.id}_${listId}`;
    const localItems = getLocalData(localItemsKey, []);
    const existsLocal = localItems.some((i: any) => i.mediaId === mediaId);
    if (existsLocal) return false;

    const localItem = {
      id: 'li_' + generateId(),
      mediaId,
      mediaType,
      details: {
        id: mediaId,
        title: mediaMetadata?.title || 'Título',
        posterPath: mediaMetadata?.posterPath || mediaMetadata?.poster_path || '',
        rating: mediaMetadata?.rating || mediaMetadata?.vote_average || 0
      }
    };

    const applyLocalAdd = () => {
      const refreshed = getLocalData(localItemsKey, []);
      if (refreshed.some((i: any) => i.mediaId === mediaId)) {
        return false;
      }

      const nextItems = [...refreshed, localItem];
      setLocalData(localItemsKey, nextItems);
      delete listItemsCacheRef.current[listId];

      setLists((prev) => {
        const next = prev.map((l) => (l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l));
        setLocalData(`showtime_custom_lists_${user.id}`, next);
        return next;
      });
      return true;
    };

    if (isFirebaseEnabled && db) {
      if (Date.now() < quotaCooldownUntilRef.current) {
        const added = applyLocalAdd();
        if (added) {
          pushToast('info', 'Item adicionado localmente enquanto o Firebase está com limite de cota.');
        }
        return added;
      }

      try {
        const itemRef = doc(db, 'custom_lists', listId, 'items', mediaId);
        // Save detailed metadata directly; document id by mediaId keeps idempotent writes.
        await setDoc(itemRef, {
          id: 'li_' + generateId(),
          mediaId,
          mediaType,
          addedAt: new Date().toISOString(),
          details: {
            id: mediaId,
            title: mediaMetadata?.title || 'Título',
            posterPath: mediaMetadata?.posterPath || mediaMetadata?.poster_path || '',
            rating: mediaMetadata?.rating || mediaMetadata?.vote_average || 0
          }
        });

        const added = applyLocalAdd();
        if (!added) return false;
        const nextCount = (lists.find((l) => l.id === listId)?.itemCount || 0) + 1;
        await setDoc(doc(db, 'custom_lists', listId), { itemCount: nextCount }, { merge: true });
        trackEvent('list_item_added', { listId, mediaType, mediaId });
        return true;
      } catch (e: any) {
        if (isQuotaExceededError(e)) {
          const cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
          quotaCooldownUntilRef.current = cooldownUntil;
          localStorage.setItem(QUOTA_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
          const added = applyLocalAdd();
          if (added) {
            pushToast('info', 'Item adicionado localmente (cota do Firebase excedida).');
            trackEvent('list_item_added_offline_quota', { listId, mediaType, mediaId });
          }
          return added;
        }

        console.error('Error adding list item to Firestore:', e);
        pushToast('error', 'Erro ao adicionar item na lista.');
        return false;
      }
    } else {
      // Offline fallback
      const added = applyLocalAdd();
      if (!added) return false;
      trackEvent('list_item_added_offline', { listId, mediaType, mediaId });
      return true;
    }
  };

  const removeFromList = async (listId: string, mediaId: string): Promise<boolean> => {
    if (!user) return false;

    if (isFirebaseEnabled && db) {
      try {
        const itemRef = doc(db, 'custom_lists', listId, 'items', mediaId);
        await deleteDoc(itemRef);

        const current = lists.find((l) => l.id === listId)?.itemCount || 0;
        const nextCount = Math.max(0, current - 1);
        await setDoc(doc(db, 'custom_lists', listId), { itemCount: nextCount }, { merge: true });
        setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, itemCount: nextCount } : l)));
        delete listItemsCacheRef.current[listId];
        trackEvent('list_item_removed', { listId, mediaId });
        return true;
      } catch (e) {
        console.error('Error removing list item from Firestore:', e);
        pushToast('error', 'Erro ao remover item da lista.');
        return false;
      }
    } else {
      // Offline fallback
      const items = getLocalData(`showtime_list_items_${user.id}_${listId}`, []);
      const filtered = items.filter((i: any) => i.mediaId !== mediaId);
      setLocalData(`showtime_list_items_${user.id}_${listId}`, filtered);
      delete listItemsCacheRef.current[listId];

      const customLists = [...lists];
      const lIndex = customLists.findIndex(l => l.id === listId);
      if (lIndex > -1) {
        customLists[lIndex].itemCount = Math.max(0, customLists[lIndex].itemCount - 1);
        setLocalData(`showtime_custom_lists_${user.id}`, customLists);
        setLists(customLists);
      }
      trackEvent('list_item_removed_offline', { listId, mediaId });
      return true;
    }
  };

  const fetchListItems = async (listId: string): Promise<any> => {
    if (!user) return null;

    const cacheEntry = listItemsCacheRef.current[listId];
    if (cacheEntry && Date.now() - cacheEntry.at < LIST_ITEMS_CACHE_TTL_MS) {
      return cacheEntry.data;
    }
    
    if (isFirebaseEnabled && db) {
      try {
        const listDoc = await getDoc(doc(db, 'custom_lists', listId));
        if (!listDoc.exists()) return null;
        
        const listData = listDoc.data();
        const snapItems = await getDocs(collection(db, 'custom_lists', listId, 'items'));
        const items = snapItems.docs.map(d => d.data());
        const payload = {
          list: {
            id: listId,
            name: listData.name,
            description: listData.description,
            type: listData.type
          },
          items
        };
        listItemsCacheRef.current[listId] = { at: Date.now(), data: payload };
        return payload;
      } catch (e) {
        console.error('Error fetching list items from Firestore:', e);
        return null;
      }
    } else {
      // Offline fallback
      const customLists = getLocalData(`showtime_custom_lists_${user.id}`, []);
      const list = customLists.find((l: any) => l.id === listId);
      if (!list) return null;
      
      const items = getLocalData(`showtime_list_items_${user.id}_${listId}`, []);
      const payload = {
        list,
        items
      };
      listItemsCacheRef.current[listId] = { at: Date.now(), data: payload };
      return payload;
    }
  };

  const toggleFollowShow = async (showId: string, showMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    const isFollowed = followedShows.includes(showId);

    // Optimistic Update
    let newFollows = [...followedShows];
    if (isFollowed) {
      newFollows = newFollows.filter(id => id !== showId);
    } else {
      newFollows.push(showId);
    }
    setFollowedShows(newFollows);

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'followed_shows', `${user.id}_${showId}`);
        if (isFollowed) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, {
            id: 'fs_' + generateId(),
            userId: user.id,
            showId,
            followedAt: new Date().toISOString(),
            showTitle: showMetadata?.title || 'Série',
            posterPath: showMetadata?.posterPath || showMetadata?.poster_path || ''
          });
        }
        trackEvent('show_follow_toggled', { showId, followed: !isFollowed });
        return !isFollowed;
      } catch (e: any) {
        console.error('Error toggling follow show in Firestore:', e);
        // Rollback
        setFollowedShows(followedShows);
        pushToast('error', 'Erro ao seguir série.');
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_followed_shows_${user.id}`, newFollows);
      trackEvent('show_follow_toggled_offline', { showId, followed: !isFollowed });
      return !isFollowed;
    }
  };

  const watchAllEpisodesOfShow = async (showMetadata: any): Promise<void> => {
    if (!user) return;
    setLoading(true);

    try {
      const episodesToMark: any[] = [];
      const seasons = showMetadata.seasons || [];

      for (const season of seasons) {
        if (season.seasonNumber > 0) {
          const episodes = await fetchSeasonEpisodes(showMetadata.id, season.seasonNumber);
          episodes.forEach((ep: any) => {
            if (!isEpisodeReleased(ep.airDate)) return;
            episodesToMark.push({
              episodeNumber: ep.episodeNumber,
              title: ep.title,
              seasonNumber: season.seasonNumber
            });
          });
        }
      }

      if (episodesToMark.length === 0) {
        setLoading(false);
        return;
      }

      if (isFirebaseEnabled && db) {
        const batch = writeBatch(db);
        episodesToMark.forEach(ep => {
          const epId = `ep_${showMetadata.id}_${ep.seasonNumber}_${ep.episodeNumber}`;
          const docRef = doc(db, 'watch_episodes', `${user.id}_${epId}`);
          const newEvent: WatchEpisodeEvent = {
            id: 'we_' + generateId(),
            userId: user.id,
            showId: showMetadata.id,
            episodeId: epId,
            watchedAt: new Date().toISOString(),
            genres: showMetadata.genres || showMetadata.genre || [],
            showTitle: showMetadata.title,
            episodeTitle: ep.title
          };
          batch.set(docRef, newEvent);
        });
        await batch.commit();
        await refreshData();
        trackEvent('show_mark_all_watched', { showId: showMetadata.id, totalEpisodes: episodesToMark.length });
        pushToast('success', `${episodesToMark.length} episódios marcados como assistidos.`);
      } else {
        const eps = [...watchedEpisodes];
        episodesToMark.forEach(ep => {
          const epId = `ep_${showMetadata.id}_${ep.seasonNumber}_${ep.episodeNumber}`;
          if (!eps.some(we => we.episodeId === epId)) {
            eps.push({
              id: 'we_' + generateId(),
              userId: user.id,
              showId: showMetadata.id,
              episodeId: epId,
              watchedAt: new Date().toISOString(),
              genres: showMetadata.genres || showMetadata.genre || [],
              showTitle: showMetadata.title,
              episodeTitle: ep.title
            });
          }
        });
        setLocalData(`showtime_watch_episodes_${user.id}`, eps);
        setWatchedEpisodes(eps);
        calculateGenreStats(eps, watchedMovies);
        calculateEngagementStats(eps, watchedMovies);
        trackEvent('show_mark_all_watched_offline', { showId: showMetadata.id, totalEpisodes: episodesToMark.length });
        pushToast('success', `${episodesToMark.length} episódios marcados no modo local.`);
      }
    } catch (e: any) {
      console.error('Error marking all episodes as watched:', e);
      pushToast('error', 'Erro ao marcar episódios como assistidos.');
    } finally {
      setLoading(false);
    }
  };

  const importTvTimeData = async (episodes: any[], movies: any[]): Promise<{ importedEpisodes: number; importedMovies: number }> => {
    if (!user) return { importedEpisodes: 0, importedMovies: 0 };
    setLoading(true);

    let epCount = 0;
    let movCount = 0;
    const uniqueShowsToFollow = new Set<string>();

    if (isFirebaseEnabled && db) {
      try {
        const batch = writeBatch(db);

        episodes.forEach(item => {
          const showIdStr = item.tmdbId ? item.tmdbId.toString() : `s_${generateId()}`;
          if (item.tmdbId) uniqueShowsToFollow.add(item.tmdbId.toString());
          
          const epId = `ep_${showIdStr}_${item.seasonNumber}_${item.episodeNumber}`;
          const docRef = doc(db, 'watch_episodes', `${user.id}_${epId}`);
          batch.set(docRef, {
            id: 'we_' + generateId(),
            userId: user.id,
            showId: showIdStr,
            episodeId: epId,
            watchedAt: item.watchedAt || new Date().toISOString(),
            showTitle: item.title,
            episodeTitle: `Episódio ${item.episodeNumber}`,
            genres: [] // Imported might lack genres initial information
          });
          epCount++;
        });

        movies.forEach(item => {
          const movieId = item.tmdbId ? `m_${item.tmdbId}` : `m_${generateId()}`;
          const docRef = doc(db, 'watch_movies', `${user.id}_${movieId}`);
          batch.set(docRef, {
            id: 'wm_' + generateId(),
            userId: user.id,
            movieId: movieId,
            watchedAt: item.watchedAt || new Date().toISOString(),
            isFavorite: false,
            movieTitle: item.title,
            genres: []
          });
          movCount++;
        });

        // Also follow unique shows
        uniqueShowsToFollow.forEach(showId => {
          if (!followedShows.includes(showId)) {
            const followRef = doc(db, 'followed_shows', `${user.id}_${showId}`);
            batch.set(followRef, {
              userId: user.id,
              showId: showId,
              followedAt: new Date().toISOString()
            });
          }
        });

        await batch.commit();
        await refreshData();
        trackEvent('bulk_import_completed', { importedEpisodes: epCount, importedMovies: movCount, mode: 'firebase' });
        pushToast('success', 'Importação concluída com sucesso.');
      } catch (e) {
        console.error('Error importing data to Firestore:', e);
        pushToast('error', 'Erro ao importar dados para Firebase.');
      } finally {
        setLoading(false);
      }
    } else {
      // Offline fallback
      const eps = getLocalData(`showtime_watch_episodes_${user.id}`, []);
      const movs = getLocalData(`showtime_watch_movies_${user.id}`, []);

      episodes.forEach(item => {
        const showIdStr = item.tmdbId ? item.tmdbId.toString() : `s_${generateId()}`;
        if (item.tmdbId) uniqueShowsToFollow.add(item.tmdbId.toString());
        
        const epId = `ep_${showIdStr}_${item.seasonNumber}_${item.episodeNumber}`;
        eps.push({
          id: 'we_' + generateId(),
          userId: user.id,
          showId: showIdStr,
          episodeId: epId,
          watchedAt: item.watchedAt || new Date().toISOString(),
          showTitle: item.title,
          episodeTitle: `Episódio ${item.episodeNumber}`,
          genres: []
        });
        epCount++;
      });

      movies.forEach(item => {
        const movieId = item.tmdbId ? `m_${item.tmdbId}` : `m_${generateId()}`;
        movs.push({
          id: 'wm_' + generateId(),
          userId: user.id,
          movieId: movieId,
          watchedAt: item.watchedAt || new Date().toISOString(),
          isFavorite: false,
          movieTitle: item.title,
          genres: []
        });
        movCount++;
      });

      const follows = getLocalData(`showtime_followed_shows_${user.id}`, []);
      uniqueShowsToFollow.forEach(showId => {
        if (!follows.includes(showId)) {
          follows.push(showId);
        }
      });
      setLocalData(`showtime_followed_shows_${user.id}`, follows);
      setFollowedShows(follows);

      setLocalData(`showtime_watch_episodes_${user.id}`, eps);
      setLocalData(`showtime_watch_movies_${user.id}`, movs);
      setWatchedEpisodes(eps);
      setWatchedMovies(movs);
      calculateGenreStats(eps, movs);
      calculateEngagementStats(eps, movs);
      trackEvent('bulk_import_completed', { importedEpisodes: epCount, importedMovies: movCount, mode: 'offline' });
      pushToast('success', 'Importação local concluída.');
      setLoading(false);
    }

    return { importedEpisodes: epCount, importedMovies: movCount };
  };

  const toggleFollowUser = async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;

    const isFollowed = followedUsers.includes(targetUserId);
    const newFollows = isFollowed
      ? followedUsers.filter(id => id !== targetUserId)
      : [...followedUsers, targetUserId];
    setFollowedUsers(newFollows);

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'profile_follows', `${user.id}_${targetUserId}`);
        if (isFollowed) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, {
            followerId: user.id,
            followedId: targetUserId,
            followedAt: new Date().toISOString()
          });
        }
        trackEvent('user_follow_toggled', { targetUserId, followed: !isFollowed });
        return !isFollowed;
      } catch (e) {
        console.error('Error toggling user follow in Firestore:', e);
        setFollowedUsers(followedUsers);
        pushToast('error', 'Erro ao seguir usuário.');
        return false;
      }
    } else {
      setLocalData(`showtime_followed_users_${user.id}`, newFollows);
      trackEvent('user_follow_toggled_offline', { targetUserId, followed: !isFollowed });
      return !isFollowed;
    }
  };

  return (
    <TrackingContext.Provider value={{
      watchedEpisodes,
      watchedMovies,
      lists,
      followedShows,
      followedUsers,
      genreCounts,
      totalGenresCount,
      favoriteGenres,
      streakDays,
      lastWatchedAt,
      totalWatchEvents,
      loading,
      refreshData,
      toggleWatchEpisode,
      toggleWatchMovie,
      toggleFavoriteMovie,
      createList,
      deleteList,
      addToList,
      removeFromList,
      fetchListItems,
      toggleFollowShow,
      toggleFollowUser,
      watchAllEpisodesOfShow,
      importTvTimeData,
      watchAllEpisodesOfSeason
    }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
};
