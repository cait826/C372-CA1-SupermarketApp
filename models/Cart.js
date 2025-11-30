const db = require('../db');

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const Cart = {
    // Get all cart items for a user, joined with product details
    // Returns array of objects with: cartId, productId, productName, image, price, quantity
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
            const items = (results || []).map(r => {
                // ensure numeric conversions are explicit and safe
                const cartId = toNumber(r.cartId);
                const productId = toNumber(r.productId);
                const price = Number.isFinite(Number(r.price)) ? Number(r.price) : 0;
                const quantity = Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0;

                return {
                    cartId,
                    productId,
                    productName: r.productName || '',
                    image: r.image || '',
                    price,
                    quantity
                };
            });
            return callback(null, items);
        });
    },

    // Add an item to the cart. If item exists, increment quantity.
    // data: { userId, productId, quantity }
    add(data, callback) {
        const userId = Number(data.userId);
        const productId = Number(data.productId);
        const qty = Math.max(1, parseInt(data.quantity, 10) || 1);

        if (!userId || !productId) {
            return callback(new Error('Invalid userId or productId'));
        }

        const findSql = `
            SELECT id, quantity
            FROM cart
            WHERE users_id = ? AND products_id = ?
            LIMIT 1
        `;
        db.query(findSql, [userId, productId], (err, rows) => {
            if (err) return callback(err);

            if (rows && rows.length > 0) {
                const existing = rows[0];
                const newQty = toNumber(existing.quantity) + qty;
                const updateSql = `UPDATE cart SET quantity = ? WHERE id = ?`;
                db.query(updateSql, [newQty, existing.id], (err2, result) => {
                    if (err2) return callback(err2);
                    return callback(null, { cartId: existing.id, updatedQuantity: newQty, affectedRows: result.affectedRows });
                });
            } else {
                const insertSql = `INSERT INTO cart (users_id, products_id, quantity) VALUES (?, ?, ?)`;
                db.query(insertSql, [userId, productId, qty], (err2, result) => {
                    if (err2) return callback(err2);
                    return callback(null, { insertId: result.insertId, quantityInserted: qty, affectedRows: result.affectedRows });
                });
            }
        });
    },

    // Update quantity for a specific cart item by cart id
    updateQuantity(cartId, quantity, callback) {
        const id = Number(cartId);
        const qty = parseInt(quantity, 10);
        if (!id || isNaN(qty)) return callback(new Error('Invalid cartId or quantity'));

        if (qty <= 0) {
            const delSql = 'DELETE FROM cart WHERE id = ?';
            db.query(delSql, [id], (err, result) => {
                if (err) return callback(err);
                return callback(null, { removed: true, affectedRows: result.affectedRows });
            });
            return;
        }

        const sql = 'UPDATE cart SET quantity = ? WHERE id = ?';
        db.query(sql, [qty, id], (err, result) => {
            if (err) return callback(err);
            return callback(null, { updated: true, cartId: id, quantity: qty, affectedRows: result.affectedRows });
        });
    },

    // Remove a single cart item by cart id
    remove(cartId, callback) {
        const id = Number(cartId);
        if (!id) return callback(new Error('Invalid cartId'));
        const sql = 'DELETE FROM cart WHERE id = ?';
        db.query(sql, [id], (err, result) => {
            if (err) return callback(err);
            return callback(null, { removed: true, cartId: id, affectedRows: result.affectedRows });
        });
    },

    // Clear all cart items for a user
    clearByUser(userId, callback) {
        const uid = Number(userId);
        if (!uid) return callback(new Error('Invalid userId'));
        const sql = 'DELETE FROM cart WHERE users_id = ?';
        db.query(sql, [uid], (err, result) => {
            if (err) return callback(err);
            return callback(null, { cleared: true, users_id: uid, affectedRows: result.affectedRows });
        });
    }
};

module.exports = Cart;

