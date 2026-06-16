import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import API from '../../utils/api';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { cart, cartTotal, removeFromCart, updateCartItem, fetchCart } = useApp();
  const [address,   setAddress]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [ordering,  setOrdering]  = useState(false);
  const navigate = useNavigate();

  const placeOrder = async () => {
    if (!address || !phone) { toast.error('Enter address and phone'); return; }
    setOrdering(true);
    try {
      await API.post('/orders', { address, phone });
      await fetchCart();
      toast.success('Order placed successfully! 🎉');
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order failed');
    } finally {
      setOrdering(false);
    }
  };

  if (!cart.length) return (
    <div className="container">
      <div className="empty-state">
        <div style={{ fontSize: 64 }}>🛒</div>
        <h3>Your cart is empty</h3>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Continue Shopping</button>
      </div>
    </div>
  );

  return (
    <div className="container cart-page">
      <div className="page-header"><h1>Shopping Cart ({cart.length} items)</h1></div>

      <div className="two-col">
        {/* Cart Items */}
        <div>
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              <img src={item.image_url} alt={item.name} />
              <div className="cart-item-info">
                <h4>{item.name}</h4>
                <p>₹{parseFloat(item.price).toLocaleString()} each</p>
              </div>
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => updateCartItem(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}>-</button>
                <span style={{ fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, minWidth: 80, textAlign: 'right' }}>
                ₹{parseFloat(item.subtotal).toLocaleString()}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Summary + Checkout */}
        <div>
          <div className="cart-summary" style={{ marginBottom: '1rem' }}>
            <h3>Order Summary</h3>
            {cart.map(item => (
              <div key={item.id} className="summary-row">
                <span>{item.name} × {item.quantity}</span>
                <span>₹{parseFloat(item.subtotal).toLocaleString()}</span>
              </div>
            ))}
            <div className="summary-row total">
              <span>Total</span>
              <span>₹{parseFloat(cartTotal).toLocaleString()}</span>
            </div>
          </div>

          <div className="cart-summary">
            <h3>Delivery Details</h3>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Delivery Address</label>
              <textarea rows={3} placeholder="Full address..." value={address}
                onChange={e => setAddress(e.target.value)} style={{ resize: 'none' }} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input placeholder="+91 XXXXX XXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" onClick={placeOrder} disabled={ordering}>
              {ordering ? 'Placing Order...' : `Place Order — ₹${parseFloat(cartTotal).toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
