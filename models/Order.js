const db = require('../db');

const Order = {

    // Create a new order + items (transactional).
    // orderItems = [{ productId, quantity, priceEach }, ...]
    // callback(err, orderId, total)
    createOrder(userId, orderItems, callback) {
        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return callback(new Error('Order must contain at least one item'));
        }

        const total = orderItems.reduce((sum, it) => {
            const price = Number(it.priceEach ?? it.price ?? 0);
            const qty = Number(it.quantity ?? 0);
            return sum + price * qty;
        }, 0);

        const insertOrderSql = `
    INSERT INTO orders (users_id, total_price, order_date, status)
    VALUES (?, ?, NOW(), 'Pending')
`;

db.query(insertOrderSql, [userId, total], (err, orderResult) => {
    if (err) return callback(err);

    const orderId = orderResult.insertId;

    const values = orderItems.map(it => [
        orderId,
        it.productId,
        it.quantity,
        it.priceEach
    ]);

    const insertItemsSql = `
        INSERT INTO orders_items (orders_id, products_id, quantity, price_each)
        VALUES ?
    `;

    db.query(insertItemsSql, [values], (err2) => {
        if (err2) return callback(err2);

        return callback(null, orderId, total);
    });
});

    },

    // Get all orders for admin
    getAll(callback) {
        const sql = `
            SELECT o.id, o.users_id, o.total_price, o.order_date, o.status, u.username
            FROM orders o
            LEFT JOIN users u ON o.users_id = u.id
            ORDER BY o.id ASC
        `;
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows);
        });
    },

    // Get one order with its items
    // callback(err, { order: {...}, items: [...] })
    getById(orderId, callback) {
        const orderSql = `
            SELECT o.id, o.users_id, o.total_price, o.order_date, o.status, u.username
            FROM orders o
            JOIN users u ON o.users_id = u.id
            WHERE o.id = ?
            LIMIT 1
        `;

        const itemsSql = `
            SELECT
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

            const o = orderRows[0];

            db.query(itemsSql, [orderId], (err2, itemRows) => {
                if (err2) return callback(err2);

                const items = (itemRows || []).map(r => {
                    const qty = Number(r.quantity || 0);
                    const priceEach = Number(r.price_each || 0);
                    return {
                        productName: r.productName,
                        image: r.image,
                        quantity: qty,
                        priceEach: priceEach,
                        subtotal: Number((priceEach * qty).toFixed(2))
                    };
                });

                // Construct order object including username
                const orderObj = {
                    id: o.id,
                    userId: o.users_id,
                    username: o.username,
                    total_price: Number(o.total_price || 0),
                    order_date: o.order_date,
                    status: o.status
                };

                return callback(null, { order: orderObj, items });
            });
        });
    },

    // Update order status
    updateStatus(orderId, status, callback) {
        const cb = (typeof callback === 'function') ? callback : function() {};
        // First read previous status
        const selectSql = 'SELECT status FROM orders WHERE id = ? LIMIT 1';
        db.query(selectSql, [orderId], (selErr, selRows) => {
            if (selErr) return cb(selErr);
            if (!selRows || selRows.length === 0) return cb(new Error('Order not found'));

            const prevStatus = selRows[0].status;

            const sql = 'UPDATE orders SET status = ? WHERE id = ?';
            db.query(sql, [status, orderId], (err, result) => {
                if (err) return cb(err);

                // Only apply stock adjustments when changing TO "Completed" and previous status was NOT "Completed"
                if (status === 'Completed' && prevStatus !== 'Completed') {
                    const itemsSql = 'SELECT products_id, quantity FROM orders_items WHERE orders_id = ?';
                    db.query(itemsSql, [orderId], (itemsErr, itemsRows) => {
                        if (itemsErr) {
                            // Stock update failed; still return the order update result but surface the items error optionally
                            console.error('Failed to fetch order items for stock update:', itemsErr);
                            return cb(null, result);
                        }

                        if (!itemsRows || itemsRows.length === 0) {
                            return cb(null, result);
                        }

                        // Perform best-effort stock decrements for each item; prevent negative stock using GREATEST(...)
                        let pending = itemsRows.length;
                        itemsRows.forEach(item => {
                            const qty = Number(item.quantity || 0);
                            const pid = Number(item.products_id);
                            if (!pid || qty <= 0) {
                                pending--;
                                if (pending === 0) return cb(null, result);
                                return;
                            }

                            const updateProdSql = 'UPDATE products SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?';
                            db.query(updateProdSql, [qty, pid], (prodErr) => {
                                if (prodErr) {
                                    console.error('Failed to decrement product stock for productId', pid, prodErr);
                                }
                                pending--;
                                if (pending === 0) return cb(null, result);
                            });
                        });
                    });
                } else {
                    return cb(null, result);
                }
            });
        });
    }
};

module.exports = Order;


