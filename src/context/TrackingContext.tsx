import React, { createContext, useState, useContext, useEffect } from 'react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { useAuth } from './AuthContext.js';
import { fetchSeasonEpisodes } from '../services/api.js';
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
  refreshData: () => Promise<void>;
  toggleWatchEpisode: (episodeId: string, showMetadata?: any, episodeMetadata?: any) => Promise<boolean>;
  toggleWatchMovie: (movieId: string, movieMetadata?: any) => Promise<boolean>;
  toggleFavoriteMovie: (movieId: string, movieMetadata?: any) => Promise<boolean>;
  createList: (name: string, description: string, type: 'show' | 'movie' | 'mixed') => Promise<void>;
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

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchEpisodeEvent[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<WatchMovieEvent[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [followedShows, setFollowedShows] = useState<string[]>([]);
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>({});
  const [totalGenresCount, setTotalGenresCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

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

  const refreshData = async () => {
    if (!user) return;
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

        // 3. Fetch custom lists
        const qLists = query(collection(db, 'custom_lists'), where('userId', '==', user.id));
        const snapLists = await getDocs(qLists);
        const loadedLists = await Promise.all(snapLists.docs.map(async d => {
          const listData = d.data();
          const snapItems = await getDocs(collection(db, 'custom_lists', d.id, 'items'));
          return {
            id: d.id,
            name: listData.name,
            description: listData.description || '',
            type: listData.type || 'mixed',
            itemCount: snapItems.size
          } as CustomList;
        }));
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
      } catch (e) {
        console.error('Error fetching Firestore tracking data:', e);
      } finally {
        setLoading(false);
      }
    } else {
      // Offline fallback
      const eps = getLocalData(`showtime_watch_episodes_${user.id}`, []);
      const movs = getLocalData(`showtime_watch_movies_${user.id}`, []);
      const customLists = getLocalData(`showtime_custom_lists_${user.id}`, []);
      const follows = getLocalData(`showtime_followed_shows_${user.id}`, []);
      const followsUsers = getLocalData(`showtime_followed_users_${user.id}`, []);
      setWatchedEpisodes(eps);
      setWatchedMovies(movs);
      setLists(customLists);
      setFollowedShows(follows);
      setFollowedUsers(followsUsers);
      calculateGenreStats(eps, movs);
      setLoading(false);
    }
  };

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unwatchedEpisodes = episodes.filter(ep => {
      const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
      const alreadyWatched = watchedEpisodes.some(we => we.episodeId === epId);
      if (alreadyWatched) return false;
      // Skip episodes that haven't aired yet
      if (ep.airDate) {
        const airDate = new Date(ep.airDate);
        if (airDate > today) return false;
      }
      return true;
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
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_watch_movies_${user.id}`, newMovs);
      return newFavoriteStatus;
    }
  };

  const createList = async (name: string, description: string, type: 'show' | 'movie' | 'mixed') => {
    if (!user) return;

    const listId = 'l_' + generateId();

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'custom_lists', listId);
        await setDoc(docRef, {
          id: listId,
          userId: user.id,
          name,
          description,
          type,
          createdAt: new Date().toISOString()
        });
        await refreshData();
      } catch (e: any) {
        console.error('Error creating custom list in Firestore:', e);
        alert(`Erro ao criar a lista no Firebase!\nCódigo do erro: ${e.code || e.message}\n\nIsso geralmente acontece porque as Regras de Segurança (Security Rules) do seu Firestore Database no Console do Firebase estão configuradas no modo bloqueado por padrão.\n\nPara corrigir:\n1. Vá no Console do Firebase -> Firestore Database -> aba "Rules" (Regras).\n2. Altere a regra principal para permitir leitura e escrita, por exemplo:\n   allow read, write: if request.auth != null;\n3. Clique em "Publicar" (Publish).`);
      }
    } else {
      // Offline fallback
      const customLists = getLocalData(`showtime_custom_lists_${user.id}`, []);
      customLists.push({
        id: listId,
        name,
        description,
        type,
        itemCount: 0
      });
      setLocalData(`showtime_custom_lists_${user.id}`, customLists);
      setLists(customLists);
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
        await refreshData();
      } catch (e) {
        console.error('Error deleting list from Firestore:', e);
      }
    } else {
      // Offline fallback
      const customLists = getLocalData(`showtime_custom_lists_${user.id}`, []);
      const updated = customLists.filter((l: any) => l.id !== listId);
      localStorage.removeItem(`showtime_list_items_${user.id}_${listId}`);
      setLocalData(`showtime_custom_lists_${user.id}`, updated);
      setLists(updated);
    }
  };

  const addToList = async (listId: string, mediaType: 'show' | 'movie', mediaId: string, mediaMetadata?: any): Promise<boolean> => {
    if (!user) return false;

    if (isFirebaseEnabled && db) {
      try {
        const itemRef = doc(db, 'custom_lists', listId, 'items', mediaId);
        // Check if item already exists in subcollection
        const docSnap = await getDoc(itemRef);
        if (docSnap.exists()) return false;

        // Save detailed metadata directly inside the document so lists load extremely fast without backend queries!
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
        await refreshData();
        return true;
      } catch (e) {
        console.error('Error adding list item to Firestore:', e);
        return false;
      }
    } else {
      // Offline fallback
      const items = getLocalData(`showtime_list_items_${user.id}_${listId}`, []);
      const exists = items.some((i: any) => i.mediaId === mediaId);
      if (exists) return false;

      items.push({
        id: 'li_' + generateId(),
        mediaId,
        mediaType,
        details: {
          id: mediaId,
          title: mediaMetadata?.title || 'Título',
          posterPath: mediaMetadata?.posterPath || mediaMetadata?.poster_path || '',
          rating: mediaMetadata?.rating || mediaMetadata?.vote_average || 0
        }
      });
      setLocalData(`showtime_list_items_${user.id}_${listId}`, items);

      // Update itemCount in lists state
      const customLists = [...lists];
      const lIndex = customLists.findIndex(l => l.id === listId);
      if (lIndex > -1) {
        customLists[lIndex].itemCount += 1;
        setLocalData(`showtime_custom_lists_${user.id}`, customLists);
        setLists(customLists);
      }
      return true;
    }
  };

  const removeFromList = async (listId: string, mediaId: string): Promise<boolean> => {
    if (!user) return false;

    if (isFirebaseEnabled && db) {
      try {
        const itemRef = doc(db, 'custom_lists', listId, 'items', mediaId);
        await deleteDoc(itemRef);
        await refreshData();
        return true;
      } catch (e) {
        console.error('Error removing list item from Firestore:', e);
        return false;
      }
    } else {
      // Offline fallback
      const items = getLocalData(`showtime_list_items_${user.id}_${listId}`, []);
      const filtered = items.filter((i: any) => i.mediaId !== mediaId);
      setLocalData(`showtime_list_items_${user.id}_${listId}`, filtered);

      const customLists = [...lists];
      const lIndex = customLists.findIndex(l => l.id === listId);
      if (lIndex > -1) {
        customLists[lIndex].itemCount = Math.max(0, customLists[lIndex].itemCount - 1);
        setLocalData(`showtime_custom_lists_${user.id}`, customLists);
        setLists(customLists);
      }
      return true;
    }
  };

  const fetchListItems = async (listId: string): Promise<any> => {
    if (!user) return null;
    
    if (isFirebaseEnabled && db) {
      try {
        const listDoc = await getDoc(doc(db, 'custom_lists', listId));
        if (!listDoc.exists()) return null;
        
        const listData = listDoc.data();
        const snapItems = await getDocs(collection(db, 'custom_lists', listId, 'items'));
        const items = snapItems.docs.map(d => d.data());
        return {
          list: {
            id: listId,
            name: listData.name,
            description: listData.description,
            type: listData.type
          },
          items
        };
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
      return {
        list,
        items
      };
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
        return !isFollowed;
      } catch (e: any) {
        console.error('Error toggling follow show in Firestore:', e);
        // Rollback
        setFollowedShows(followedShows);
        alert('Erro ao seguir série. Verifique se o Firestore está configurado corretamente.');
        return false;
      }
    } else {
      // Offline fallback
      setLocalData(`showtime_followed_shows_${user.id}`, newFollows);
      return !isFollowed;
    }
  };

  const watchAllEpisodesOfShow = async (showMetadata: any): Promise<void> => {
    if (!user) return;
    setLoading(true);

    try {
      const episodesToMark: any[] = [];
      const seasons = showMetadata.seasons || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const season of seasons) {
        if (season.seasonNumber > 0) {
          const episodes = await fetchSeasonEpisodes(showMetadata.id, season.seasonNumber);
          episodes.forEach((ep: any) => {
            // Skip future episodes
            if (ep.airDate) {
              const airDate = new Date(ep.airDate);
              if (airDate > today) return;
            }
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
      }
    } catch (e: any) {
      console.error('Error marking all episodes as watched:', e);
      alert('Erro ao marcar todos os episódios como assistidos. Verifique se o Firestore está configurado corretamente.');
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
      } catch (e) {
        console.error('Error importing data to Firestore:', e);
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
        return !isFollowed;
      } catch (e) {
        console.error('Error toggling user follow in Firestore:', e);
        setFollowedUsers(followedUsers);
        return false;
      }
    } else {
      setLocalData(`showtime_followed_users_${user.id}`, newFollows);
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
