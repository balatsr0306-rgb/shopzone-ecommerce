import React, { useState, useEffect } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats,    setStats]    = useState(null);
  const [products, setProducts] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab,      setTab]      = useState('stats');
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState({ name:'', description:'', price:'', stock:'', image_url:'', category_id:'' });

  useEffect(() => {
    API.get('/admin/stats').then(r => setStats(r.data));
    API.get('/products?limit=100').then(r => setProducts(r.data.products));
    API.get('/categories').then(r => setCategories(r.data));
    fetchOrders();
  }, []);

  const fetchOrders = () => {
    // Admin sees all orders via a workaround — in prod add GET /admin/orders
    API.get('/orders').then(r => setOrders(r.data)).catch(() => {});
  };

  const saveProduct = async () => {
    try {
      if (form.id) {
        await API.put(`/products/${form.id}`, form);
        toast.success('Product updated');
      } else {
        await API.post('/products', form);
        toast.success('Product created');
      }
      const r = await API.get('/products?limit=100');
      setProducts(r.data.products);
      setModal(false);
      setForm({ name:'', description:'', price:'', stock:'', image_url:'', category_id:'' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await API.delete(`/products/${id}`);
    setProducts(p => p.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const statuses = ['pending','processing','shipped','delivered','cancelled'];

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <div className="page-header"><h1>⚙️ Admin Dashboard</h1></div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', borderBottom: '2px solid #eee' }}>
        {['stats','products','orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="btn btn-sm"
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none',
              background: tab === t ? '#1a1a2e' : 'transparent',
              color: tab === t ? '#fff' : '#888' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === 'stats' && stats && (
        <div className="admin-stats">
          {[
            { label: 'Total Users',    value: stats.users },
            { label: 'Total Products', value: stats.products },
            { label: 'Total Orders',   value: stats.orders },
            { label: 'Revenue',        value: `₹${parseFloat(stats.revenue).toLocaleString()}` },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="value">{s.value}</div>
              <div className="label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Products */}
      {tab === 'products' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => { setForm({ name:'',description:'',price:'',stock:'',image_url:'',category_id:'' }); setModal(true); }}>
              + Add Product
            </button>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.category_name}</td>
                  <td>₹{parseFloat(p.price).toLocaleString()}</td>
                  <td>{p.stock}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setForm({ ...p }); setModal(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <table className="admin-table">
          <thead>
            <tr><th>Order ID</th><th>Total</th><th>Status</th><th>Date</th><th>Update Status</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>₹{parseFloat(o.total_amount).toLocaleString()}</td>
                <td><span className={`status-badge status-${o.status}`}>{o.status}</span></td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                  <select value={o.status}
                    onChange={async e => {
                      await API.put(`/orders/${o.id}/status`, { status: e.target.value });
                      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: e.target.value } : x));
                      toast.success('Status updated');
                    }}>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Product Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>{form.id ? 'Edit Product' : 'Add Product'}</h3>
            {['name','description','price','stock','image_url'].map(field => (
              <div key={field} className="form-group">
                <label style={{ textTransform: 'capitalize' }}>{field.replace('_', ' ')}</label>
                {field === 'description'
                  ? <textarea rows={3} value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                  : <input type={['price','stock'].includes(field) ? 'number' : 'text'}
                      value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                }
              </div>
            ))}
            <div className="form-group">
              <label>Category</label>
              <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProduct}>Save Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
