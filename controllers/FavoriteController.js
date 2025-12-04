const Favorite = require('../models/Favorite');

const FavoriteController = {
  add(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to add favorites');
      return res.redirect('/login');
    }

    const userId = Number(req.session.user.id);
    const productId = Number(req.params.productId);

    if (!Number.isInteger(userId) || !Number.isInteger(productId)) {
      return res.status(400).send('Invalid parameters');
    }

    Favorite.addFavorite(userId, productId, (err) => {
      if (err) {
        console.error('Favorite.addFavorite error:', err);
        req.flash('error', 'Failed to add favorite');
      }
      return res.redirect('/shopping');
    });
  },

  remove(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to remove favorites');
      return res.redirect('/login');
    }

    const userId = Number(req.session.user.id);
    const productId = Number(req.params.productId);

    if (!Number.isInteger(userId) || !Number.isInteger(productId)) {
      return res.status(400).send('Invalid parameters');
    }

    Favorite.removeFavorite(userId, productId, (err) => {
      if (err) {
        console.error('Favorite.removeFavorite error:', err);
        req.flash('error', 'Failed to remove favorite');
      }
      return res.redirect('/favorites');
    });
  },

  list(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to view favorites');
      return res.redirect('/login');
    }

    const userId = Number(req.session.user.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).send('Invalid user');
    }

    Favorite.listFavorites(userId, (err, products) => {
      if (err) {
        console.error('Favorite.listFavorites error:', err);
        return res.status(500).send('Database error');
      }
      return res.render('favorites', { products: products || [], user: req.session.user });
    });
  }
};

module.exports = FavoriteController;