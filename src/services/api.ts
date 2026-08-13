import axios from 'axios';

const TMDB_KEY_KEY = 'epsync_tmdb_key';
const LEGACY_TMDB_KEY = 'showtime_tmdb_key';

// TMDB API Client configuration
const getTmdbKey = () => localStorage.getItem(TMDB_KEY_KEY) || localStorage.getItem(LEGACY_TMDB_KEY) || import.meta.env.VITE_TMDB_API_KEY || '';

export const setTmdbKey = (key: string) => {
  if (key) {
    localStorage.setItem(TMDB_KEY_KEY, key);
  } else {
    localStorage.removeItem(TMDB_KEY_KEY);
    localStorage.removeItem(LEGACY_TMDB_KEY);
  }
};

export const hasRealTmdbKey = () => !!getTmdbKey();

// Helper to construct TMDB image URLs
export const getImageUrl = (path: string | null, size: 'w200' | 'w500' | 'original' = 'w500') => {
  if (!path) return 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// Complete TMDB Genre IDs to Portuguese Genre Names Map
export const TMDB_GENRE_MAP: Record<number, string> = {
  // Movies & Shared
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção científica',
  10770: 'Cinema TV',
  53: 'Thriller',
  10752: 'Guerra',
  37: 'Faroeste',
  // TV Exclusive
  10759: 'Ação & Aventura',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasia',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics'
};

export const mapGenres = (genreIds?: number[]): string[] => {
  if (!genreIds || !Array.isArray(genreIds)) return [];
  return genreIds.map(id => TMDB_GENRE_MAP[id]).filter(Boolean);
};

// Rich default mock dataset for offline and fallback
const MOCK_SHOWS = [
  {
    id: 's1',
    tmdbId: 1396,
    title: 'Breaking Bad',
    overview: 'Walter White, um professor de química do ensino médio, descobre que tem câncer e decide produzir e vender metanfetamina com um ex-aluno para garantir o sustento de sua família.',
    posterPath: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdropPath: '/9fa5tmg53Pd94V9xp78gU6zPPi7.jpg',
    firstAirDate: '2008-01-20',
    genres: ['Drama', 'Crime'],
    mediaType: 'show',
    rating: 9.3,
    status: 'Ended'
  },
  {
    id: 's2',
    tmdbId: 66732,
    title: 'Stranger Things',
    overview: 'Quando um jovem garoto desaparece, uma pequena cidade descobre um mistério envolvendo experimentos secretos, forças sobrenaturais aterrorizantes e uma garota estranha.',
    posterPath: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdropPath: '/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    firstAirDate: '2016-07-15',
    genres: ['Sci-Fi & Fantasia', 'Drama', 'Mistério'],
    mediaType: 'show',
    rating: 8.6,
    status: 'Returning Series'
  },
  {
    id: 's3',
    tmdbId: 100088,
    title: 'The Last of Us',
    overview: 'Vinte anos após uma praga quase extinguir a civilização, Joel é contratado para contrabandear Ellie, uma jovem de 14 anos que pode ser a cura para a humanidade.',
    posterPath: '/uKvVjHNqB5VmOrdxqAt2V7JMrne.jpg',
    backdropPath: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    firstAirDate: '2023-01-15',
    genres: ['Drama', 'Sci-Fi & Fantasia', 'Ação & Aventura'],
    mediaType: 'show',
    rating: 8.6,
    status: 'Returning Series'
  },
  {
    id: 's4',
    tmdbId: 94605,
    title: 'Arcane',
    overview: 'Em meio ao conflito entre as cidades-gêmeas de Piltover e Zaun, duas irmãs lutam em lados opostos de uma guerra entre tecnologias mágicas e convicções incompatíveis.',
    posterPath: '/abf8GmxDES0v035417u7B4136m8.jpg',
    backdropPath: '/fqldfq2t069gg19fXFFf334.jpg',
    firstAirDate: '2021-11-06',
    genres: ['Animação', 'Sci-Fi & Fantasia', 'Ação & Aventura'],
    mediaType: 'show',
    rating: 8.7,
    status: 'Ended'
  },
  {
    id: 's5',
    tmdbId: 85937,
    title: 'Demon Slayer: Kimetsu no Yaiba',
    overview: 'Tanjiro Kamado, um jovem bondoso que vende carvão para viver, encontra sua família massacrada por um demônio. Para vingar sua família e curar sua irmã, ele se torna um caçador de demônios.',
    posterPath: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
    backdropPath: '/nTvM4mhqZlHIkwPtcvjq2L2R64.jpg',
    firstAirDate: '2019-04-06',
    genres: ['Animação', 'Ação & Aventura', 'Sci-Fi & Fantasia'],
    originalLanguage: 'ja',
    mediaType: 'show',
    rating: 8.7,
    status: 'Returning Series'
  },
  {
    id: 's6',
    tmdbId: 95479,
    title: 'Jujutsu Kaisen',
    overview: 'Yuji Itadori engole um dedo amaldiçoado para salvar seus amigos e agora divide seu corpo com Ryomen Sukuna, o Rei das Maldições.',
    posterPath: '/hFWP5wuoq9pHtW099c2G7Z103m5.jpg',
    backdropPath: '/gmECX19qVq766b1XhX8mC0.jpg',
    firstAirDate: '2020-10-03',
    genres: ['Animação', 'Ação & Aventura', 'Sci-Fi & Fantasia'],
    originalLanguage: 'ja',
    mediaType: 'show',
    rating: 8.6,
    status: 'Returning Series'
  },
  {
    id: 's7',
    tmdbId: 1429,
    title: 'Attack on Titan',
    overview: 'A humanidade vive dentro de muralhas gigantescas para se proteger de titãs devoradores de homens. Eren Jaeger jura eliminar todos após a queda de sua cidade natal.',
    posterPath: '/h8Rb9gBr48ODigDrng12g17q35T.jpg',
    backdropPath: '/d5N05Z1kHnCjU8O5669L2D09y8Z.jpg',
    firstAirDate: '2013-04-07',
    genres: ['Animação', 'Ação & Aventura', 'Sci-Fi & Fantasia'],
    originalLanguage: 'ja',
    mediaType: 'show',
    rating: 8.9,
    status: 'Ended'
  },
  {
    id: 's8',
    tmdbId: 1399,
    title: 'Game of Thrones',
    overview: 'Várias famílias nobres travam uma guerra mortal pelo controle do Trono de Ferro dos Sete Reinos de Westeros enquanto uma antiga ameaça ressurge no Norte.',
    posterPath: '/1XS1oqLmx6o7LI4DQn0G1a2rlil.jpg',
    backdropPath: '/2OMB0nv2TxiKVq7i5O7iEvJ4eXt.jpg',
    firstAirDate: '2011-04-17',
    genres: ['Sci-Fi & Fantasia', 'Drama', 'Ação & Aventura'],
    mediaType: 'show',
    rating: 8.4,
    status: 'Ended'
  }
];

const MOCK_MOVIES = [
  {
    id: 'm1',
    tmdbId: 157336,
    title: 'Interstellar',
    overview: 'As reservas naturais da Terra estão se esgotando e um grupo de astronautas recebe a missão de verificar possíveis planetas habitáveis para receber a população mundial.',
    posterPath: '/gEU2QvHwZJ7fvvevkgjHGnAsjYd.jpg',
    backdropPath: '/rAiw0Av5nH7ee5u84gL46hNu869.jpg',
    releaseDate: '2014-11-05',
    genres: ['Ficção científica', 'Drama', 'Aventura'],
    mediaType: 'movie',
    rating: 8.4,
    duration: 169
  },
  {
    id: 'm2',
    tmdbId: 872585,
    title: 'Oppenheimer',
    overview: 'A história do físico americano J. Robert Oppenheimer, seu papel no Projeto Manhattan e o desenvolvimento da bomba atômica durante a Segunda Guerra Mundial.',
    posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropPath: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    releaseDate: '2023-07-19',
    genres: ['Drama', 'História'],
    mediaType: 'movie',
    rating: 8.1,
    duration: 180
  },
  {
    id: 'm3',
    tmdbId: 693134,
    title: 'Duna: Parte 2',
    overview: 'Paul Atreides se une a Chani e aos Fremen em busca de vingança contra os conspiradores que destruíram sua família, diante de uma escolha entre o amor de sua vida e o destino do universo.',
    posterPath: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
    backdropPath: '/xOMo8BRK7PfcJv9JCnx7s5200fr.jpg',
    releaseDate: '2024-02-27',
    genres: ['Ficção científica', 'Aventura'],
    mediaType: 'movie',
    rating: 8.2,
    duration: 166
  },
  {
    id: 'm4',
    tmdbId: 27205,
    title: 'A Origem (Inception)',
    overview: 'Dom Cobb é um ladrão experiente que invade os sonhos das pessoas para roubar segredos corporativos e agora recebe uma chance de redenção através da inserção de uma ideia.',
    posterPath: '/9gk7adHYeHCwb0mfsEStm0gziFC.jpg',
    backdropPath: '/s3TBrRGB1q7jWjLflmgQQYgWESY.jpg',
    releaseDate: '2010-07-15',
    genres: ['Ação', 'Ficção científica', 'Aventura'],
    mediaType: 'movie',
    rating: 8.4,
    duration: 148
  }
];

// Fetch Trending / Popular Catalog from TMDB (Trending + Series + Movies + Anime)
export const fetchTrendingCatalog = async (): Promise<any[]> => {
  const key = getTmdbKey();
  if (key) {
    try {
      const [trendRes, tvRes, movRes, animeRes] = await Promise.allSettled([
        axios.get(`https://api.themoviedb.org/3/trending/all/week`, {
          params: { api_key: key, language: 'pt-BR' }
        }),
        axios.get(`https://api.themoviedb.org/3/discover/tv`, {
          params: { api_key: key, language: 'pt-BR', sort_by: 'popularity.desc', page: 1 }
        }),
        axios.get(`https://api.themoviedb.org/3/discover/movie`, {
          params: { api_key: key, language: 'pt-BR', sort_by: 'popularity.desc', page: 1 }
        }),
        axios.get(`https://api.themoviedb.org/3/discover/tv`, {
          params: { api_key: key, language: 'pt-BR', sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', page: 1 }
        })
      ]);

      const items: any[] = [];
      const seenIds = new Set<string>();

      const processResults = (res: any, defaultType?: 'show' | 'movie', isAnimeGroup = false) => {
        if (res.status === 'fulfilled' && res.value?.data?.results) {
          res.value.data.results.forEach((item: any) => {
            const mediaType = item.media_type === 'movie' || defaultType === 'movie' ? 'movie' : 'show';
            const id = mediaType === 'show' ? `s_${item.id}` : `m_${item.id}`;
            if (!seenIds.has(id) && (item.poster_path || item.backdrop_path)) {
              seenIds.add(id);
              const mappedGenres = mapGenres(item.genre_ids);
              if (isAnimeGroup && !mappedGenres.includes('Animação')) {
                mappedGenres.push('Animação');
              }
              items.push({
                id,
                tmdbId: item.id,
                title: item.title || item.name || item.original_name || 'Sem título',
                overview: item.overview || '',
                posterPath: item.poster_path,
                backdropPath: item.backdrop_path,
                releaseDate: item.release_date || item.first_air_date,
                firstAirDate: item.first_air_date,
                genres: mappedGenres,
                originalLanguage: item.original_language,
                mediaType,
                rating: item.vote_average || 0
              });
            }
          });
        }
      };

      processResults(trendRes);
      processResults(tvRes, 'show');
      processResults(movRes, 'movie');
      processResults(animeRes, 'show', true);

      if (items.length > 0) {
        return items;
      }
    } catch (e) {
      console.warn('Error fetching TMDB catalog, using fallback:', e);
    }
  }

  return [...MOCK_SHOWS, ...MOCK_MOVIES];
};

// Fetch User-Personalized Recommendations from TMDB based on followed and watched shows
export const fetchPersonalizedRecommendations = async (
  followedIds: string[] = [],
  preferredGenres: string[] = []
): Promise<{
  personalized: any[];
  trending: any[];
  series: any[];
  movies: any[];
  animes: any[];
}> => {
  const key = getTmdbKey();
  const catalog = await fetchTrendingCatalog();

  const userRecs: any[] = [];
  const seenIds = new Set<string>();

  if (key && followedIds.length > 0) {
    const rawIds = followedIds
      .map(id => id.replace(/^[sm]_/, ''))
      .filter(id => !isNaN(parseInt(id)))
      .slice(0, 4);

    for (const rawId of rawIds) {
      try {
        const res = await axios.get(`https://api.themoviedb.org/3/tv/${rawId}/recommendations`, {
          params: { api_key: key, language: 'pt-BR' }
        });
        if (res.data?.results) {
          res.data.results.slice(0, 6).forEach((item: any) => {
            const id = `s_${item.id}`;
            if (!seenIds.has(id) && (item.poster_path || item.backdrop_path)) {
              seenIds.add(id);
              userRecs.push({
                id,
                tmdbId: item.id,
                title: item.title || item.name,
                overview: item.overview || '',
                posterPath: item.poster_path,
                backdropPath: item.backdrop_path,
                firstAirDate: item.first_air_date,
                genres: mapGenres(item.genre_ids),
                originalLanguage: item.original_language,
                mediaType: 'show',
                rating: item.vote_average || 0
              });
            }
          });
        }
      } catch (_) {}
    }
  }

  // Rank the general catalog based on preferred genres
  const rankedCatalog = rankMediaResults(catalog, preferredGenres);

  // Combine recommendations: tailored recommendations first, then ranked catalog
  const combinedPersonalized = [...userRecs];
  rankedCatalog.forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combinedPersonalized.push(item);
    }
  });

  const isAnimeItem = (item: any) => {
    return (
      (item.genres || []).some((g: string) => g.toLowerCase().includes('anim')) ||
      item.originalLanguage === 'ja' ||
      item.title?.toLowerCase().includes('anime')
    );
  };

  return {
    personalized: combinedPersonalized,
    trending: catalog.slice(0, 20),
    series: catalog.filter(i => i.mediaType === 'show' && !isAnimeItem(i)),
    movies: catalog.filter(i => i.mediaType === 'movie'),
    animes: catalog.filter(isAnimeItem)
  };
};

// TMDB Dynamic Search Service with Fallback
export const searchMedia = async (query: string): Promise<any[]> => {
  if (!query || !query.trim()) {
    return fetchTrendingCatalog();
  }

  const key = getTmdbKey();
  if (key) {
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
        params: {
          api_key: key,
          query: query.trim(),
          language: 'pt-BR',
          include_adult: false
        }
      });
      return response.data.results
        .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
        .map((item: any) => ({
          id: item.media_type === 'tv' ? `s_${item.id}` : `m_${item.id}`,
          tmdbId: item.id,
          title: item.title || item.name || item.original_name,
          overview: item.overview,
          posterPath: item.poster_path,
          backdropPath: item.backdrop_path,
          releaseDate: item.release_date || item.first_air_date,
          firstAirDate: item.first_air_date,
          genres: mapGenres(item.genre_ids),
          originalLanguage: item.original_language,
          mediaType: item.media_type === 'tv' ? 'show' : 'movie',
          rating: item.vote_average || 0
        }));
    } catch (e) {
      console.warn("TMDB API search call failed, falling back to local dataset", e);
    }
  }

  // Fallback: local fuzzy search
  const lowerQuery = query.toLowerCase();
  const matchedShows = MOCK_SHOWS.filter(s => s.title.toLowerCase().includes(lowerQuery));
  const matchedMovies = MOCK_MOVIES.filter(m => m.title.toLowerCase().includes(lowerQuery));

  return [...matchedShows, ...matchedMovies];
};

export const rankMediaResults = (results: any[], preferredGenres: string[] = []): any[] => {
  const genreSet = new Set(preferredGenres.map((g) => g.toLowerCase()));

  return [...results]
    .map((item) => {
      const itemGenres = (item.genres || []).map((g: string) => g.toLowerCase());
      const affinity = itemGenres.reduce((acc: number, g: string) => acc + (genreSet.has(g) ? 1 : 0), 0);
      const recency = item.releaseDate || item.firstAirDate ? new Date(item.releaseDate || item.firstAirDate).getFullYear() : 0;
      const score = (item.rating || 0) * 1.8 + affinity * 2.5 + recency * 0.01;
      return { ...item, _rankScore: score };
    })
    .sort((a, b) => b._rankScore - a._rankScore);
};

// Fetch Full Details with Season Episodes
export const fetchMediaDetails = async (id: string, mediaType: 'show' | 'movie'): Promise<any> => {
  const key = getTmdbKey();
  const rawId = id.replace(/^[sm]_/, '');
  const tmdbNumId = parseInt(rawId, 10);

  // First check if it's a local mock ID (non-numeric prefix or found in local data)
  const isLocalId = isNaN(tmdbNumId);
  if (isLocalId) {
    if (mediaType === 'show') {
      return MOCK_SHOWS.find(s => s.id === id) || null;
    } else {
      return MOCK_MOVIES.find(m => m.id === id) || null;
    }
  }

  // Try TMDB if key available
  if (key) {
    try {
      if (mediaType === 'show') {
        const tvRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbNumId}`, {
          params: { api_key: key, language: 'pt-BR' }
        });

        const tvData = tvRes.data;
        if (!tvData || !tvData.id) throw new Error('Invalid TMDB response');

        // Pre-load Season 1 episodes for initial display
        let season1Episodes: any[] = [];
        try {
          const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbNumId}/season/1`, {
            params: { api_key: key, language: 'pt-BR' }
          });
          season1Episodes = (epRes.data.episodes || []).map((ep: any) => ({
            episodeNumber: ep.episode_number,
            title: ep.name,
            overview: ep.overview,
            airDate: ep.air_date,
            duration: ep.runtime || 45
          }));
        } catch (e) {
          console.warn("Failed to pre-load Season 1 episodes", e);
        }

        // Map all available seasons from TMDB (filter out season 0 = Specials)
        const seasons = (tvData.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            posterPath: s.poster_path,
            episodes: s.season_number === 1 ? season1Episodes : []
          }));

        return {
          id: `s_${tvData.id}`,
          tmdbId: tvData.id,
          title: tvData.name || tvData.original_name || 'Sem título',
          overview: tvData.overview || '',
          posterPath: tvData.poster_path,
          backdropPath: tvData.backdrop_path,
          firstAirDate: tvData.first_air_date,
          genres: (tvData.genres || []).map((g: any) => g.name),
          mediaType: 'show',
          rating: tvData.vote_average || 0,
          status: tvData.status || '',
          seasons: seasons.length > 0 ? seasons : [{
            seasonNumber: 1,
            episodeCount: 0,
            episodes: season1Episodes
          }]
        };
      } else {
        const movRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbNumId}`, {
          params: { api_key: key, language: 'pt-BR' }
        });
        const movData = movRes.data;
        if (!movData || !movData.id) throw new Error('Invalid TMDB response');

        return {
          id: `m_${movData.id}`,
          tmdbId: movData.id,
          title: movData.title || movData.original_title || 'Sem título',
          overview: movData.overview || '',
          posterPath: movData.poster_path,
          backdropPath: movData.backdrop_path,
          releaseDate: movData.release_date,
          genres: (movData.genres || []).map((g: any) => g.name),
          mediaType: 'movie',
          rating: movData.vote_average || 0,
          duration: movData.runtime
        };
      }
    } catch (e) {
      console.warn("TMDB details fetch failed:", e);
      // Try local mock as fallback only if it's a known mock ID
      if (mediaType === 'show') {
        const local = MOCK_SHOWS.find(s => s.id === id || s.tmdbId.toString() === rawId);
        return local || null;
      } else {
        const local = MOCK_MOVIES.find(m => m.id === id || m.tmdbId.toString() === rawId);
        return local || null;
      }
    }
  }

  // No TMDB key – use local mocks
  if (mediaType === 'show') {
    const show = MOCK_SHOWS.find(s => s.id === id || s.tmdbId.toString() === rawId || s.id === `s_${rawId}`);
    return show || null;
  } else {
    const movie = MOCK_MOVIES.find(m => m.id === id || m.tmdbId.toString() === rawId || m.id === `m_${rawId}`);
    return movie || null;
  }
};

// Fetch season episodes dynamically on demand
export const fetchSeasonEpisodes = async (showId: string, seasonNumber: number): Promise<any[]> => {
  // Check if local mock data has it
  const localShow = MOCK_SHOWS.find(s => s.id === showId || s.tmdbId.toString() === showId) as any;
  if (localShow && localShow.seasons) {
    const localSeason = localShow.seasons.find((s: any) => s.seasonNumber === seasonNumber);
    return localSeason ? localSeason.episodes : [];
  }

  const key = getTmdbKey();
  const tmdbNumId = parseInt(showId.replace(/^[sm]_/, ''), 10);

  if (key && !isNaN(tmdbNumId)) {
    try {
      const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbNumId}/season/${seasonNumber}`, {
        params: { api_key: key, language: 'pt-BR' }
      });
      return epRes.data.episodes.map((ep: any) => ({
        episodeNumber: ep.episode_number,
        title: ep.name,
        overview: ep.overview,
        airDate: ep.air_date,
        duration: ep.runtime || 45
      }));
    } catch (e) {
      console.error(`Failed to fetch episodes for season ${seasonNumber}`, e);
      return [];
    }
  }

  return [];
};

// Retrieve TVMaze Release Schedule info
export const fetchTVMazeSchedule = async (): Promise<any[]> => {
  try {
    const res = await axios.get('https://api.tvmaze.com/schedule');
    return res.data.map((item: any) => ({
      id: `tvmaze_${item.id}`,
      showTitle: item.show.name,
      showPoster: item.show.image ? item.show.image.medium : '',
      seasonNumber: item.season,
      episodeNumber: item.number,
      title: item.name,
      airDate: item.airdate,
      time: item.airtime,
      duration: item.runtime
    }));
  } catch (e) {
    console.warn("TVMaze schedule call failed, returning empty mock calendar", e);
    return [];
  }
};

export const fetchWatchProviders = async (mediaType: 'show' | 'movie', tmdbId: number): Promise<any[]> => {
  const key = getTmdbKey();
  if (!key || !tmdbId) return [];

  try {
    const endpoint = mediaType === 'show' ? 'tv' : 'movie';
    const res = await axios.get(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/watch/providers`, {
      params: { api_key: key }
    });

    const region = 'BR';
    const entry = res.data?.results?.[region];
    if (!entry) return [];

    const normalized = [
      ...(entry.flatrate || []).map((p: any) => ({ ...p, accessType: 'Assinatura' })),
      ...(entry.rent || []).map((p: any) => ({ ...p, accessType: 'Aluguel' })),
      ...(entry.buy || []).map((p: any) => ({ ...p, accessType: 'Compra' }))
    ];

    const dedup = new Map<number, any>();
    normalized.forEach((provider: any) => {
      if (!dedup.has(provider.provider_id)) {
        dedup.set(provider.provider_id, provider);
      }
    });

    return Array.from(dedup.values());
  } catch (e) {
    console.warn('Failed to fetch watch providers:', e);
    return [];
  }
};
