// ...existing code...
const Product = require('../models/Product');
const User = require('../models/User');

function isAdmin(req) {
    return req.session.user && req.session.user.role === 'admin';
}

const UserController = {

    // View product inventory (admin only)
    inventory: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');

        Product.getAll((err, products) => {
            if (err) return res.status(500).send('Database error');
            res.render('inventory', { products, user: req.session.user });
        });
    },

    // Render add product form (admin only)
    addProductForm: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');
        res.render('addProduct', { user: req.session.user });
    },

    // Add a new product (admin only) - expects form data and optional file (req.file)
    addProduct: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');

        const newProduct = {
            productName: req.body.name,
            quantity: req.body.quantity,
            price: req.body.price,
            image: req.file ? req.file.filename : (req.body.image || null)
        };

        Product.add(newProduct, (err) => {
            if (err) return res.status(500).send('Database error');
            res.redirect('/inventory');
        });
    },

    // View and manage all users (admin only)
    listUsers: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');

        User.getAll((err, users) => {
            if (err) return res.status(500).send('Database error');
            res.render('manageuser', { users, user: req.session.user });
        });
    },

    // Promote a user to admin (admin only)
    promoteUser: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');

        const id = req.params.id;
        User.getById(id, (err, existingUser) => {
            if (err) return res.status(500).send('Database error');
            if (!existingUser) return res.status(404).send('User not found');

            const updatedUser = {
                username: existingUser.username,
                email: existingUser.email,
                password: existingUser.password,
                address: existingUser.address,
                contact: existingUser.contact,
                role: 'admin'
            };

            User.update(id, updatedUser, (err) => {
                if (err) return res.status(500).send('Database error');
                res.redirect('/manageuser');
            });
        });
    },

    // Delete a user (admin only)
    deleteUser: function (req, res) {
        if (!isAdmin(req)) return res.status(403).send('Forbidden');

        const id = req.params.id;
        User.delete(id, (err) => {
            if (err) return res.status(500).send('Database error');
            res.redirect('/manageuser');
        });
    }
};

module.exports = UserController;
// ...existing code...