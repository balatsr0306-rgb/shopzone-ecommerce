import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import API from '../../utils/api';
import { useApp } from '../../context/AppContext';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty,     setQty]     = useState(1);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    API.get(`/products/${id}`)
      .then(r => setProduct(r.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!product) return null;

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        <img src={product.image_url} alt={product.name}
          style={{ width: '100%', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />

        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{product.category_name}</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>{product.name}</h1>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#e94560', marginBottom: 16 }}>
            ₹{parseFloat(product.price).toLocaleString()}
          </div>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, marginBottom: 20 }}>{product.description}</p>

          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: product.stock > 0 ? '#28a745' : '#dc3545', fontWeight: 500 }}>
              {product.stock > 0 ? `✓ In Stock — ${product.stock} available` : '✗ Out of Stock'}
            </span>
          </div>

          {product.stock > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 500 }}>Quantity:</label>
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>-</button>
                <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                <button className="qty-btn" onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</button>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ fontSize: 16, padding: '12px 32px' }}
            disabled={product.stock === 0}
            onClick={() => addToCart(product.id, qty)}
          >
            <ShoppingCart size={18} /> Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
