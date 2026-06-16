const pool = require('../config/db');

// GET /api/products — list with search, category filter, pagination, sorting
exports.getProducts = async (req, res) => {
  try {
    const { search = '', category = '', page = 1, limit = 12, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSort  = ['price', 'name', 'created_at', 'rating'];
    const allowedOrder = ['ASC', 'DESC'];
    const safeSort  = allowedSort.includes(sort)   ? sort  : 'created_at';
    const safeOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    let conditions = [];
    let params     = [];
    let i          = 1;

    if (search)   { conditions.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (category) { conditions.push(`c.slug = $${i}`); params.push(category); i++; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.${safeSort} ${safeOrder}
      LIMIT $${i} OFFSET $${i + 1}
    `, params);

    res.json({
      products:   result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug,
        COALESCE(
          json_agg(json_build_object('rating', r.rating, 'comment', r.comment, 'user_name', u.name, 'created_at', r.created_at))
          FILTER (WHERE r.id IS NOT NULL), '[]'
        ) AS reviews
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON r.product_id = p.id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE p.id = $1
      GROUP BY p.id, c.name, c.slug
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
};

// POST /api/products  (admin)
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, image_url, category_id } = req.body;
    if (!name || !price) return res.status(400).json({ message: 'Name and price are required' });

    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, image_url, category_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description, price, stock || 0, image_url, category_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// PUT /api/products/:id  (admin)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, stock, image_url, category_id } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, stock=$4,
       image_url=$5, category_id=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, description, price, stock, image_url, category_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// DELETE /api/products/:id  (admin)
exports.deleteProduct = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// POST /api/products/:id/reviews  (auth)
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });

    await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, product_id) DO UPDATE SET rating=$3, comment=$4`,
      [req.user.id, req.params.id, rating, comment]
    );
    // Update product avg rating
    await pool.query(
      `UPDATE products SET rating = (SELECT AVG(rating) FROM reviews WHERE product_id=$1) WHERE id=$1`,
      [req.params.id]
    );
    res.json({ message: 'Review submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
};

// GET /api/categories
exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};
