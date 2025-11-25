const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();
const connection = require('./db');

// Import MVC controllers & models
const productController = require('./controllers/ProductController');
const userController = require('./controllers/UserController');
const Product = require('./models/Product');
const cartController = require('./controllers/CartController');
const orderController = require('./controllers/OrderController');


// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/login');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes

// Home
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Admin inventory listing - handled by UserController (admin checks inside app middleware too)
app.get('/inventory', checkAuthenticated, checkAdmin, userController.inventory);

// Registration & Login (still use existing connection)
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'admin')
                res.redirect('/admin');
            else
                res.redirect('/shopping');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Shopping listing - use ProductController to render appropriate view
app.get('/shopping', checkAuthenticated, productController.list);

// Search by name
app.get("/products/search", checkAuthenticated, productController.search);

// Filter by category
app.get('/products', checkAuthenticated, productController.filterByCategory);

// Cart routes - use CartController
// Add item to cart (product id in params)
app.post('/add-to-cart/:id', checkAuthenticated, cartController.add);

// View cart
app.get('/cart', checkAuthenticated, cartController.viewCart);

// Update item quantity (cart item id)
app.post('/cart/update/:id', checkAuthenticated, cartController.updateQuantity);

// Remove one item
app.post('/cart/remove/:id', checkAuthenticated, cartController.removeItem);

// Clear all items from user's cart
app.post('/cart/clear', checkAuthenticated, cartController.clearCart);

// Review order (confirmation page)
app.get('/cart/review', checkAuthenticated, cartController.reviewOrder);

// Confirm order (yes/no)
app.post('/cart/confirm', checkAuthenticated, cartController.confirmOrder);

// Checkout page (GET)
app.get('/checkout', checkAuthenticated, (req, res) => {
    const Cart = require('./models/Cart');
    const userId = req.session.user.id;

    Cart.getAllByUser(userId, (err, items) => {
        if (err) {
            console.error("Checkout GET error:", err);
            return res.status(500).send("Database error");
        }

        const total = items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        res.render('checkout', {
            items,
            total,
            user: req.session.user
        });
    });
});
// Checkout processing (POST)

app.post('/checkout', checkAuthenticated, orderController.checkout);

// User invoice page
app.get('/invoice/:id', checkAuthenticated, orderController.viewOrder);


// Product details - use ProductController
app.get('/product/:id', checkAuthenticated, productController.getById);

// Admin: show add product form (handled by UserController)
app.get('/addProduct', checkAuthenticated, checkAdmin, userController.addProductForm);

// Admin: handle add product (with multer) via UserController
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), userController.addProduct);

// Admin: show update product form (ProductController handles retrieval & render)
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, productController.updateForm);

// Admin: handle update product (with multer) via ProductController
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), productController.update);

// Admin: delete product via ProductController
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, productController.delete);

// Admin: manage users (list)
app.get('/manageuser', checkAuthenticated, checkAdmin, userController.listUsers);

// Admin: promote a user to admin (use POST)
app.post('/promoteUser/:id', checkAuthenticated, checkAdmin, userController.promoteUser);

// Admin: delete a user (use POST)
app.post('/deleteUser/:id', checkAuthenticated, checkAdmin, userController.deleteUser);

//Admin: add user form
app.post('/addUser', checkAuthenticated, checkAdmin, userController.addUser);

// List all orders for admin
app.get('/admin/orders', checkAuthenticated, checkAdmin, orderController.listOrders);

// Admin: view single order & items
app.get('/admin/orders/:id', checkAuthenticated, checkAdmin, orderController.viewOrder);

// Admin: update order status
app.post('/admin/orders/:id/status', checkAuthenticated, checkAdmin, orderController.updateStatus);


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
