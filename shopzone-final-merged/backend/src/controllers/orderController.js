const pool = require('../config/db');

// POST /api/orders  — place order from cart
const placeOrder = async (req, res) => {
  const { address, phone } = req.body;
  if (!address || !phone) return res.status(400).json({ message: 'Address and phone required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get cart items
    const cartResult = await client.query(
      `SELECT c.quantity, p.id AS product_id, p.price, p.stock
       FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=$1`,
      [req.user.id]
    );
    if (!cartResult.rows.length) return res.status(400).json({ message: 'Cart is empty' });

    // Check stock
    for (const item of cartResult.rows) {
      if (item.stock < item.quantity)
        throw new Error(`Insufficient stock for product ${item.product_id}`);
    }

    // Calculate total
    const total = cartResult.rows.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (user_id,total_amount,address,phone) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, total, address, phone]
    );
    const order = orderResult.rows[0];

    // Insert order items + update stock
    for (const item of cartResult.rows) {
      await client.query(
        'INSERT INTO order_items (order_id,product_id,quantity,price) VALUES ($1,$2,$3,$4)',
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        'UPDATE products SET stock=stock-$1 WHERE id=$2',
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart WHERE user_id=$1', [req.user.id]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// GET /api/orders  — user's orders
const getOrders = async (req, res) => {
  try {
    const orders = await pool.query(
      'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!order.rows.length) return res.status(404).json({ message: 'Order not found' });

    const items = await pool.query(
      `SELECT oi.*, p.name, p.image_url FROM order_items oi
       JOIN products p ON oi.product_id=p.id WHERE oi.order_id=$1`,
      [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/orders/:id/status (admin)
const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending','processing','shipped','delivered','cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const result = await pool.query(
      'UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { placeOrder, getOrders, getOrder, updateOrderStatus };
