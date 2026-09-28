require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5050;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const IMAGES_DIR = path.resolve(__dirname, process.env.IMAGES_DIR || './images');

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

// Serve the coloring-book images folder directly, e.g. /images/star.svg
app.use('/images', express.static(IMAGES_DIR));

// Friendly display names for known pictures
const NICE_NAMES = {
  star: 'Star',
  heart: 'Heart',
  flower: 'Flower',
  fish: 'Fish',
  house: 'House',
  butterfly: 'Butterfly',
};

function toTitleCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ----- Routes -----

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// List all coloring pictures available in the images folder
app.get('/api/pictures', (req, res) => {
  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Could not read images folder' });

    const pictures = files
      .filter((f) => f.toLowerCase().endsWith('.svg'))
      .map((file) => {
        const id = file.replace(/\.svg$/i, '');
        return {
          id,
          name: NICE_NAMES[id] || toTitleCase(id),
          url: `/images/${file}`,
        };
      });

    res.json(pictures);
  });
});

// Save a colored picture
app.post('/api/artwork', (req, res) => {
  const { pictureId, title, svgMarkup } = req.body;

  if (!pictureId || !svgMarkup) {
    return res.status(400).json({ error: 'pictureId and svgMarkup are required' });
  }

  const stmt = db.prepare(
    `INSERT INTO saved_artwork (picture_id, title, svg_markup, created_at)
     VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(pictureId, title || null, svgMarkup, new Date().toISOString());

  const saved = db.prepare('SELECT * FROM saved_artwork WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(saved);
});

// List saved artwork (gallery of "My Art")
app.get('/api/artwork', (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_artwork ORDER BY id DESC').all();
  res.json(rows);
});

// Delete a saved artwork
app.delete('/api/artwork/:id', (req, res) => {
  const info = db.prepare('DELETE FROM saved_artwork WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Artwork not found' });
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Coloring book backend running at http://localhost:${PORT}`);
  console.log(`Serving images from: ${IMAGES_DIR}`);
});
