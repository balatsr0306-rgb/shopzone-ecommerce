import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../utils/api';
import toast from 'react-hot-toast';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user,    setUser]    = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [token,   setToken]   = useState(() => localStorage.getItem('token'));
  const [cart,    setCart]    = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load cart when user logs in
  useEffect(() => { if (user) fetchCart(); }, [user]);

  const fetchCart = async () => {
    try {
      const { data } = await API.get('/cart');
      setCart(data.items);
      setCartTotal(data.total);
    } catch {}
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const { data } = await API.post('/auth/register', { name, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      toast.success('Account created!');
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setCart([]);
    toast.success('Logged out');
  };

  const addToCart = async (product_id, quantity = 1) => {
    if (!user) { toast.error('Please login first'); return; }
    try {
      await API.post('/cart', { product_id, quantity });
      await fetchCart();
      toast.success('Added to cart!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add');
    }
  };

  const removeFromCart = async (cartItemId) => {
    try {
      await API.delete(`/cart/${cartItemId}`);
      await fetchCart();
      toast.success('Item removed');
    } catch {}
  };

  const updateCartItem = async (cartItemId, quantity) => {
    try {
      await API.put(`/cart/${cartItemId}`, { quantity });
      await fetchCart();
    } catch {}
  };

  return (
    <AppContext.Provider value={{
      user, token, cart, cartTotal, loading,
      login, register, logout,
      addToCart, removeFromCart, updateCartItem, fetchCart,
      cartCount: cart.reduce((s, i) => s + i.quantity, 0),
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
