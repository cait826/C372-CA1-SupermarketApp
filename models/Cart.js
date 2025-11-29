const db = require('../db');

const Cart = {

    // Get all cart items for a user, joined with product details
    getAllByUser(userId, callback) {
        const sql = `
            SELECT
                c.id AS cartId,
                p.id AS productId,
                p.productName,
                p.image,
                p.price,
                c.quantity
            FROM cart c
            JOIN products p ON c.products_id = p.id
            WHERE c.users_id = ?
        `;
        db.query(sql, [userId], (err, results) => {
            if (err) return callback(err);
            return callback(null, results);
        });
    },

    // Add an item to the cart. If item exists, increment quantity.
    add(data, callback) {
        const userId = data.userId;
        const productId = data.productId;
        const qty = parseInt(data.quantity, 10) || 1;

        const findSql = `
            SELECT id, quantity 
            FROM cart 
            WHERE users_id = ? AND products_id = ?
        `;

        db.query(findSql, [userId, productId], (err, rows) => {
            if (err) return callback(err);

            if (rows && rows.length > 0) {
                // already in cart → increase quantity
                const existing = rows[0];
                const newQty = existing.quantity + qty;
                const updateSql = `
                    UPDATE cart 
                    SET quantity = ?
                    WHERE id = ?
                `;
                db.query(updateSql, [newQty, existing.id], (err2, result) => {
                    if (err2) return callback(err2);
                    return callback(null, result);
                });
            } else {
                const insertSql = `
                    INSERT INTO cart (users_id, products_id, quantity)
                    VALUES (?, ?, ?)
                `;
                db.query(insertSql, [userId, productId, qty], (err2, result) => {
                    if (err2) return callback(err2);
                    return callback(null, result);
                });
            }
        });
    },

    // Update quantity for a specific cart item by cart id
    updateQuantity(cartId, quantity, callback) {
        const qty = parseInt(quantity, 10);
        if (isNaN(qty)) return callback(new Error('Invalid quantity'));

        if (qty <= 0) {
            // If quantity <= 0, remove the item
            const delSql = 'DELETE FROM cart WHERE id = ?';
            db.query(delSql, [cartId], (err, result) => {
                if (err) return callback(err);
                return callback(null, result);
            });
            return;
        }

        const sql = 'UPDATE cart SET quantity = ? WHERE id = ?';
        db.query(sql, [qty, cartId], (err, result) => {
            if (err) return callback(err);
            return callback(null, result);
        });
    },

    // Remove a single cart item by cart id
    remove(cartId, callback) {
        const sql = 'DELETE FROM cart WHERE id = ?';
        db.query(sql, [cartId], (err, result) => {
            if (err) return callback(err);
            return callback(null, result);
        });
    },

    // Clear all cart items for a user
    clearByUser(userId, callback) {
        const sql = 'DELETE FROM cart WHERE users_id = ?';
        db.query(sql, [userId], (err, result) => {
            if (err) return callback(err);
            return callback(null, result);
        });
    }
};

module.exports = Cart;

