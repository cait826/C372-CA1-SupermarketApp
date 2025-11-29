const Cart = require('../models/Cart');
const Order = require('../models/Order');

const OrderController = {
    // POST /checkout -> create order from current user's cart, insert order items, clear cart
    checkout(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        // 1) Get cart items for user
        Cart.getAllByUser(userId, (err, items) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send('Database error');
            }

            if (!items || items.length === 0) {
                return res.redirect('/cart');
            }

            // 2) Build orderItems and calculate total
            const orderItems = items.map(it => ({
                productId: it.productId || it.products_id,
                quantity: Number(it.quantity) || 0,
                priceEach: Number(it.price || it.price_each || 0)
            }));

            const calculatedTotal = orderItems.reduce((sum, it) => sum + (it.priceEach * it.quantity), 0);

            // 3) Create order (model handles transaction & inserting order_items)
            Order.createOrder(userId, orderItems, (createErr, createResult, maybeTotal) => {
                if (createErr) {
                    console.error('Order.createOrder error:', createErr);
                    return res.status(500).send('Database error');
                }

                // 4) Normalize returned order id and total from model result
                let orderId = null;
                let totalAmount = calculatedTotal;

                if (createResult && typeof createResult === 'object') {
                    orderId = createResult.orderId || createResult.insertId || createResult.id || null;
                    totalAmount = createResult.total || createResult.total_price || maybeTotal || totalAmount;
                } else if (typeof createResult === 'number') {
                    orderId = createResult;
                    totalAmount = maybeTotal || totalAmount;
                } else if (maybeTotal && typeof maybeTotal === 'number') {
                    totalAmount = maybeTotal;
                }

                if (!orderId) {
                    console.error('OrderController.checkout: missing orderId from createResult', createResult, maybeTotal);
                    return res.status(500).send('Failed to create order (no order id returned)');
                }

                // 5) Clear user's cart then render confirmation page WITH order details and purchased items
                Cart.clearByUser(userId, (clearErr) => {
                    if (clearErr) console.error('Failed to clear cart after order:', clearErr);

                    // Pass items (productName, image, price, quantity) so checkoutconfirm.ejs can render them
                    return res.render('checkoutconfirm', {
                        orderCompleted: true,
                        order: { id: orderId, total_price: totalAmount },
                        items: items,
                        total: totalAmount,
                        user: req.session.user
                    });
                });
            });
        });
    },

    // Admin: list all orders
    listOrders(req, res) {
        Order.getAll((err, rows) => {
            if (err) {
                console.error('Order.getAll error:', err);
                return res.status(500).send('Database error');
            }
            res.render('manageOrder', { orders: rows, user: req.session.user });
        });
    },

    // View single order (user or admin)
    viewOrder(req, res) {
        const orderId = parseInt(req.params.id, 10);
        if (Number.isNaN(orderId)) return res.status(400).send('Invalid order id');

        Order.getById(orderId, (err, order) => {
            if (err) {
                console.error('Order.getById error:', err);
                return res.status(500).send('Database error');
            }
            if (!order) return res.status(404).send('Order not found');

            const items = order.items || [];
            res.render('invoice', { order, items, user: req.session.user });
        });
    },

    // Admin: update order status (Pending, In-Progress, Completed)
    updateStatus(req, res) {
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
            res.redirect('/admin/orders');
        });
    }
};

module.exports = OrderController;
