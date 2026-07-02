import React, { createContext, useState, useContext, useEffect } from 'react';
import { backendApi } from '../services/api.js';
import { useAuth } from './AuthContext.js';

export interface WatchEpisodeEvent {
  id: string;
  userId: string;
  showId: string;
  episodeId: string;
  watchedAt: string;
}

export interface WatchMovieEvent {
  id: string;
  userId: string;
  movieId: string;
  watchedAt: string;
  isFavorite: boolean;
  movieTitle?: string;
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
  importTvTimeData: (episodes: any[], movies: any[]) => Promise<{ importedEpisodes: number; importedMovies: number }>;
  watchAllEpisodesOfSeason: (showMetadata: any, episodes: any[], seasonNumber: number) => Promise<void>;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchEpisodeEvent[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<WatchMovieEvent[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>({});
  const [totalGenresCount, setTotalGenresCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const historyRes = await backendApi.get('/api/watch/history');
      setWatchedEpisodes(historyRes.data.episodes || []);
      setWatchedMovies(historyRes.data.movies || []);
      setGenreCounts(historyRes.data.genreCounts || {});
      setTotalGenresCount(historyRes.data.totalGenresCount || 0);

      const listsRes = await backendApi.get('/api/lists');
      setLists(listsRes.data || []);
    } catch (e) {
      console.error('Error refreshing tracking history', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshData();
    } else {
      setWatchedEpisodes([]);
      setWatchedMovies([]);
      setGenreCounts({});
      setTotalGenresCount(0);
      setLists([]);
    }
  }, [token]);

  const toggleWatchEpisode = async (episodeId: string, showMetadata?: any, episodeMetadata?: any): Promise<boolean> => {
    try {
      const res = await backendApi.post(`/api/watched_episodes/episode/${episodeId}`, {
        show: showMetadata,
        episode: episodeMetadata
      });
      await refreshData();
      return res.data.watched;
    } catch (e) {
      console.error('Error toggling watch episode', e);
      return false;
    }
  };

  const watchAllEpisodesOfSeason = async (showMetadata: any, episodes: any[], seasonNumber: number): Promise<void> => {
    try {
      // Find all episodes of the season that are NOT watched yet
      const unwatchedEpisodes = episodes.filter(ep => {
        const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
        return !watchedEpisodes.some(we => we.episodeId === epId);
      });

      if (unwatchedEpisodes.length === 0) return;

      setLoading(true);
      // Fire parallel requests
      await Promise.all(
        unwatchedEpisodes.map(ep => {
          const epId = `ep_${showMetadata.id}_${seasonNumber}_${ep.episodeNumber}`;
          return backendApi.post(`/api/watched_episodes/episode/${epId}`, {
            show: showMetadata,
            episode: ep
          });
        })
      );
      
      await refreshData();
    } catch (e) {
      console.error('Error marking all episodes of season as watched', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleWatchMovie = async (movieId: string, movieMetadata?: any): Promise<boolean> => {
    try {
      const res = await backendApi.post(`/api/watch_movies/movie/${movieId}`, {
        movie: movieMetadata,
        action: 'watch'
      });
      await refreshData();
      return res.data.watched;
    } catch (e) {
      console.error('Error toggling watch movie', e);
      return false;
    }
  };

  const toggleFavoriteMovie = async (movieId: string, movieMetadata?: any): Promise<boolean> => {
    try {
      const res = await backendApi.post(`/api/watch_movies/movie/${movieId}`, {
        movie: movieMetadata,
        action: 'favorite'
      });
      await refreshData();
      return res.data.isFavorite;
    } catch (e) {
      console.error('Error toggling favorite movie', e);
      return false;
    }
  };

  const createList = async (name: string, description: string, type: 'show' | 'movie' | 'mixed') => {
    try {
      await backendApi.post('/api/lists', { name, description, type });
      await refreshData();
    } catch (e) {
      console.error('Error creating list', e);
    }
  };

  const deleteList = async (listId: string) => {
    try {
      await backendApi.delete(`/api/lists/${listId}`);
      await refreshData();
    } catch (e) {
      console.error('Error deleting list', e);
    }
  };

  const addToList = async (listId: string, mediaType: 'show' | 'movie', mediaId: string, mediaMetadata?: any): Promise<boolean> => {
    try {
      await backendApi.post(`/api/lists/${listId}/items`, {
        mediaType,
        mediaId,
        mediaMetadata
      });
      await refreshData();
      return true;
    } catch (e) {
      console.error('Error adding to list', e);
      return false;
    }
  };

  const removeFromList = async (listId: string, mediaId: string): Promise<boolean> => {
    try {
      await backendApi.delete(`/api/lists/${listId}/items/${mediaId}`);
      await refreshData();
      return true;
    } catch (e) {
      console.error('Error removing from list', e);
      return false;
    }
  };

  const importTvTimeData = async (episodes: any[], movies: any[]): Promise<{ importedEpisodes: number; importedMovies: number }> => {
    try {
      const res = await backendApi.post('/api/watch/sync-import', { episodes, movies });
      await refreshData();
      return {
        importedEpisodes: res.data.importedEpisodes || 0,
        importedMovies: res.data.importedMovies || 0
      };
    } catch (e) {
      console.error('Error importing GDPR TV Time data', e);
      return { importedEpisodes: 0, importedMovies: 0 };
    }
  };

  return (
    <TrackingContext.Provider value={{
      watchedEpisodes,
      watchedMovies,
      lists,
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
