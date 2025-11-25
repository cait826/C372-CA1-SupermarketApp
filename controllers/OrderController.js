const Cart = require('../models/Cart');
const Order = require('../models/Order');

const OrderController = {

    // Checkout: convert cart → order + order_items
    checkout(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.getAllByUser(userId, (err, items) => {
            if (err) {
                console.error('Cart.getAllByUser (checkout) error:', err);
                return res.status(500).send('Database error');
            }
            if (!items || items.length === 0) {
                return res.redirect('/cart');
            }

            // Map into order items format
            const orderItems = items.map(it => ({
                productId: it.productId,
                quantity: it.quantity,
                price: it.price
            }));

            Order.createOrder(userId, orderItems, (err2, orderId) => {
                if (err2) {
                    console.error('Order.createOrder error:', err2);
                    return res.status(500).send('Database error');
                }

                // Clear cart after successful order
                Cart.clearByUser(userId, (err3) => {
                    if (err3) {
                        console.error('Cart.clearByUser error:', err3);
                        // Still redirect to invoice even if cart failed to clear
                    }
                    res.redirect(`/invoice/${orderId}`);
                });
            });
        });
    },

    // User invoice page (also reused by admin view single order)
    viewOrder(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const orderId = parseInt(req.params.id, 10);

        Order.getById(orderId, (err, data) => {
            if (err) {
                console.error('Order.getById error:', err);
                return res.status(500).send('Database error');
            }
            if (!data) {
                return res.status(404).send('Order not found');
            }

            res.render('invoice', {
                order: data.order,
                items: data.items,
                user: req.session.user
            });
        });
    },

    // Admin: list all orders
    listOrders(req, res) {
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).send('Forbidden');
        }

        Order.getAll((err, rows) => {
            if (err) {
                console.error('Order.getAll error:', err);
                return res.status(500).send('Database error');
            }

            res.render('manageOrders', {
                orders: rows,
                user: req.session.user
            });
        });
    },

    // Admin: update status
    updateStatus(req, res) {
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).send('Forbidden');
        }

        const orderId = parseInt(req.params.id, 10);
        const status = req.body.status || 'Pending';

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
