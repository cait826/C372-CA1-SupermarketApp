const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Review = require('../models/Review');
const db = require('../db'); // added to enrich items with product data

const OrderController = {
    // POST /checkoutconfirm -> create order from cart, insert items, clear cart, then render confirmation
    confirmCheckout(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const userId = req.session.user.id;

        // Load cart items
        Cart.getAllByUser(userId, (err, cartItems) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send('Database error');
            }

            if (!cartItems || cartItems.length === 0) {
                return res.redirect('/cart');
            }

            // Build orderItems expected by Order model
            const orderItems = cartItems.map(it => ({
                productId: Number(it.productId),
                quantity: Number(it.quantity),
                priceEach: Number(it.price)
            }));

            // Create order (model handles transactional inserts and stock adjustments)
            Order.createOrder(userId, orderItems, (createErr, maybeOrderId, maybeTotal) => {
                if (createErr) {
                    console.error('Order.createOrder error:', createErr);
                    return res.status(500).send('Database error');
                }

                // Normalize returned orderId
                let orderId = null;
                if (typeof maybeOrderId === 'number') {
                    orderId = maybeOrderId;
                } else if (maybeOrderId && typeof maybeOrderId === 'object') {
                    orderId = maybeOrderId.insertId || maybeOrderId.orderId || maybeOrderId.id || null;
                } else if (typeof maybeTotal === 'number' && !maybeOrderId) {
                    orderId = maybeTotal;
                }

                if (!orderId) {
                    console.error('confirmCheckout: missing orderId', { maybeOrderId, maybeTotal });
                    return res.status(500).send('Failed to create order');
                }

                // Optional: mark order as Completed (model may already handle this)
                Order.updateStatus(orderId, 'Completed', (updErr) => {
                    if (updErr) {
                        console.error('Order.updateStatus error after createOrder:', updErr);
                        // continue flow even if status update fails
                    }

                    // Clear user's cart and render confirmation (do not redirect)
                    Cart.clearByUser(userId, async (clearErr) => {
                        if (clearErr) console.error('Cart.clearByUser error after order:', clearErr);

                        // Determine total for view
                        const total = Number(maybeTotal || 0);

                        // Enrich orderItems with productName and image from products table
                        try {
                            await Promise.all(orderItems.map(it => new Promise(resolve => {
                                const pid = Number(it.productId);
                                if (!pid) return resolve();
                                db.query('SELECT productName, image FROM products WHERE id = ?', [pid], (qErr, rows) => {
                                    if (!qErr && Array.isArray(rows) && rows[0]) {
                                        it.productName = rows[0].productName;
                                        it.image = rows[0].image;
                                    } else {
                                        // leave existing fields or set null fallback
                                        it.productName = it.productName || null;
                                        it.image = it.image || null;
                                    }
                                    resolve();
                                });
                            })));
                        } catch (e) {
                            console.error('Error enriching order items:', e);
                        }

                        // Check if a review exists for this order for this user
                        let reviewExists = false;
                        try {
                            reviewExists = await new Promise((resolve) => {
                                Review.existsForOrder(orderId, userId, (revErr, exists) => {
                                    if (revErr) {
                                        console.error('Review.existsForOrder error:', revErr);
                                        return resolve(false);
                                    }
                                    return resolve(Boolean(exists));
                                });
                            });
                        } catch (e) {
                            console.error('Unexpected error checking review existence:', e);
                            reviewExists = false;
                        }

                        return res.render('checkoutconfirm', {
                            orderCompleted: true,
                            order: { id: orderId, total_price: total },
                            items: orderItems,
                            total: total,
                            reviewExists: Boolean(reviewExists),
                            user: req.session.user
                        });
                    });
                });
            });
        });
    },

    // GET /checkoutconfirm/:orderId -> load order + items and render final confirmation
    showCheckoutConfirm(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const orderId = parseInt(req.params.orderId || req.params.id, 10);
        if (Number.isNaN(orderId)) return res.status(400).send('Invalid order id');

        Order.getById(orderId, (err, result) => {
            if (err) {
                console.error('Order.getById error:', err);
                return res.status(500).send('Database error');
            }
            if (!result) return res.status(404).send('Order not found');

            // Render using normalized shape from model
            const orderObj = result.order || {};
            const items = Array.isArray(result.items) ? result.items : [];
            const total = Number(orderObj.total_price || 0);

            // Enrich items with productName and image (if available)
            const enrichPromises = (items || []).map(it => new Promise(resolve => {
                const pid = Number(it.productId || it.product_id || it.productId);
                if (!pid) return resolve();
                db.query('SELECT productName, image FROM products WHERE id = ?', [pid], (qErr, rows) => {
                    if (!qErr && Array.isArray(rows) && rows[0]) {
                        it.productName = it.productName || rows[0].productName;
                        it.image = it.image || rows[0].image;
                    }
                    return resolve();
                });
            }));

            Promise.all(enrichPromises)
                .then(() => {
                    // Determine if the logged-in user has already reviewed this order
                    const userId = Number(req.session.user.id);
                    let reviewExists = false;

                    Review.existsForOrder(orderId, userId, (revErr, exists) => {
                        if (revErr) {
                            console.error('Review.existsForOrder error:', revErr);
                            reviewExists = false; // fail-safe
                        } else {
                            reviewExists = Boolean(exists);
                        }

                        return res.render('checkoutconfirm', {
                            orderCompleted: true,
                            order: orderObj,
                            items: items,
                            total: total,
                            reviewExists: reviewExists,
                            user: req.session.user
                        });
                    });
                })
                .catch(enrichErr => {
                    console.error('Error enriching items for checkoutconfirm:', enrichErr);
                    // proceed even if enrichment failed
                    const userId = Number(req.session.user.id);
                    Review.existsForOrder(orderId, userId, (revErr, exists) => {
                        if (revErr) {
                            console.error('Review.existsForOrder error:', revErr);
                            reviewExists = false;
                        } else {
                            reviewExists = Boolean(exists);
                        }

                        return res.render('checkoutconfirm', {
                            orderCompleted: true,
                            order: orderObj,
                            items: items,
                            total: total,
                            reviewExists: reviewExists,
                            user: req.session.user
                        });
                    });
                });
        });
    },

    // Admin: list all orders (unchanged)
    listOrders(req, res) {
        Order.getAll((err, rows) => {
            if (err) {
                console.error('Order.getAll error:', err);
                return res.status(500).send('Database error');
            }
            res.render('manageOrder', { orders: rows, user: req.session.user });
        });
    },

    // View single order (user or admin) — kept as-is but with ownership check for normal users
    viewOrder(req, res) {
        const orderIdParam = req.params.orderId || req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).send('Invalid order id');
        }

        Order.getById(orderId, (err, result) => {
            if (err) {
                console.error('Order.getById error:', err);
                return res.status(500).send('Database error');
            }
            if (!result) return res.status(404).send('Order not found');

            // Determine order object and owner id
            const orderObj = result.order || result;
            const ownerId = Number(orderObj.userId ?? orderObj.users_id ?? 0);

            // If logged-in user is not the owner, deny access
            if (!req.session.user || ownerId !== Number(req.session.user.id)) {
                return res.status(403).send('Access denied');
            }

            // order may already be normalized by model as { order, items }
            res.render('invoice', { order: orderObj, items: result.items || [], user: req.session.user });
        });
    },

    // New admin view: show an order without ownership check
    viewOrderAdmin(req, res) {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).send('Invalid order id');
        }

        Order.getById(orderId, (err, result) => {
            if (err) {
                console.error('Order.getById error (admin view):', err);
                return res.status(500).send('Database error');
            }
            if (!result) {
                return res.status(404).send('Order not found');
            }

            // Render invoice without ownership checks
            return res.render('invoice', { order: result.order, items: result.items || [], user: req.session.user });
        });
    },

    // Admin: update order status (unchanged behavior)
    updateStatus(req, res) {
        // require authenticated admin user
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const user = req.session.user;
        const isAdmin = Boolean(user.isAdmin || user.is_admin || user.role === 'admin' || user.username === 'admin');
        if (!isAdmin) return res.status(403).send('Forbidden');

        const orderId = parseInt(req.params.id, 10);
        if (Number.isNaN(orderId)) return res.status(400).send('Invalid order id');

        const status = (req.body.status || '').trim();
        const allowed = ['Pending', 'In-Progress', 'Completed'];
        if (!allowed.includes(status)) return res.status(400).send('Invalid status');

        Order.updateStatus(orderId, status, (err) => {
            if (err) {
                console.error('Order.updateStatus error:', err);
                return res.status(500).send('Database error');
            }
            return res.redirect('/manageOrders');
        });
    },

    // List orders for the logged-in user (uses getByUserId)
    listUserOrders(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const userId = req.session.user.id;

        Order.getByUserId(userId, (err, rows) => {
            if (err) {
                console.error('Order.getByUserId error:', err);
                return res.status(500).send('Database error');
            }

            const orders = Array.isArray(rows) ? rows : [];

            // If no orders, render immediately
            if (orders.length === 0) {
                return res.render('order_history', { orders: [], user: req.session.user });
            }

            // For each order, determine if the logged-in user has reviewed it
            let pending = orders.length;
            orders.forEach(o => {
                const oid = Number(o.id);
                Review.existsForOrder(oid, userId, (revErr, exists) => {
                    if (revErr) {
                        console.error('Review.existsForOrder error for order', oid, revErr);
                        o.reviewExists = false;
                    } else {
                        o.reviewExists = Boolean(exists);
                    }

                    pending--;
                    if (pending === 0) {
                        return res.render('order_history', { orders: orders, user: req.session.user });
                    }
                });
            });
        });
    },

    // orderHistory (alias)
    orderHistory(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const userId = req.session.user.id;

        Order.getByUserId(userId, (err, rows) => {
            if (err) {
                console.error('orderHistory error:', err);
                return res.status(500).send('Database error');
            }

            const orders = Array.isArray(rows) ? rows : [];

            if (orders.length === 0) {
                return res.render('order_history', { orders: [], user: req.session.user });
            }

            let pending = orders.length;
            orders.forEach(o => {
                const oid = Number(o.id);
                Review.existsForOrder(oid, userId, (revErr, exists) => {
                    if (revErr) {
                        console.error('Review.existsForOrder error for order', oid, revErr);
                        o.reviewExists = false;
                    } else {
                        o.reviewExists = Boolean(exists);
                    }

                    pending--;
                    if (pending === 0) {
                        return res.render('order_history', { orders: orders, user: req.session.user });
                    }
                });
            });
        });
    },

};

module.exports = OrderController;
