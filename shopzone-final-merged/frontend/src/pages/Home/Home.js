import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate }  from 'react-router-dom';
import { Search, Star, ShoppingCart, Filter } from 'lucide-react';
import API  from '../../utils/api';
import { useApp } from '../../context/AppContext';

const StarRating = ({ rating }) => (
  <div className="star-rating">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={13} fill={s <= Math.round(rating) ? '#f59e0b' : 'none'}
        stroke={s <= Math.round(rating) ? '#f59e0b' : '#ccc'} />
    ))}
    <span>{parseFloat(rating || 0).toFixed(1)}</span>
  </div>
);

export default function Home() {
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('');
  const [sort,        setSort]        = useState('created_at');
  const [order,       setOrder]       = useState('DESC');
  const [page,        setPage]        = useState(1);
  const [pagination,  setPagination]  = useState({});
  const [loading,     setLoading]     = useState(true);
  const [addingId,    setAddingId]    = useState(null);
  const { addToCart } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 12, sort, order });
    if (search)   params.set('search', search);
    if (category) params.set('category', category);
    API.get(`/products?${params}`)
      .then(r => { setProducts(r.data.products); setPagination(r.data.pagination); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category, sort, order, page]);

  useEffect(() => { setPage(1); }, [search, category, sort, order]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleAddToCart = async (id) => {
    setAddingId(id);
    await addToCart(id);
    setAddingId(null);
  };

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-content">
          <h1>Shop the Best <span>Deals</span> Online</h1>
          <p>Discover {pagination.total || '100+'} products at amazing prices</p>
          <button className="btn btn-primary btn-lg"
            onClick={() => document.getElementById('products').scrollIntoView({ behavior: 'smooth' })}>
            Shop Now ↓
          </button>
        </div>
      </div>

      <div className="container" id="products">
        <div className="section-header">
          <h2>All Products</h2>
          {pagination.total && <span className="badge">{pagination.total} items</span>}
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input placeholder="Search products..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={`${sort}-${order}`} onChange={e => {
            const [s, o] = e.target.value.split('-');
            setSort(s); setOrder(o);
          }}>
            <option value="created_at-DESC">Newest First</option>
            <option value="price-ASC">Price: Low to High</option>
            <option value="price-DESC">Price: High to Low</option>
            <option value="rating-DESC">Top Rated</option>
            <option value="name-ASC">Name A–Z</option>
          </select>
          {(search || category) && (
            <button className="btn btn-outline btn-sm"
              onClick={() => { setSearch(''); setCategory(''); }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="products-grid skeleton-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="product-card skeleton-card">
                <div className="skeleton skeleton-img" />
                <div className="product-card-body">
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text short" />
                  <div className="skeleton skeleton-text" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No products found</h3>
            <p>Try different search terms or category</p>
            <button className="btn btn-primary" onClick={() => { setSearch(''); setCategory(''); }}>
              Browse All
            </button>
          </div>
        ) : (
          <>
            <div className="products-grid">
              {products.map(product => (
                <div key={product.id} className="product-card">
                  <div className="product-img-wrap" onClick={() => navigate(`/product/${product.id}`)}>
                    <img src={product.image_url} alt={product.name}
                      onError={e => { e.target.src = `https://via.placeholder.com/400x400/1a1a2e/e94560?text=${encodeURIComponent(product.name)}`; }} />
                    {product.stock === 0 && <div className="out-of-stock-badge">Out of Stock</div>}
                  </div>
                  <div className="product-card-body">
                    <div className="category-tag">{product.category_name}</div>
                    <h3 onClick={() => navigate(`/product/${product.id}`)}>{product.name}</h3>
                    <StarRating rating={product.rating} />
                    <div className="price-row">
                      <span className="price">₹{parseFloat(product.price).toLocaleString()}</span>
                      <span className={`stock-badge ${product.stock > 0 ? 'in' : 'out'}`}>
                        {product.stock > 0 ? `${product.stock} left` : 'Sold out'}
                      </span>
                    </div>
                    <button className="btn btn-primary btn-block"
                      disabled={product.stock === 0 || addingId === product.id}
                      onClick={() => handleAddToCart(product.id)}>
                      {addingId === product.id ? 'Adding...' : <><ShoppingCart size={15}/> Add to Cart</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button className="btn btn-outline btn-sm" disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}>← Prev</button>
                {[...Array(pagination.pages)].map((_, i) => (
                  <button key={i} className={`btn btn-sm ${page === i+1 ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPage(i+1)}>{i+1}</button>
                ))}
                <button className="btn btn-outline btn-sm" disabled={page === pagination.pages}
                  onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
