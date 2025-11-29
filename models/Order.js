const db = require('../db');

const Order = {

    // Create a new order + items (transactional).
    // items = [{ productId, quantity, priceEach } ...]
    // callback(err, { orderId, total_price })
    createOrder(userId, items, callback) {
        if (!Array.isArray(items) || items.length === 0) {
            return callback(new Error('Order must contain at least one item'));
        }

        // calculate total using priceEach or price
        const total = items.reduce((sum, it) => {
            const price = Number(it.priceEach ?? it.price ?? 0);
            const qty = Number(it.quantity ?? 0);
            return sum + price * qty;
        }, 0);

        // Use a connection for transaction (works with mysql / mysql2 pools)
        db.getConnection((connErr, connection) => {
            if (connErr) return callback(connErr);

            connection.beginTransaction(txErr => {
                if (txErr) {
                    connection.release();
                    return callback(txErr);
                }

                const orderSql = `
                    INSERT INTO orders (users_id, total_price, order_date, status)
                    VALUES (?, ?, NOW(), 'Pending')
                `;

                connection.query(orderSql, [userId, total], (insertErr, insertRes) => {
                    if (insertErr) {
                        return connection.rollback(() => {
                            connection.release();
                            callback(insertErr);
                        });
                    }

                    const orderId = insertRes.insertId;

                    // bulk insert order items
                    const itemSql = `
                        INSERT INTO orders_items (orders_id, products_id, quantity, price_each)
                        VALUES ?
                    `;

                    const values = items.map(it => {
                        const price = Number(it.priceEach ?? it.price ?? 0);
                        const qty = Number(it.quantity ?? 0);
                        return [orderId, it.productId, qty, price];
                    });

                    connection.query(itemSql, [values], (itemsErr) => {
                        if (itemsErr) {
                            return connection.rollback(() => {
                                connection.release();
                                callback(itemsErr);
                            });
                        }

                        connection.commit(commitErr => {
                            if (commitErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    callback(commitErr);
                                });
                            }

                            connection.release();
                            // return order id and total_price to caller
                            return callback(null, { orderId, total_price: total });
                        });
                    });
                });
            });
        });
    },

    // Get all orders (admin)
    getAll(callback) {
        const sql = `
            SELECT o.id, o.users_id, o.total_price, o.order_date, o.status, u.username
            FROM orders o
            JOIN users u ON o.users_id = u.id
            ORDER BY o.order_date DESC
        `;
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows);
        });
    },

    // Get one order with its items
    // callback(err, order) where order includes items: [...]
    getById(orderId, callback) {
        const orderSql = `
            SELECT id, users_id, total_price, order_date, status
            FROM orders
            WHERE id = ?
            LIMIT 1
        `;

        const itemsSql = `
            SELECT 
                oi.id AS order_item_id,
                oi.orders_id,
                oi.products_id,
                oi.quantity,
                oi.price_each,
                p.productName,
                p.image
            FROM orders_items oi
            JOIN products p ON oi.products_id = p.id
            WHERE oi.orders_id = ?
        `;

        db.query(orderSql, [orderId], (err, orderRows) => {
            if (err) return callback(err);
            if (!orderRows || orderRows.length === 0) return callback(null, null);

            const order = orderRows[0];

            db.query(itemsSql, [orderId], (err2, itemRows) => {
                if (err2) return callback(err2);

                // normalize item fields expected by controllers/views
                const items = (itemRows || []).map(r => ({
                    id: r.order_item_id,
                    orders_id: r.orders_id,
                    products_id: r.products_id,
                    productName: r.productName,
                    image: r.image,
                    quantity: Number(r.quantity),
                    price_each: Number(r.price_each)
                }));

                order.items = items;
                return callback(null, order);
            });
        });
    },

    // Update status (admin)
    updateStatus(orderId, status, callback) {
        const sql = 'UPDATE orders SET status = ? WHERE id = ?';
        db.query(sql, [status, orderId], (err, result) => {
            if (err) return callback(err);
            return callback(null, result);
        });
    }
};

module.exports = Order;

