const Product = require('../models/Product');
const Review = require('../models/Review');
const Favorite = require('../models/Favorite');

const ProductController = {
    // List all products and render the appropriate view
    list: function (req, res) {
        Product.getAll((err, products) => {
            if (err) return res.status(500).send('Database error');

            const prods = Array.isArray(products) ? products : [];

            // For each product, load avg rating and favorite count
            const tasks = prods.map(p => {
                return new Promise((resolve) => {
                    // default values
                    p.avgRating = 0;
                    p.reviewCount = 0;
                    p.favoriteCount = 0;

                    Review.getAverageRating(p.id, (rErr, avgRes) => {
                        if (!rErr && avgRes) {
                            p.avgRating = Number(avgRes.avgRating) || 0;
                            p.reviewCount = Number(avgRes.reviewCount) || 0;
                        }

                        Favorite.countFavorites(p.id, (fErr, total) => {
                            p.favoriteCount = (!fErr && typeof total === 'number') ? total : 0;
                            resolve();
                        });
                    });
                });
            });

            Promise.all(tasks)
                .then(() => {
                    const isAdmin = req.session && req.session.user && req.session.user.role === 'admin';
                    if (isAdmin) {
                        res.render('inventory', { products: prods, user: req.session.user });
                    } else {
                        res.render('shopping', { products: prods, user: req.session.user || null });
                    }
                })
                .catch((e) => {
                    console.error('Error loading product meta:', e);
                    const isAdmin = req.session && req.session.user && req.session.user.role === 'admin';
                    if (isAdmin) {
                        res.render('inventory', { products: prods, user: req.session.user });
                    } else {
                        res.render('shopping', { products: prods, user: req.session.user || null });
                    }
                });
        });
    },

    // Get a single product by ID and render product view
    getById: function (req, res) {
        const id = req.params.id;
        Product.getById(id, (err, product) => {
            if (err) return res.status(500).send('Database error');
            if (!product) return res.status(404).send('Product not found');

            // load avg rating and favorite count then render
            product.avgRating = 0;
            product.reviewCount = 0;
            product.favoriteCount = 0;

            Review.getAverageRating(product.id, (rErr, avgRes) => {
                if (!rErr && avgRes) {
                    product.avgRating = Number(avgRes.avgRating) || 0;
                    product.reviewCount = Number(avgRes.reviewCount) || 0;
                }

                Favorite.countFavorites(product.id, (fErr, total) => {
                    product.favoriteCount = (!fErr && typeof total === 'number') ? total : 0;
                    return res.render('product', { product, user: req.session.user || null });
                });
            });
        });
    },

    // Add a new product
    add: function (req, res) {
        const newProduct = {
            productName: req.body.name,
            quantity: req.body.quantity,
            price: req.body.price,
            image: req.file ? req.file.filename : (req.body.image || null),
            category: req.body.category
        };

        Product.add(newProduct, (err, result) => {
            if (err) return res.status(500).send('Database error' + err.message);
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
            category: req.body.category,
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

            res.render('updateProduct', { product, user: req.session.user || null });
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

    // Filter products by category (reads req.query.category). If no category provided, returns all products.
    filterByCategory: function (req, res) {
        const category = (req.query.category || '').trim();
        const isAdmin = req.session && req.session.user && req.session.user.role === 'admin';

        if (!category || category === 'All') {
            Product.getAll((err, products) => {
                if (err) return res.status(500).send('Database error');
                if (isAdmin) {
                    res.render('inventory', { products, user: req.session.user, selectedCategory: 'All' });
                } else {
                    res.render('shopping', { products, user: req.session.user || null, selectedCategory: 'All' });
                }
            });
            return;
        }

        Product.getByCategory(category, (err, products) => {
            if (err) return res.status(500).send('Database error');
            if (isAdmin) {
                res.render('inventory', { products, user: req.session.user, selectedCategory: category });
            } else {
                res.render('shopping', { products, user: req.session.user || null, selectedCategory: category });
            }
        });
    },

    search: function (req, res) {
        const query = req.query.q || '';
        if (!query.trim()) {
            return res.redirect('/'); // Redirect to home if query is empty
        }
        Product.search(query, (err, products) => {
            if (err) return res.status(500).send('Database error');

            const isAdmin = req.session && req.session.user && req.session.user.role === 'admin';
            if (isAdmin) {
                res.render('inventory', { products, user: req.session.user, searchQuery: query });
            } else {
                res.render('shopping', { products, user: req.session.user || null, searchQuery: query });
            }
        });
    }
};

module.exports = ProductController;
