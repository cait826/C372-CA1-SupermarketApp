const Cart = require('../models/Cart');
const Order = require('../models/Order');

const OrderController = {
    // POST /checkoutconfirm -> create order from cart, insert items, clear cart, then redirect to confirmation page
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

                    // Clear user's cart and redirect to confirmation page
                    Cart.clearByUser(userId, (clearErr) => {
                        if (clearErr) console.error('Cart.clearByUser error after order:', clearErr);
                        return res.redirect(`/checkoutconfirm/${orderId}`);
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

            return res.render('checkoutconfirm', {
                orderCompleted: true,
                order: orderObj,
                items: items,
                total: total,
                user: req.session.user
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

    // View single order (user or admin) — kept as-is
    viewOrder(req, res) {
        const orderIdParam = req.params.orderId || req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).send('Invalid order id');
        }

        Order.getById(orderId, (err, order) => {
            if (err) {
                console.error('Order.getById error:', err);
                return res.status(500).send('Database error');
            }
            if (!order) return res.status(404).send('Order not found');

            // order may already be normalized by model as { order, items }
            res.render('invoice', { order: order.order || order, items: order.items || [], user: req.session.user });
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
    }
};

module.exports = OrderController;
