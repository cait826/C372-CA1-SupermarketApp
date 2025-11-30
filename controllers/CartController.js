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

    // Render cart.ejs in EDITABLE mode (reviewMode: false)
    viewCart(req, res) {
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

            // Render the editable cart page (cart.ejs)
            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: false
            });
        });
    },

    // Render cart.ejs in READ-ONLY review mode (reviewMode: true)
    // This is used when the user wants to preview the cart but still on the cart template.
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

            // Render the cart template but in review/read-only mode
            res.render('cart', {
                items,
                total,
                user: req.session.user,
                reviewMode: true
            });
        });
    },

    // Render checkout.ejs (non-editable preview before order creation)
    checkoutPage(req, res) {
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

            // Render the read-only checkout preview
            res.render('checkout', {
                items,
                total,
                user: req.session.user
            });
        });
    },

    // Legacy/read-only review page (renders reviewcart.ejs) - kept for compatibility
    reviewCart(req, res) {
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

            res.render('reviewcart', {
                items,
                total,
                user: req.session.user,
                reviewMode: true
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
    }

    // NOTE: All checkout/order creation logic is handled by OrderController.
};

module.exports = CartController;


