require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5050;
// Allow single origin or comma-separated list, e.g. "http://localhost:3000,http://coloringbook.example.com"
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
const IMAGES_DIR = path.resolve(__dirname, process.env.IMAGES_DIR || './images');

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow curl / same-origin / no-Origin requests
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked for origin ${origin}`));
    },
  })
);
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
  rose: 'Rose',
  cat: 'Cat',
  tree: 'Tree',
};

function toTitleCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Shorten long uploaded filenames (e.g. hashed JPEG names) into a readable label
function cleanName(id) {
  // Turn separators into spaces, collapse whitespace
  let label = id.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // If still very long (hash-like), shorten to first words
  if (label.length > 28) {
    label = label.slice(0, 28).trim() + '…';
  }
  // Title-case each word
  label = label
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
  return label || toTitleCase(id.slice(0, 20));
}

// ----- Routes -----

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// List all coloring pictures available in the images folder
// SVGs are colorable line-art; raster images (jpg/png/webp) are picture-book pages
app.get('/api/pictures', (req, res) => {
  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Could not read images folder' });

    const pictures = files
      .filter((f) => /\.(svg|jpe?g|png|webp)$/i.test(f))
      .map((file) => {
        const ext = file.split('.').pop().toLowerCase();
        const id = file.replace(/\.[^.]+$/, '');
        const type = ext === 'svg' ? 'svg' : 'image';
        return {
          id,
          name: NICE_NAMES[id] || cleanName(id),
          url: `/images/${encodeURIComponent(file)}`,
          type,
        };
      })
      // Keep existing SVG line-art first, then new picture-book images
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'svg' ? -1 : 1;
        return a.name.localeCompare(b.name);
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
