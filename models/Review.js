const db = require('../db');

const Review = {
    // create(orderId, userId, rating, comment, callback)
    // Prevent inserting if a review already exists for that order.
    create(orderId, userId, rating, comment, callback) {
        const r = Number(rating) || 0;
        const safeRating = Math.min(5, Math.max(1, Math.round(r)));

        const checkSql = 'SELECT id FROM reviews WHERE order_id = ? LIMIT 1';
        db.query(checkSql, [orderId], (checkErr, checkRows) => {
            if (checkErr) return callback(checkErr);
            if (Array.isArray(checkRows) && checkRows.length > 0) {
                return callback(new Error('Review already exists for this order'));
            }

            const sql = `
                INSERT INTO reviews (users_id, order_id, rating, comment, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `;
            db.query(sql, [userId, orderId, safeRating, comment], (err, result) => {
                if (err) return callback(err);
                return callback(null, result);
            });
        });
    },

    // getByOrder(orderId, callback) -> returns single review row or null
    getByOrder(orderId, callback) {
        const sql = `
            SELECT id, users_id, order_id, rating, comment, created_at
            FROM reviews
            WHERE order_id = ?
            LIMIT 1
        `;
        db.query(sql, [orderId], (err, rows) => {
            if (err) return callback(err);
            if (!rows || rows.length === 0) return callback(null, null);
            return callback(null, rows[0]);
        });
    },

    // getAll(callback) -> returns all reviews (for admin)
    getAll(callback) {
        const sql = `
            SELECT r.id, r.users_id, r.order_id, r.rating, r.comment, r.created_at, u.username
            FROM reviews r
            LEFT JOIN users u ON r.users_id = u.id
            ORDER BY r.created_at DESC
        `;
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows);
        });
    },

    // existsForOrder(orderId, userId, callback) -> returns true/false if that specific user reviewed that specific order
    existsForOrder(orderId, userId, callback) {
        // Validate numeric parameters
        const oid = Number(orderId);
        const uid = Number(userId);
        if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(uid) || uid <= 0) {
            // Invalid params — treat as "no review"
            return callback(null, false);
        }

        const sql = 'SELECT id FROM reviews WHERE order_id = ? AND users_id = ? LIMIT 1';
        db.query(sql, [oid, uid], (err, rows) => {
            if (err) return callback(err);
            const exists = Array.isArray(rows) && rows.length > 0;
            return callback(null, exists);
        });
    },

    // getAverageRating(productId, callback)
    // Returns { avgRating: Number, reviewCount: Number }
    getAverageRating(productId, callback) {
        const pid = Number(productId);
        if (!Number.isFinite(pid) || pid <= 0) {
            return callback(null, { avgRating: 0, reviewCount: 0 });
        }

        const sql = `
            SELECT 
                AVG(rating) AS avgRating,
                COUNT(*) AS reviewCount
            FROM reviews
            WHERE product_id = ?
        `;
        db.query(sql, [pid], (err, rows) => {
            if (err) return callback(err);
            const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
            const avgRating = row && row.avgRating != null ? Number(row.avgRating) : 0;
            const reviewCount = row && row.reviewCount != null ? Number(row.reviewCount) : 0;
            return callback(null, { avgRating: avgRating, reviewCount: reviewCount });
        });
    }
};

module.exports = Review;