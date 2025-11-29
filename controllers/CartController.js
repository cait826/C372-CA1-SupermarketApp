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

        Cart.getAllByUser(userId, (err, rows) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send('Database error');
            }

            // Normalize fields expected by views
            const items = (rows || []).map(r => ({
                cartId: r.cartId,
                productId: r.productId,
                productName: r.productName,
                image: r.image,
                price: Number(r.price || 0),
                quantity: Number(r.quantity || 0)
            }));

            const total = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);

            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: false
            });
        });
    },

    // Update quantity
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

    // Remove item
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

    // Clear cart
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

    // Review order (uses cart.ejs with reviewMode=true)
    reviewOrder(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.getAllByUser(userId, (err, rows) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send('Database error');
            }

            const items = (rows || []).map(r => ({
                cartId: r.cartId,
                productId: r.productId,
                productName: r.productName,
                image: r.image,
                price: Number(r.price || 0),
                quantity: Number(r.quantity || 0)
            }));

            const total = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);

            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: true
            });
        });
    },

    // GET /checkout → show checkout confirmation page in REVIEW mode only (orderCompleted = false)
    checkoutPage(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const userId = req.session.user.id;

        Cart.getAllByUser(userId, (err, rows) => {
            if (err) {
                console.error('Cart.getAllByUser error:', err);
                return res.status(500).send("Database error");
            }

            const items = (rows || []).map(r => ({
                cartId: r.cartId,
                productId: r.productId,
                productName: r.productName,
                image: r.image,
                price: Number(r.price || 0),
                quantity: Number(r.quantity || 0)
            }));

            const total = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);

            // IMPORTANT: this controller only renders the REVIEW mode of checkoutconfirm.
            // The completed mode (orderCompleted = true) is rendered by OrderController after order creation.
            res.render("checkoutconfirm", {
                items,
                total,
                user: req.session.user,
                orderCompleted: false,
                order: null
            });
        });
    },

    // Confirm order simply forwards user to checkout flow (OrderController handles creation)
    confirmOrder(req, res) {
        if (!req.session.user) return res.status(401).send('Unauthorized');

        const confirmed = (req.body.confirm === 'yes' || req.body.confirm === 'true' || req.body.confirm === true);

        if (confirmed) {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
                return res.json({ success: true, redirect: '/checkout' });
            }
            return res.redirect('/checkout');
        } else {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
                return res.json({ success: false, redirect: '/cart' });
            }
            return res.redirect('/cart');
        }
    }
};

module.exports = CartController;


