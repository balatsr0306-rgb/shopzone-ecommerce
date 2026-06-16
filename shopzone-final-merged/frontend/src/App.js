import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import Navbar    from './components/Navbar/Navbar';
import Home      from './pages/Home/Home';
import ProductDetail from './pages/Product/ProductDetail';
import CartPage  from './pages/Cart/CartPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import OrdersPage from './pages/Orders/OrdersPage';
import AdminPage from './pages/Admin/AdminPage';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user } = useApp();
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user } = useApp();
  return user?.role === 'admin' ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Navbar />
        <main style={{ minHeight: '80vh' }}>
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/register"  element={<RegisterPage />} />
            <Route path="/cart"      element={<PrivateRoute><CartPage /></PrivateRoute>} />
            <Route path="/orders"    element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
            <Route path="/admin"     element={<AdminRoute><AdminPage /></AdminRoute>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
