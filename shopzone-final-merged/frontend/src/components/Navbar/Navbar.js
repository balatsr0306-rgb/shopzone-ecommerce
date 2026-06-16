import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, LayoutDashboard } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Navbar() {
  const { user, logout, cartCount } = useApp();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🛒 ShopZone</Link>

      <div className="navbar-links">
        <Link to="/">Home</Link>

        {user ? (
          <>
            <Link to="/orders">My Orders</Link>
            {user.role === 'admin' && (
              <Link to="/admin" style={{ color: '#f0c040' }}>
                <LayoutDashboard size={15} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Admin
              </Link>
            )}
            <button
              onClick={() => navigate('/cart')}
              className="cart-btn"
            >
              <ShoppingCart size={16} />
              Cart
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
            <button
              onClick={logout}
              className="btn btn-outline btn-sm"
              style={{ color: '#aaa', borderColor: '#aaa' }}
            >
              <LogOut size={14} /> Logout
            </button>
            <span style={{ color: '#aaa', fontSize: 13 }}>
              <User size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {user.name}
            </span>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">
              <button className="btn btn-primary btn-sm">Register</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
