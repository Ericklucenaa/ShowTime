import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db, CustomList, ListItem } from '../db.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

const router = Router();
const LIST_TYPES = new Set(['show', 'movie', 'mixed']);
const MEDIA_TYPES = new Set(['show', 'movie']);

// GET /lists
// Get all lists for the logged-in user
router.get('/lists', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const database = db.read();

  const userLists = database.lists.filter(l => l.userId === userId);
  
  // Hydrate lists with item count
  const result = userLists.map(list => {
    const items = database.list_items.filter(li => li.listId === list.id);
    return {
      ...list,
      itemCount: items.length
    };
  });

  res.json(result);
});

// POST /lists
// Create a new list
router.post('/lists', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { name, description, type } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedDescription = String(description || '').trim();
  const normalizedType = String(type || 'mixed').trim();

  if (!normalizedName) {
    return res.status(400).json({ error: 'List name is required' });
  }

  if (normalizedName.length > 80) {
    return res.status(400).json({ error: 'List name exceeds max length (80).' });
  }

  if (normalizedDescription.length > 500) {
    return res.status(400).json({ error: 'List description exceeds max length (500).' });
  }

  if (!LIST_TYPES.has(normalizedType)) {
    return res.status(400).json({ error: 'Invalid list type' });
  }

  const database = db.read();
  const newList: CustomList = {
    id: 'l_' + generateId(),
    userId,
    name: normalizedName,
    description: normalizedDescription,
    type: normalizedType as 'show' | 'movie' | 'mixed',
    createdAt: new Date().toISOString()
  };

  database.lists.push(newList);
  db.write(database);

  res.status(201).json(newList);
});

// DELETE /lists/:id
// Delete a list and all its items
router.delete('/lists/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const listId = req.params.id;

  const database = db.read();
  const listIndex = database.lists.findIndex(l => l.id === listId && l.userId === userId);

  if (listIndex === -1) {
    return res.status(404).json({ error: 'List not found or unauthorized' });
  }

  // Remove list
  database.lists.splice(listIndex, 1);
  // Remove items
  database.list_items = database.list_items.filter(li => li.listId !== listId);

  db.write(database);
  res.json({ result: 'OK', message: 'List deleted successfully' });
});

// GET /lists/:id/items
// Get all items in a specific list, populated with show/movie details
router.get('/lists/:id/items', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const listId = req.params.id;

  const database = db.read();
  const list = database.lists.find(l => l.id === listId && l.userId === userId);

  if (!list) {
    return res.status(404).json({ error: 'List not found or unauthorized' });
  }

  const items = database.list_items.filter(li => li.listId === listId);
  
  // Hydrate items with actual show/movie details
  const populatedItems = items.map(item => {
    let details = null;
    if (item.mediaType === 'show') {
      details = database.shows.find(s => s.id === item.mediaId);
    } else {
      details = database.movies.find(m => m.id === item.mediaId);
    }
    return {
      ...item,
      details
    };
  }).filter(item => item.details !== null && item.details !== undefined); // Filter out any dangling references

  res.json({
    list,
    items: populatedItems
  });
});

// POST /lists/:id/items
// Add a media item to a list
router.post('/lists/:id/items', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const listId = req.params.id;
  const { mediaType, mediaId, mediaMetadata } = req.body; // mediaType: 'show' | 'movie'
  const normalizedMediaType = String(mediaType || '').trim();
  const normalizedMediaId = String(mediaId || '').trim();

  if (!normalizedMediaType || !normalizedMediaId) {
    return res.status(400).json({ error: 'mediaType and mediaId are required' });
  }

  if (!MEDIA_TYPES.has(normalizedMediaType)) {
    return res.status(400).json({ error: 'Invalid media type' });
  }

  const database = db.read();
  const list = database.lists.find(l => l.id === listId && l.userId === userId);

  if (!list) {
    return res.status(404).json({ error: 'List not found or unauthorized' });
  }

  // If show or movie details are provided in metadata and not yet in our database, add them
  if (mediaMetadata) {
    if (normalizedMediaType === 'show' && !database.shows.some(s => s.id === normalizedMediaId || s.tmdbId === mediaMetadata.tmdbId)) {
      database.shows.push({
        id: normalizedMediaId,
        tmdbId: mediaMetadata.tmdbId,
        title: mediaMetadata.title,
        overview: mediaMetadata.overview || '',
        posterPath: mediaMetadata.posterPath || '',
        backdropPath: mediaMetadata.backdropPath || '',
        firstAirDate: mediaMetadata.firstAirDate || '',
        genre: mediaMetadata.genres || [],
        status: mediaMetadata.status || 'Returning Series'
      });
    } else if (normalizedMediaType === 'movie' && !database.movies.some(m => m.id === normalizedMediaId || m.tmdbId === mediaMetadata.tmdbId)) {
      database.movies.push({
        id: normalizedMediaId,
        tmdbId: mediaMetadata.tmdbId,
        title: mediaMetadata.title,
        overview: mediaMetadata.overview || '',
        posterPath: mediaMetadata.posterPath || '',
        backdropPath: mediaMetadata.backdropPath || '',
        releaseDate: mediaMetadata.releaseDate || '',
        duration: mediaMetadata.duration || 120,
        genre: mediaMetadata.genres || []
      });
    }
  }

  // Check if item is already in the list
  const itemExists = database.list_items.some(
    li => li.listId === listId && li.mediaType === normalizedMediaType && (li.mediaId === normalizedMediaId || li.mediaId === mediaMetadata?.id)
  );

  if (itemExists) {
    return res.status(400).json({ error: 'Item already in list' });
  }

  const newItem: ListItem = {
    id: 'li_' + generateId(),
    listId,
    mediaType: normalizedMediaType as 'show' | 'movie',
    mediaId: normalizedMediaId
  };

  database.list_items.push(newItem);
  db.write(database);

  res.status(201).json(newItem);
});

// DELETE /lists/:id/items/:item_id
// Remove an item from a list (supports passing item_id directly or mediaId in body)
router.delete('/lists/:id/items/:media_id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const listId = req.params.id;
  const mediaId = req.params.media_id;

  const database = db.read();
  const list = database.lists.find(l => l.id === listId && l.userId === userId);

  if (!list) {
    return res.status(404).json({ error: 'List not found or unauthorized' });
  }

  // Find index of list item
  const itemIndex = database.list_items.findIndex(
    li => li.listId === listId && (li.id === mediaId || li.mediaId === mediaId)
  );

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found in this list' });
  }

  database.list_items.splice(itemIndex, 1);
  db.write(database);

  res.json({ result: 'OK', message: 'Item removed from list' });
});

export default router;
