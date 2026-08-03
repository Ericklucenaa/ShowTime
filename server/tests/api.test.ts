import request from 'supertest';
import app, { server } from '../src/index.js';
import { db } from '../src/db.js';

describe('ShowTime Backend API Integration Tests', () => {
  let token = '';
  let userId = '';
  const suffix = Date.now().toString(36);
  const testUsername = `testsignup_${suffix}`;
  const testEmail = `signup_${suffix}@test.com`;
  const testPassword = 'password123';

  afterAll(async () => {
    // Close the server connection to prevent Jest hanging
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  describe('Auth Routes', () => {
    it('should signup a new user', async () => {
      const res = await request(app)
        .post('/signup')
        .send({
          username: testUsername,
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(201);
      expect(res.body.result).toBe('OK');
      expect(res.body.tvst_access_token).toBeDefined();
    });

    it('should login the created user', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          username: testUsername,
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('OK');
      expect(res.body.tvst_access_token).toBeDefined();
      
      token = res.body.tvst_access_token;
      userId = res.body.id;
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          username: testUsername,
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('Shows and Seasons Routes', () => {
    it('should fetch show details', async () => {
      const res = await request(app)
        .get('/api/shows/s1')
        .set('TVST_ACCESS_TOKEN', token);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Breaking Bad');
    });

    it('should fetch seasons episodes', async () => {
      const res = await request(app)
        .get('/api/shows/s1/seasons/1')
        .set('TVST_ACCESS_TOKEN', token);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Watch Episode Tracking', () => {
    it('should toggle episode watch state', async () => {
      // First watch (since s1 e4 isn't in testuser's initial seed list)
      const res = await request(app)
        .post('/api/watched_episodes/episode/ep_s1_1_4')
        .set('TVST_ACCESS_TOKEN', token)
        .send({
          show: { tmdbId: 1396, title: 'Breaking Bad' },
          episode: { seasonNumber: 1, episodeNumber: 4 }
        });

      expect(res.status).toBe(200);
      expect(res.body.watched).toBe(true);

      // Unwatch toggle check
      const resUnwatch = await request(app)
        .post('/api/watched_episodes/episode/ep_s1_1_4')
        .set('TVST_ACCESS_TOKEN', token);

      expect(resUnwatch.status).toBe(200);
      expect(resUnwatch.body.watched).toBe(false);
    });
  });

  describe('Watch Movie Tracking', () => {
    it('should track and toggle watch state for a movie', async () => {
      const res = await request(app)
        .post('/api/watch_movies/movie/m1')
        .set('TVST_ACCESS_TOKEN', token)
        .send({ action: 'watch' });

      expect(res.status).toBe(200);
      expect(res.body.watched).toBe(true);
    });
  });
});
