import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Show {
  id: string; // Internal ID
  tmdbId: number;
  tvdbId?: number;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  firstAirDate: string;
  genre: string[];
  status: string;
}

export interface Season {
  id: string;
  showId: string;
  seasonNumber: number;
  episodeCount: number;
}

export interface Episode {
  id: string;
  showId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  airDate: string;
  duration: number; // in minutes
}

export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  duration: number; // in minutes
  genre: string[];
}

export interface WatchEpisode {
  id: string;
  userId: string;
  showId: string;
  episodeId: string;
  watchedAt: string;
}

export interface WatchMovie {
  id: string;
  userId: string;
  movieId: string;
  watchedAt: string;
  isFavorite: boolean;
}

export interface CustomList {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: 'show' | 'movie' | 'mixed';
  createdAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  mediaType: 'show' | 'movie';
  mediaId: string; // Reference to show.id or movie.id
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  episodeId?: string; // If left out, it's for show or movie
  showId?: string;
  movieId?: string;
  content: string;
  createdAt: string;
}

export interface Reaction {
  id: string;
  userId: string;
  episodeId?: string;
  showId?: string;
  movieId?: string;
  type: string; // e.g. "like", "love", "wow", "sad"
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  shows: Show[];
  seasons: Season[];
  episodes: Episode[];
  movies: Movie[];
  watch_episodes: WatchEpisode[];
  watch_movies: WatchMovie[];
  lists: CustomList[];
  list_items: ListItem[];
  comments: Comment[];
  reactions: Reaction[];
}

// Default empty database structure
const defaultDb: DatabaseSchema = {
  users: [],
  shows: [],
  seasons: [],
  episodes: [],
  movies: [],
  watch_episodes: [],
  watch_movies: [],
  lists: [],
  list_items: [],
  comments: [],
  reactions: []
};

// Safe thread-like lock for read/write operations
class JSONDatabase {
  private cache: DatabaseSchema | null = null;

  constructor() {
    this.ensureDbExists();
  }

  private ensureDbExists() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      this.write(defaultDb);
      this.seedData();
    }
  }

  public read(): DatabaseSchema {
    if (this.cache) return this.cache;
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      this.cache = JSON.parse(data);
      return this.cache!;
    } catch (e) {
      console.error("Error reading database file, returning default", e);
      return defaultDb;
    }
  }

  public write(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      this.cache = data;
    } catch (e) {
      console.error("Error writing database file", e);
    }
  }

  private seedData() {
    console.log("Seeding ShowTime database...");
    const db = this.read();
    const includeDemoUser = process.env.SEED_DEMO_USER === 'true';

    if (includeDemoUser) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync("change-me-demo-user", salt);
      const testUser: User = {
        id: "u1",
        username: "testuser",
        email: "test@showtime.com",
        passwordHash: passwordHash,
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=testuser",
        createdAt: new Date().toISOString()
      };
      db.users.push(testUser);
    }

    // 2. Seed Shows
    const showsData: Show[] = [
      {
        id: "s1",
        tmdbId: 1396,
        tvdbId: 81189,
        title: "Breaking Bad",
        overview: "Walter White, um professor de química do ensino médio, descobre que tem câncer de pulmão terminal. Para garantir o futuro financeiro de sua família, ele começa a produzir e vender metanfetamina com um ex-aluno, Jesse Pinkman.",
        posterPath: "/ggm5g9tZzff9x5377I41460j6st.jpg",
        backdropPath: "/9fa5tmg53Pd94V9xp78gU6zPPi7.jpg",
        firstAirDate: "2008-01-20",
        genre: ["Drama", "Crime"],
        status: "Ended"
      },
      {
        id: "s2",
        tmdbId: 2288,
        tvdbId: 79349,
        title: "Prison Break",
        overview: "Michael Scofield é um homem desesperado em uma situação desesperadora. Seu irmão, Lincoln Burrows, está no corredor da morte por um assassinato que Michael está convencido de que ele não cometeu. Michael assalta um banco para ser preso na mesma penitenciária e executar um plano de fuga elaborado.",
        posterPath: "/ux5D85p86c3S1nN3V2H5zQ2Y37l.jpg",
        backdropPath: "/39C7F4e6o1jG1tV8eWqJ0N9y8Z3.jpg",
        firstAirDate: "2005-08-29",
        genre: ["Action", "Drama", "Crime"],
        status: "Ended"
      },
      {
        id: "s3",
        tmdbId: 1429,
        tvdbId: 262980,
        title: "Attack on Titan",
        overview: "Há várias décadas, a humanidade foi quase exterminada pelo surgimento de seres gigantescos, devoradores de humanos. Os sobreviventes construíram muralhas enormes para se proteger. Um jovem chamado Eren Jaeger jura eliminar todos os Titãs depois que sua mãe é devorada.",
        posterPath: "/hgg6Hw4A8U5329v17V39W2E77Vl.jpg",
        backdropPath: "/d5N05Z1kHnCjU8O5669L2D09y8Z.jpg",
        firstAirDate: "2013-04-07",
        genre: ["Animation", "Action", "Sci-Fi & Fantasy"],
        status: "Ended"
      }
    ];
    db.shows.push(...showsData);

    // 3. Seed Seasons & Episodes for Breaking Bad (s1) - Season 1 (7 episodes)
    db.seasons.push({
      id: "sea1_1",
      showId: "s1",
      seasonNumber: 1,
      episodeCount: 7
    });

    const bbEpTitles = [
      "Pilot",
      "Cat's in the Bag...",
      "...And the Bag's in the River",
      "Cancer Man",
      "Gray Matter",
      "Crazy Handful of Nothin'",
      "A No-Rough-Stuff-Type Deal"
    ];

    bbEpTitles.forEach((title, index) => {
      db.episodes.push({
        id: `ep_s1_1_${index + 1}`,
        showId: "s1",
        seasonId: "sea1_1",
        seasonNumber: 1,
        episodeNumber: index + 1,
        title: title,
        overview: `Sinopse detalhada do episódio ${index + 1} de Breaking Bad, onde Walter e Jesse navegam nos perigos iniciais do tráfico de drogas.`,
        airDate: `2008-01-${20 + index * 7}`,
        duration: 48
      });
    });

    // Seed Season 2 for Breaking Bad (s1) - Season 2 (3 sample episodes)
    db.seasons.push({
      id: "sea1_2",
      showId: "s1",
      seasonNumber: 2,
      episodeCount: 3
    });
    const bbS2Titles = ["Seven Thirty-Seven", "Grilled", "Bit by a Dead Bee"];
    bbS2Titles.forEach((title, index) => {
      db.episodes.push({
        id: `ep_s1_2_${index + 1}`,
        showId: "s1",
        seasonId: "sea1_2",
        seasonNumber: 2,
        episodeNumber: index + 1,
        title: title,
        overview: `Breaking Bad Temporada 2, Episódio ${index + 1}. Os riscos sobem à medida que a dupla de produtores expande seus horizontes.`,
        airDate: `2009-03-${8 + index * 7}`,
        duration: 47
      });
    });

    // Seed Seasons & Episodes for Prison Break (s2) - Season 1 (5 sample episodes)
    db.seasons.push({
      id: "sea2_1",
      showId: "s2",
      seasonNumber: 1,
      episodeCount: 5
    });

    const pbEpTitles = [
      "Pilot",
      "Allen",
      "Cell Test",
      "Cute Poison",
      "English, Fitz or Percy"
    ];

    pbEpTitles.forEach((title, index) => {
      db.episodes.push({
        id: `ep_s2_1_${index + 1}`,
        showId: "s2",
        seasonId: "sea2_1",
        seasonNumber: 1,
        episodeNumber: index + 1,
        title: title,
        overview: `Michael executa as primeiras etapas de seu plano brilhante para sair de Fox River com seu irmão Lincoln.`,
        airDate: `2005-08-${29 + index * 7}`,
        duration: 44
      });
    });

    // Seed Seasons & Episodes for Attack on Titan (s3) - Season 1 (5 sample episodes)
    db.seasons.push({
      id: "sea3_1",
      showId: "s3",
      seasonNumber: 1,
      episodeCount: 5
    });

    const aotEpTitles = [
      "Para Você, 2000 Anos no Futuro: A Queda de Shiganshina, Parte 1",
      "Aquele Dia: A Queda de Shiganshina, Parte 2",
      "Uma Luz Opaca no Meio do Desespero: A Humanidade se Levanta Novamente, Parte 1",
      "A Noite da Cerimônia de Dissolução: A Humanidade se Levanta Novamente, Parte 2",
      "Primeira Batalha: A Luta pela Queda de Trost, Parte 1"
    ];

    aotEpTitles.forEach((title, index) => {
      db.episodes.push({
        id: `ep_s3_1_${index + 1}`,
        showId: "s3",
        seasonId: "sea3_1",
        seasonNumber: 1,
        episodeNumber: index + 1,
        title: title,
        overview: `A humanidade vive protegida dentro de muralhas gigantes, até que o surgimento de um Titã Colossal muda tudo.`,
        airDate: `2013-04-${7 + index * 7}`,
        duration: 24
      });
    });

    // 4. Seed Movies
    const moviesData: Movie[] = [
      {
        id: "m1",
        tmdbId: 157336,
        title: "Interstellar",
        overview: "As reservas naturais da Terra estão se esgotando e um grupo de astronautas recebe a missão de verificar possíveis planetas habitáveis para receber a população mundial, possibilitando a continuação da espécie.",
        posterPath: "/gEU2QvHwZJ7fvvevkgjHGnAsjYd.jpg",
        backdropPath: "/rAiw0Av5nH7ee5u84gL46hNu869.jpg",
        releaseDate: "2014-11-05",
        duration: 169,
        genre: ["Sci-Fi", "Drama", "Adventure"]
      },
      {
        id: "m2",
        tmdbId: 27205,
        title: "Inception",
        overview: "Dom Cobb é um ladrão talentoso cuja especialidade é extrair segredos valiosos do fundo do subconsciente durante o estado de sono. Sua habilidade única fez dele um jogador cobiçado no mundo da espionagem, mas também o tornou um fugitivo internacional.",
        posterPath: "/9gk7adHYeHCwb0mfsEStm0gziFC.jpg",
        backdropPath: "/s3TBrRGB1q7jWjLflmgQQYgWESY.jpg",
        releaseDate: "2010-07-15",
        duration: 148,
        genre: ["Action", "Sci-Fi", "Adventure"]
      }
    ];
    db.movies.push(...moviesData);

    if (includeDemoUser) {
      db.watch_episodes.push(
        {
          id: "w_ep1",
          userId: "u1",
          showId: "s1",
          episodeId: "ep_s1_1_1",
          watchedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "w_ep2",
          userId: "u1",
          showId: "s1",
          episodeId: "ep_s1_1_2",
          watchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "w_ep3",
          userId: "u1",
          showId: "s1",
          episodeId: "ep_s1_1_3",
          watchedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      );

      db.watch_movies.push({
        id: "w_m1",
        userId: "u1",
        movieId: "m1",
        watchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        isFavorite: true
      });

      db.lists.push({
        id: "l1",
        userId: "u1",
        name: "Minha Lista de Favoritos",
        description: "Séries e filmes que mais me marcaram.",
        type: "mixed",
        createdAt: new Date().toISOString()
      });

      db.list_items.push(
        {
          id: "li1",
          listId: "l1",
          mediaType: "show",
          mediaId: "s1"
        },
        {
          id: "li2",
          listId: "l1",
          mediaType: "movie",
          mediaId: "m1"
        }
      );

      db.comments.push({
        id: "c1",
        userId: "u1",
        username: "testuser",
        episodeId: "ep_s1_1_1",
        showId: "s1",
        content: "Que episódio piloto sensacional! A cena do trailer no deserto é fantástica e dita muito bem o tom da série inteira.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
      });

      db.reactions.push({
        id: "r1",
        userId: "u1",
        episodeId: "ep_s1_1_1",
        type: "love",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 31 * 60 * 1000).toISOString()
      });
    }

    this.write(db);
    console.log("Database seeded successfully!");
  }
}

export const db = new JSONDatabase();
