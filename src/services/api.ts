import axios from 'axios';

// LocalStorage key for user token
const TMDB_KEY_KEY = 'showtime_tmdb_key';

// TMDB API Client configuration
const getTmdbKey = () => localStorage.getItem(TMDB_KEY_KEY) || import.meta.env.VITE_TMDB_API_KEY || '';

export const setTmdbKey = (key: string) => {
  if (key) {
    localStorage.setItem(TMDB_KEY_KEY, key);
  } else {
    localStorage.removeItem(TMDB_KEY_KEY);
  }
};

export const hasRealTmdbKey = () => !!getTmdbKey();

// Helper to construct TMDB image URLs
export const getImageUrl = (path: string | null, size: 'w200' | 'w500' | 'original' = 'w500') => {
  if (!path) return 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// Rich mock data to ensure the app works flawlessly out of the box
const MOCK_SHOWS = [
  {
    id: 's1',
    tmdbId: 1396,
    title: 'Breaking Bad',
    overview: 'Walter White, um professor de química do ensino médio, descobre que tem câncer de pulmão terminal. Para garantir o futuro financeiro de sua família, ele começa a produzir e vender metanfetamina com um ex-aluno, Jesse Pinkman.',
    posterPath: '/ggm5g9tZzff9x5377I41460j6st.jpg',
    backdropPath: '/9fa5tmg53Pd94V9xp78gU6zPPi7.jpg',
    firstAirDate: '2008-01-20',
    genres: ['Drama', 'Crime'],
    mediaType: 'show',
    rating: 9.3,
    status: 'Ended',
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 7,
        episodes: [
          { episodeNumber: 1, title: 'Pilot', overview: 'Walter White, um professor de química desiludido, descobre que tem câncer e decide produzir metanfetamina para garantir o sustento de sua família.', airDate: '2008-01-20', duration: 58 },
          { episodeNumber: 2, title: "Cat's in the Bag...", overview: 'Walt e Jesse tentam se livrar dos corpos de Krazy-8 e Emilio após um negócio de drogas que deu errado.', airDate: '2008-01-27', duration: 48 },
          { episodeNumber: 3, title: "...And the Bag's in the River", overview: 'Walt precisa decidir se deve ou não matar o traficante Krazy-8, mantido refém no porão de Jesse.', airDate: '2008-02-10', duration: 48 },
          { episodeNumber: 4, title: 'Cancer Man', overview: 'A família de Walt descobre seu diagnóstico de câncer. Jesse tenta voltar para a casa de seus pais.', airDate: '2008-02-17', duration: 48 },
          { episodeNumber: 5, title: 'Gray Matter', overview: 'Walt e Skyler comparecem a uma festa de aniversário de um amigo rico do passado, que oferece pagar pelo tratamento.', airDate: '2008-02-24', duration: 48 },
          { episodeNumber: 6, title: "Crazy Handful of Nothin'", overview: 'Walt começa a perder o cabelo devido ao tratamento e assume o pseudônimo de Heisenberg no submundo do crime.', airDate: '2008-03-02', duration: 48 },
          { episodeNumber: 7, title: "A No-Rough-Stuff-Type Deal", overview: 'Walt e Jesse fecham uma parceria perigosa com Tuco Salamanca, um traficante extremamente violento.', airDate: '2008-03-09', duration: 48 }
        ]
      },
      {
        seasonNumber: 2,
        episodeCount: 3,
        episodes: [
          { episodeNumber: 1, title: 'Seven Thirty-Seven', overview: 'Walt e Jesse percebem o quão instável e violento Tuco Salamanca é.', airDate: '2009-03-08', duration: 47 },
          { episodeNumber: 2, title: 'Grilled', overview: 'Tuco sequestra Walt e Jesse e os leva para uma casa isolada no deserto.', airDate: '2009-03-15', duration: 47 },
          { episodeNumber: 3, title: 'Bit by a Dead Bee', overview: 'Walt e Jesse criam álibis para justificar seu sumiço após o confronto com Tuco.', airDate: '2009-03-22', duration: 47 }
        ]
      }
    ]
  },
  {
    id: 's2',
    tmdbId: 2288,
    title: 'Prison Break',
    overview: 'Michael Scofield é um homem desesperado em uma situação desesperadora. Seu irmão, Lincoln Burrows, está no corredor da morte por um assassinato que Michael está convencido de que ele não cometeu. Michael assalta um banco para ser preso na mesma penitenciária e executar um plano de fuga elaborado.',
    posterPath: '/ux5D85p86c3S1nN3V2H5zQ2Y37l.jpg',
    backdropPath: '/39C7F4e6o1jG1tV8eWqJ0N9y8Z3.jpg',
    firstAirDate: '2005-08-29',
    genres: ['Action', 'Drama', 'Crime'],
    mediaType: 'show',
    rating: 8.5,
    status: 'Ended',
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 5,
        episodes: [
          { episodeNumber: 1, title: 'Pilot', overview: 'Michael Scofield assalta um banco intencionalmente para ser enviado a Fox River, onde seu irmão Lincoln aguarda execução.', airDate: '2005-08-29', duration: 44 },
          { episodeNumber: 2, title: 'Allen', overview: 'Michael tenta conseguir itens cruciais para sua fuga enquanto navega por tensões raciais na prisão.', airDate: '2005-09-05', duration: 44 },
          { episodeNumber: 3, title: 'Cell Test', overview: 'Michael testa a lealdade de seu colega de cela, Sucre, antes de compartilhar seu segredo.', airDate: '2005-09-12', duration: 44 },
          { episodeNumber: 4, title: 'Cute Poison', overview: 'Michael precisa encontrar uma maneira de perfurar uma parede de concreto sem chamar atenção.', airDate: '2005-09-19', duration: 44 },
          { episodeNumber: 5, title: 'English, Fitz or Percy', overview: 'Um oficial corrupto tenta transferir Michael, ameaçando arruinar todo o plano de fuga.', airDate: '2005-09-26', duration: 44 }
        ]
      }
    ]
  },
  {
    id: 's3',
    tmdbId: 1429,
    title: 'Attack on Titan',
    overview: 'Há várias décadas, a humanidade foi quase exterminada pelo surgimento de seres gigantescos, devoradores de humanos. Os sobreviventes construíram muralhas enormes para se proteger. Um jovem chamado Eren Jaeger jura eliminar todos os Titãs depois que sua mãe é devorada.',
    posterPath: '/hgg6Hw4A8U5329v17V39W2E77Vl.jpg',
    backdropPath: '/d5N05Z1kHnCjU8O5669L2D09y8Z.jpg',
    firstAirDate: '2013-04-07',
    genres: ['Animation', 'Action', 'Sci-Fi & Fantasy'],
    mediaType: 'show',
    rating: 8.9,
    status: 'Ended',
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 5,
        episodes: [
          { episodeNumber: 1, title: 'Para Você, 2000 Anos no Futuro: A Queda de Shiganshina, Parte 1', overview: 'A humanidade vive em paz há 100 anos dentro de três grandes muralhas, até o surgimento súbito de um Titã Colossal de 60 metros.', airDate: '2013-04-07', duration: 24 },
          { episodeNumber: 2, title: 'Aquele Dia: A Queda de Shiganshina, Parte 2', overview: 'Eren, Mikasa e Armin fogem de Shiganshina enquanto os titãs invadem e destroem seu lar.', airDate: '2013-04-14', duration: 24 },
          { episodeNumber: 3, title: 'Uma Luz Opaca no Meio do Desespero: A Humanidade se Levanta Novamente, Parte 1', overview: 'Eren e seus amigos ingressam no treinamento militar para aprender a usar o Dispositivo de Manobra Tridimensional.', airDate: '2013-04-21', duration: 24 },
          { episodeNumber: 4, title: 'A Noite da Cerimônia de Dissolução: A Humanidade se Levanta Novamente, Parte 2', overview: 'Cinco anos de treinamento se passam. Eren se gradua entre os 10 melhores da turma.', airDate: '2013-04-28', duration: 24 },
          { episodeNumber: 5, title: 'Primeira Batalha: A Luta pela Queda de Trost, Parte 1', overview: 'O Titã Colossal reaparece abrindo um rombo na Muralha Rose, iniciando uma nova invasão terrível.', airDate: '2013-05-05', duration: 24 }
        ]
      }
    ]
  },
  {
    id: 's4',
    tmdbId: 1399,
    title: 'Game of Thrones',
    overview: 'Em uma terra onde os verões podem durar décadas e o inverno uma via inteira, várias famílias nobres travam uma guerra mortal pelo controle dos Sete Reinos de Westeros.',
    posterPath: '/1XS1oqLmx6o7LI4DQn0G1a2rlil.jpg',
    backdropPath: '/2OMB0nv2TxiKVq7i5O7iEvJ4eXt.jpg',
    firstAirDate: '2011-04-17',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Action'],
    mediaType: 'show',
    rating: 8.4,
    status: 'Ended',
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 3,
        episodes: [
          { episodeNumber: 1, title: 'Winter Is Coming', overview: 'Ned Stark é convidado pelo rei Robert Baratheon para ser a nova Mão do Rei.', airDate: '2011-04-17', duration: 62 },
          { episodeNumber: 2, title: 'The Kingsroad', overview: 'Ned deixa Winterfell com suas filhas rumo à capital Porto Real.', airDate: '2011-04-24', duration: 56 },
          { episodeNumber: 3, title: 'Lord Snow', overview: 'Jon Snow chega à Muralha para ingressar na Patrulha da Noite.', airDate: '2011-05-01', duration: 58 }
        ]
      }
    ]
  }
];

const MOCK_MOVIES = [
  {
    id: 'm1',
    tmdbId: 157336,
    title: 'Interstellar',
    overview: 'As reservas naturais da Terra estão se esgotando e um grupo de astronautas recebe a missão de verificar possíveis planetas habitáveis para receber a população mundial, possibilitando a continuação da espécie.',
    posterPath: '/gEU2QvHwZJ7fvvevkgjHGnAsjYd.jpg',
    backdropPath: '/rAiw0Av5nH7ee5u84gL46hNu869.jpg',
    releaseDate: '2014-11-05',
    genres: ['Sci-Fi', 'Drama', 'Adventure'],
    mediaType: 'movie',
    rating: 8.4,
    duration: 169
  },
  {
    id: 'm2',
    tmdbId: 27205,
    title: 'Inception',
    overview: 'Dom Cobb é um ladrão talentoso cuja especialidade é extrair segredos valiosos do fundo do subconsciente durante o estado de sono. Sua habilidade única fez dele um jogador cobiçado no mundo da espionagem, mas também o tornou um fugitivo internacional.',
    posterPath: '/9gk7adHYeHCwb0mfsEStm0gziFC.jpg',
    backdropPath: '/s3TBrRGB1q7jWjLflmgQQYgWESY.jpg',
    releaseDate: '2010-07-15',
    genres: ['Action', 'Sci-Fi', 'Adventure'],
    mediaType: 'movie',
    rating: 8.4,
    duration: 148
  },
  {
    id: 'm3',
    tmdbId: 299536,
    title: 'Avengers: Infinity War',
    overview: 'Homem de Ferro, Thor, Hulk e os Vingadores se unem para combater o seu inimigo mais poderoso, o maligno Thanos. Em uma missão para coletar todas as seis Joias do Infinito, Thanos planeja usá-las para impor sua vontade maléfica sobre toda a realidade.',
    posterPath: '/x5Hw40y2ko2tL368R1Cs6e95LIo.jpg',
    backdropPath: '/bOGkg2QjEx26YpjNn7i3H6r4SVy.jpg',
    releaseDate: '2018-04-25',
    genres: ['Adventure', 'Action', 'Sci-Fi'],
    mediaType: 'movie',
    rating: 8.3,
    duration: 149
  }
];

// TMDB Dynamic Search Service with Fallback
export const searchMedia = async (query: string): Promise<any[]> => {
  const key = getTmdbKey();
  if (key) {
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
        params: {
          api_key: key,
          query: query,
          language: 'pt-BR',
          include_adult: false
        }
      });
      // Filter out people, only keep shows and movies
      return response.data.results
        .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
        .map((item: any) => ({
          id: item.media_type === 'tv' ? `s_${item.id}` : `m_${item.id}`,
          tmdbId: item.id,
          title: item.title || item.name,
          overview: item.overview,
          posterPath: item.poster_path,
          backdropPath: item.backdrop_path,
          releaseDate: item.release_date || item.first_air_date,
          firstAirDate: item.first_air_date,
          genres: [], // Will require sub-fetch or mapped locally
          mediaType: item.media_type === 'tv' ? 'show' : 'movie',
          rating: item.vote_average
        }));
    } catch (e) {
      console.warn("TMDB API call failed, falling back to local dataset", e);
    }
  }

  // Fallback: local fuzzy search
  const lowerQuery = query.toLowerCase();
  const matchedShows = MOCK_SHOWS.filter(s => s.title.toLowerCase().includes(lowerQuery));
  const matchedMovies = MOCK_MOVIES.filter(m => m.title.toLowerCase().includes(lowerQuery));

  return [...matchedShows, ...matchedMovies];
};

// Fetch Full Details with Season Episodes
export const fetchMediaDetails = async (id: string, mediaType: 'show' | 'movie'): Promise<any> => {
  const key = getTmdbKey();
  const rawId = id.replace(/^[sm]_/, '');
  const tmdbNumId = parseInt(rawId);

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
  const localShow = MOCK_SHOWS.find(s => s.id === showId || s.tmdbId.toString() === showId);
  if (localShow) {
    const localSeason = localShow.seasons.find(s => s.seasonNumber === seasonNumber);
    return localSeason ? localSeason.episodes : [];
  }

  const key = getTmdbKey();
  const tmdbNumId = parseInt(showId.replace(/^[sm]_/, ''));

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
