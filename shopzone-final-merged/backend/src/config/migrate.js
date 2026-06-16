require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20) DEFAULT 'customer',
        created_at  TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS categories (
        id    SERIAL PRIMARY KEY,
        name  VARCHAR(100) NOT NULL,
        slug  VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(200) NOT NULL,
        description  TEXT,
        price        DECIMAL(10,2) NOT NULL,
        stock        INTEGER DEFAULT 0,
        image_url    VARCHAR(500),
        rating       DECIMAL(3,2) DEFAULT 4.0,
        category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS orders (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status       VARCHAR(50) DEFAULT 'pending',
        address      TEXT,
        phone        VARCHAR(20),
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id         SERIAL PRIMARY KEY,
        order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity   INTEGER NOT NULL,
        price      DECIMAL(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cart (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity   INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment    TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );
    `);

    await client.query(`
      INSERT INTO categories (name, slug) VALUES
        ('Electronics',   'electronics'),
        ('Clothing',       'clothing'),
        ('Books',          'books'),
        ('Home & Kitchen', 'home-kitchen'),
        ('Sports',         'sports')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Fix 1: Real Unsplash image URLs so product images show properly
    await client.query(`
      INSERT INTO products (name, description, price, stock, image_url, rating, category_id) VALUES
        ('Wireless Headphones',
         'Premium noise-cancelling headphones with 30hr battery life and foldable design. Crystal-clear audio with deep bass.',
         2999.00, 50,
         'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
         4.5, 1),
        ('Running Shoes',
         'Lightweight breathable running shoes with responsive foam cushioning. Ideal for road and trail running.',
         1499.00, 100,
         'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
         4.3, 2),
        ('JavaScript: The Good Parts',
         'Complete guide to modern JavaScript by Douglas Crockford. Covers ES6+, async/await, closures and more.',
         599.00, 30,
         'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop',
         4.7, 3),
        ('Coffee Maker Pro',
         'Automatic drip coffee maker — 12-cup capacity, programmable timer, built-in grinder. Brews perfect coffee every time.',
         3499.00, 25,
         'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop',
         4.4, 4),
        ('Yoga Mat Premium',
         'Non-slip premium yoga mat, 6mm thickness, eco-friendly TPE material. Includes carry strap.',
         799.00, 75,
         'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=400&fit=crop',
         4.6, 5),
        ('Smart Watch Series X',
         'Fitness tracking smartwatch with GPS, heart rate monitor, SpO2 sensor, 7-day battery. Water resistant 50m.',
         5999.00, 40,
         'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
         4.8, 1),
        ('Denim Jacket',
         'Classic slim-fit denim jacket, available in multiple washes. 100% cotton denim, machine washable.',
         1999.00, 60,
         'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=400&h=400&fit=crop',
         4.2, 2),
        ('Bluetooth Speaker',
         '360-degree surround sound portable speaker. 12hr battery, IPX7 waterproof, built-in microphone.',
         1799.00, 45,
         'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',
         4.5, 1),
        ('React Design Patterns',
         'Advanced React patterns, hooks, performance optimization and testing. Written by industry experts.',
         799.00, 20,
         'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=400&fit=crop',
         4.6, 3),
        ('Air Fryer XL',
         '5.5L family-size air fryer. 8 preset cooking modes, digital touch display, dishwasher-safe basket.',
         4999.00, 30,
         'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400&h=400&fit=crop',
         4.7, 4),
        ('Cricket Bat Pro',
         'English willow cricket bat, full-size grade 1. Hand-crafted for professional play.',
         3200.00, 15,
         'https://images.unsplash.com/photo-1540747913346-19212a4f1d8a?w=400&h=400&fit=crop',
         4.3, 5),
        ('Mechanical Keyboard',
         'TKL mechanical keyboard with Cherry MX switches, RGB backlit, aluminium frame. USB-C detachable cable.',
         4500.00, 35,
         'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&h=400&fit=crop',
         4.9, 1)
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Migrations + seed data completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrate();
