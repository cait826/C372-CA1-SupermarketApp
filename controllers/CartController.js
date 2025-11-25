const Cart = require('../models/Cart');

const CartController = {

    // Add product to cart
    add(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const item = {
            userId: req.session.user.id,
            productId: parseInt(req.params.id, 10),
            quantity: parseInt(req.body.quantity, 10) || 1
        };

        Cart.add(item, (err) => {
            if (err) {
                console.error('Cart.add error:', err);
                return res.status(500).send('Database error');
            }
            res.redirect('/cart');
        });
    },

    // View cart
    viewCart(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.getAllByUser(userId, (err, items) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send('Database error');
            }

            const total = items.reduce(
                (sum, it) => sum + (Number(it.price) * Number(it.quantity)),
                0
            );

            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: false
            });
        });
    },

    // Update quantity for a cart item
    updateQuantity(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const cartId = parseInt(req.params.id, 10);
        const qty = req.body.quantity;

        Cart.updateQuantity(cartId, qty, (err) => {
            if (err) {
                console.error('Cart.updateQuantity error:', err);
                return res.status(500).send('Database error');
            }
            res.redirect('/cart');
        });
    },

    // Remove a single cart item
    removeItem(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const cartId = parseInt(req.params.id, 10);
        Cart.remove(cartId, (err) => {
            if (err) {
                console.error('Cart.remove error:', err);
                return res.status(500).send('Database error');
            }
            res.redirect('/cart');
        });
    },

    // Clear entire cart
    clearCart(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.clearByUser(userId, (err) => {
            if (err) {
                console.error('Cart.clearByUser error:', err);
                return res.status(500).send('Database error');
            }
            res.redirect('/cart');
        });
    },

    // Show review order page (uses same cart.ejs with reviewMode true)
    reviewOrder(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.getAllByUser(userId, (err, items) => {
            if (err) {
                console.error('Cart.getAllByUser (review) error:', err);
                return res.status(500).send('Database error');
            }

            const total = items.reduce(
                (sum, it) => sum + (Number(it.price) * Number(it.quantity)),
                0
            );

            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: true
            });
        });
    },

    // Confirm order – if yes → /checkout, if no → /cart
    confirmOrder(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const confirmed = req.body.confirm === 'yes';

        if (confirmed) {
            return res.redirect('/checkout');
        } else {
            return res.redirect('/cart');
        }
    }
};

module.exports = CartController;


