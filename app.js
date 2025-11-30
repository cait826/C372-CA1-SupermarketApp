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
const User = require('./models/User');
const Order = require('./models/Order');
const Cart = require('./models/Cart');
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
// enable static files
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

// -----------------------
// --- PUBLIC ROUTES ---
// -----------------------

// Home
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Registration & Login
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
            if (req.session.user.role == 'admin')
                res.redirect('/admin');
            else
                res.redirect('/shopping');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// -----------------------------
// --- USER SHOPPING ROUTES ---
// -----------------------------

// Shopping listing & product details
app.get('/shopping', checkAuthenticated, productController.list);
app.get('/product/:id', checkAuthenticated, productController.getById);
app.get('/products/search', checkAuthenticated, productController.search);
app.get('/products', checkAuthenticated, productController.filterByCategory);

// Cart & review flow
app.post('/add-to-cart/:id', checkAuthenticated, cartController.add);
app.get('/cart', checkAuthenticated, cartController.viewCart);
app.post('/cart/update/:id', checkAuthenticated, cartController.updateQuantity);
app.post('/cart/remove/:id', checkAuthenticated, cartController.removeItem);
app.get('/cart/clear', checkAuthenticated, cartController.clearCart);

// Read-only review page (before final checkout)
app.get('/reviewcart', checkAuthenticated, cartController.reviewCart);

// Checkout preview (read-only) - user confirms to create order
app.get('/checkout', checkAuthenticated, cartController.checkoutPage);

// Finalize checkout -> create order, insert order_items, clear cart, then redirect to confirmation
app.post('/checkoutconfirm', checkAuthenticated, orderController.confirmCheckout);

// Confirmation page showing saved order
app.get('/checkoutconfirm/:orderId', checkAuthenticated, orderController.showCheckoutConfirm);

// Invoice view for a specific order
app.get('/invoice/:orderId', checkAuthenticated, orderController.viewOrder);

// -----------------------
// --- ADMIN ROUTES ---
// -----------------------

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

// Admin inventory & product management
app.get('/inventory', checkAuthenticated, checkAdmin, userController.inventory);
app.get('/addProduct', checkAuthenticated, checkAdmin, userController.addProductForm);
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), userController.addProduct);
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, productController.updateForm);
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), productController.update);
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, productController.delete);

// Admin user management
app.get('/manageuser', checkAuthenticated, checkAdmin, userController.listUsers);
app.post('/promoteUser/:id', checkAuthenticated, checkAdmin, userController.promoteUser);
app.post('/deleteUser/:id', checkAuthenticated, checkAdmin, userController.deleteUser);
app.post('/addUser', checkAuthenticated, checkAdmin, userController.addUser);

// Admin order management
app.get('/manageOrders', checkAuthenticated, checkAdmin, orderController.listOrders);
app.get('/manageOrders/:id', checkAuthenticated, checkAdmin, orderController.viewOrder);
app.post('/manageOrders/:id/status', checkAuthenticated, checkAdmin, orderController.updateStatus);

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
