const db = require('../db');

const Favorite = {
  // addFavorite(userId, productId, callback)
  addFavorite(userId, productId, callback) {
    const sql = 'INSERT IGNORE INTO favorites (users_id, products_id) VALUES (?, ?)';
    db.query(sql, [userId, productId], (err, result) => {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  // removeFavorite(userId, productId, callback)
  removeFavorite(userId, productId, callback) {
    const sql = 'DELETE FROM favorites WHERE users_id = ? AND products_id = ?';
    db.query(sql, [userId, productId], (err, result) => {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  // listFavorites(userId, callback)
  listFavorites(userId, callback) {
    const sql = `
      SELECT p.*
      FROM favorites f
      JOIN products p ON f.products_id = p.id
      WHERE f.users_id = ?
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err) return callback(err);
      return callback(null, rows);
    });
  },

  // isFavorite(userId, productId, callback) -> returns boolean
  isFavorite(userId, productId, callback) {
    const sql = 'SELECT id FROM favorites WHERE users_id = ? AND products_id = ? LIMIT 1';
    db.query(sql, [userId, productId], (err, rows) => {
      if (err) return callback(err);
      return callback(null, Array.isArray(rows) && rows.length > 0);
    });
  },

  // countFavorites(productId, callback)
  // returns total number of favorites for a product
  countFavorites(productId, callback) {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return callback(null, 0);
    }

    const sql = 'SELECT COUNT(*) AS total FROM favorites WHERE products_id = ?';
    db.query(sql, [pid], (err, rows) => {
      if (err) return callback(err);
      const total = Array.isArray(rows) && rows[0] && rows[0].total != null ? Number(rows[0].total) : 0;
      return callback(null, total);
    });
  }
};

module.exports = Favorite;