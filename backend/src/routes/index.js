const router  = require('express').Router();
const auth    = require('../middleware/auth');
const isAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin only' });

const authCtrl    = require('../controllers/authController');
const productCtrl = require('../controllers/productController');
const cartCtrl    = require('../controllers/cartController');
const orderCtrl   = require('../controllers/orderController');

// Auth
router.post('/auth/register', authCtrl.register);
router.post('/auth/login',    authCtrl.login);
router.get ('/auth/me',       auth, authCtrl.me);

// Categories (public)
router.get('/categories', productCtrl.getCategories);

// Products (public)
router.get   ('/products',           productCtrl.getProducts);
router.get   ('/products/:id',       productCtrl.getProductById);
router.post  ('/products/:id/reviews', auth, productCtrl.addReview);

// Products (admin)
router.post  ('/products',     auth, isAdmin, productCtrl.createProduct);
router.put   ('/products/:id', auth, isAdmin, productCtrl.updateProduct);
router.delete('/products/:id', auth, isAdmin, productCtrl.deleteProduct);

// Cart (auth)
router.get   ('/cart',     auth, cartCtrl.getCart);
router.post  ('/cart',     auth, cartCtrl.addToCart);
router.put   ('/cart/:id', auth, cartCtrl.updateCart);
router.delete('/cart/:id', auth, cartCtrl.removeFromCart);
router.delete('/cart',     auth, cartCtrl.clearCart);

// Orders (auth)
router.post('/orders',              auth, orderCtrl.placeOrder);
router.get ('/orders',              auth, orderCtrl.getMyOrders);
router.get ('/orders/:id',          auth, orderCtrl.getOrderById);
router.put ('/orders/:id/status',   auth, isAdmin, orderCtrl.updateOrderStatus);

// Admin dashboard
router.get('/admin/stats', auth, isAdmin, async (req, res) => {
  const pool = require('../config/db');
  try {
    const [users, products, orders, revenue, recentOrders] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role=\'customer\''),
      pool.query('SELECT COUNT(*) FROM products'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status != \'cancelled\''),
      pool.query(`SELECT o.*, u.name as user_name, u.email
        FROM orders o JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC LIMIT 5`),
    ]);
    res.json({
      users:        parseInt(users.rows[0].count),
      products:     parseInt(products.rows[0].count),
      orders:       parseInt(orders.rows[0].count),
      revenue:      parseFloat(revenue.rows[0].total),
      recentOrders: recentOrders.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

module.exports = router;
