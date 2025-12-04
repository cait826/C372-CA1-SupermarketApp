const Review = require('../models/Review');

const ReviewController = {
  // GET /review/:orderId
  showForm(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to leave a review');
      return res.redirect('/login');
    }

    const orderId = Number(req.params.orderId);
    const userId = Number(req.session.user.id);

    // Validate orderId and userId
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).send('Invalid order id');
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).send('Invalid user id');
    }

    // Use the updated signature: existsForOrder(orderId, userId, callback)
    Review.existsForOrder(orderId, userId, (err, exists) => {
      if (err) {
        console.error('Review.existsForOrder error:', err);
        return res.status(500).send('Database error');
      }

      if (exists) {
        // If the user already reviewed this order, redirect to confirmation page
        req.flash('info', 'You have already reviewed this order.');
        return res.redirect(`/checkoutconfirm/${orderId}`);
      }

      // Otherwise render the review form and pass numeric ids to the view
      return res.render('review_form', { orderId, userId });
    });
  },

  // POST /review/:orderId
  submit(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to submit a review');
      return res.redirect('/login');
    }

    const orderId = req.params.orderId;
    const userId = req.session.user.id;
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || '').toString().trim();

    if (!orderId) {
      req.flash('error', 'Missing order id');
      return res.redirect('/order_history');
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      req.flash('error', 'Rating must be an integer between 1 and 5');
      return res.redirect(`/review/${orderId}`);
    }

    // Prevent duplicate review for the order
    Review.existsForOrder(Number(orderId), Number(userId), (err, exists) => {
      if (err) {
        console.error('Review.existsForOrder error:', err);
        return res.status(500).send('Database error');
      }

      if (exists) {
        req.flash('error', 'You have already reviewed this order.');
        return res.redirect('/order_history');
      }

      // Create review
      Review.create(Number(orderId), Number(userId), rating, comment, (createErr) => {
        if (createErr) {
          console.error('Review.create error:', createErr);
          req.flash('error', 'Failed to save review');
          return res.redirect('/order_history');
        }

        req.flash('success', 'Review submitted');
        return res.redirect('/order_history');
      });
    });
  },

  // GET /admin/reviews
  adminList(req, res) {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    const user = req.session.user;
    const isAdmin = Boolean(
      user.isAdmin || user.is_admin || user.role === 'admin' || user.username === 'admin'
    );
    if (!isAdmin) {
      req.flash('error', 'Access denied');
      return res.redirect('/login');
    }

    Review.getAll((err, rows) => {
      if (err) {
        console.error('Review.getAll error:', err);
        return res.status(500).send('Database error');
      }
      return res.render('manageReviews', { reviews: rows || [], user: req.session.user });
    });
  }
};

module.exports = ReviewController;