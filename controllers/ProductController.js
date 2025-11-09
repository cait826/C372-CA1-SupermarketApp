const Product = require('../models/Product');

const ProductController = {
    // List all products and render the appropriate view
    list: function (req, res) {
        Product.getAll((err, products) => {
            if (err) return res.status(500).send('Database error');

            //Detect role and render correct EJS view
            if (req.session.user && req.session.user.role === 'admin') {
                // Admin view → inventory.ejs
                res.render('inventory', { products, user: req.session.user });
            } else {
                // User or guest view → index.ejs
                res.render('shopping', { products, user: req.session.user || null });
            }
        });
    },

    // Get a single product by ID and render product view
    getById: function (req, res) {
        const id = req.params.id;
        Product.getById(id, (err, product) => {
            if (err) return res.status(500).send('Database error');
            if (!product) return res.status(404).send('Product not found');
            res.render('product', { product });
        });
    },

    // Add a new product
    add: function (req, res) {
        const newProduct = {
            productName: req.body.name,
            quantity: req.body.quantity,
            price: req.body.price,
            image: req.file ? req.file.filename : (req.body.image || null)
        };

        Product.add(newProduct, (err, result) => {
            if (err) return res.status(500).send('Database error'+ err.message);
            //Redirect back to inventory after adding
            res.redirect('/inventory');
        });
    },

    // Update a product
    update: function (req, res) {
        const id = req.params.id;
        const updatedProduct = {
            productName: req.body.name,
            quantity: req.body.quantity,
            price: req.body.price,
            image: req.file ? req.file.filename : req.body.currentImage 
        };

        Product.update(id, updatedProduct, (err, result) => {
            if (err) { 
                console.error("Update error:", err);
                return res.status(500).send('Database error' + err.message);
            }
            console.log("Updated Product:", updatedProduct);
            res.redirect('/inventory');
        });
    },

    updateForm: (req, res) => {
        const id = req.params.id;
        Product.getById(id, (err, product) => {
            if (err) {
                return res.status(500).send('Error retrieving product');
            }
            if (!product) {
                return res.status(404).send('Product not found');
            }

            res.render('updateProduct', { product });
        });
    },

    // Delete a product
    delete: function (req, res) {
        const id = req.params.id;
        Product.delete(id, (err, result) => {
            if (err) return res.status(500).send('Database error');
            //Redirect to inventory (not home)
            res.redirect('/inventory');
        });
    }, 

    search: function (req, res) {
        const query = req.query.q || '';
        if (!query.trim()) {
            return res.redirect('/'); // Redirect to home if query is empty
        }
        Product.search(query, (err, products) => {
            if (err) return res.status(500).send('Database error');

            if (req.session.user && req.session.user.role === 'admin') {
                res.render('inventory', { products, user: req.session.user, searchQuery: query });
            } else {
                res.render('shopping', { products, user: req.session.user || null, searchQuery: query});
            }
        });
    }
};

module.exports = ProductController;
