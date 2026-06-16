const pool = require('../config/db');

// GET /api/cart
const getCart = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.quantity, p.id AS product_id, p.name, p.price, p.image_url,
       (p.price * c.quantity) AS subtotal
       FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=$1`,
      [req.user.id]
    );
    const total = result.rows.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    res.json({ items: result.rows, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/cart
const addToCart = async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ message: 'product_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO cart (user_id, product_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart.quantity + $3 RETURNING *`,
      [req.user.id, product_id, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/cart/:id
const updateCart = async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ message: 'Valid quantity required' });
  try {
    const result = await pool.query(
      'UPDATE cart SET quantity=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
      [quantity, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Cart item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/cart/:id
const removeFromCart = async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getCart, addToCart, updateCart, removeFromCart };
