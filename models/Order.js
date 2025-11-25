const db = require('../db');

const Order = {

    // Create a new order + items
    // items = [{ productId, quantity, price }, ...]
    createOrder(userId, items, callback) {
        if (!Array.isArray(items) || items.length === 0) {
            return callback(new Error('Order must contain at least one item'));
        }

        const total = items.reduce(
            (sum, it) => sum + (Number(it.price) * Number(it.quantity)),
            0
        );

        const orderSql = `
            INSERT INTO orders (users_id, total_price, order_date, status)
            VALUES (?, ?, NOW(), 'Pending')
        `;

        db.query(orderSql, [userId, total], (err, result) => {
            if (err) return callback(err);

            const orderId = result.insertId;

            const itemSql = `
                INSERT INTO orders_items (orders_id, products_id, quantity, price_each)
                VALUES (?, ?, ?, ?)
            `;

            let remaining = items.length;
            let hasError = false;

            items.forEach(item => {
                if (hasError) return;

                db.query(
                    itemSql,
                    [orderId, item.productId, item.quantity, item.price],
                    (err2) => {
                        if (err2) {
                            hasError = true;
                            return callback(err2);
                        }

                        remaining -= 1;
                        if (remaining === 0 && !hasError) {
                            callback(null, orderId);
                        }
                    }
                );
            });
        });
    },

    // Get all orders (admin)
    getAll(callback) {
        const sql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.users_id = u.id
            ORDER BY o.order_date DESC
        `;
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            callback(null, rows);
        });
    },

    // Get one order with its items
    getById(orderId, callback) {
        const orderSql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.users_id = u.id
            WHERE o.id = ?
        `;

        const itemsSql = `
            SELECT 
                oi.*, 
                p.productName, 
                p.image
            FROM orders_items oi
            JOIN products p ON oi.products_id = p.id
            WHERE oi.orders_id = ?
        `;

        db.query(orderSql, [orderId], (err, orderRows) => {
            if (err) return callback(err);
            if (orderRows.length === 0) return callback(null, null);

            db.query(itemsSql, [orderId], (err2, itemRows) => {
                if (err2) return callback(err2);

                callback(null, {
                    order: orderRows[0],
                    items: itemRows
                });
            });
        });
    },

    // Update status (admin)
    updateStatus(orderId, status, callback) {
        const sql = 'UPDATE orders SET status = ? WHERE id = ?';
        db.query(sql, [status, orderId], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }
};

module.exports = Order;

