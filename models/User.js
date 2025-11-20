const db = require('../db');

const User = {
    // Get all users
    getAll: function(callback) {
        const sql = 'SELECT * FROM users';
        db.query(sql, (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },

    // Get a user by ID
    getById: function(id, callback) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        db.query(sql, [id], (err, results) => {
            if (err) return callback(err);
            callback(null, results.length ? results[0] : null);
        });
    },

    // Add a new user
    // user: { username, email, password, address, contact, role }
    add: function(user, callback) {
        const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA(?), ?, ?, ?)';
        const params = [
            user.username,
            user.email,
            user.password,
            user.address || null,
            user.contact || null,
            user.role || 'user'
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    // Update an existing user by ID
    // user: { username, email, password, address, contact, role }
    update: function(id, user, callback) {
        const sql = 'UPDATE users SET username = ?, email = ?, password = ?, address = ?, contact = ?, role = ? WHERE id = ?';
        const params = [
            user.username,
            user.email,
            user.password,
            user.address || null,
            user.contact || null,
            user.role || 'user',
            id
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    // Delete a user by ID
    delete: function(id, callback) {
        const sql = 'DELETE FROM users WHERE id = ?';
        db.query(sql, [id], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }
};

module.exports = User;