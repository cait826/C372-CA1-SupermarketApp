const db = require('../db');

const Product = {
    getAll: function(callback) {
        const sql = 'SELECT * FROM products';
        db.query(sql, (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },
    getById: function(id, callback) {
        const sql = 'SELECT * FROM products WHERE id = ?';
        db.query(sql, [id], (err, results) => {
            if (err) return callback(err);
            callback(null, results.length ? results[0] : null);
        });
    },
    add: function(product, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
        const params = [product.productName, product.quantity, product.price, product.image || null];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },
    update: function(id, product, callback) {
        const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
        const params = [product.productName, product.quantity, product.price, product.image || null, id];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },
    delete: function(id, callback) {
        const sql = 'DELETE FROM products WHERE id = ?';
        db.query(sql, [id], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    search: function(query, callback) {
        const searchquery = `%${query}%`;
        const sql = 'SELECT * FROM products WHERE productName LIKE ?';
        db.query(sql, [searchquery], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    }
};

module.exports = Product;
