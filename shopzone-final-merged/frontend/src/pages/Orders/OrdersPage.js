import React, { useState, useEffect } from 'react';
import API from '../../utils/api';

export default function OrdersPage() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/orders').then(r => setOrders(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <div className="page-header"><h1>My Orders</h1></div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 64 }}>📦</div>
          <h3>No orders yet</h3>
        </div>
      ) : (
        orders.map(order => (
          <div key={order.id} className="order-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Order #{order.id}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                  {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <span className={`status-badge status-${order.status}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555' }}>
              <span>📍 {order.address}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#e94560' }}>
                ₹{parseFloat(order.total_amount).toLocaleString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
