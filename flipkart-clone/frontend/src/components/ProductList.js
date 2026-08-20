import React, { useState, useEffect } from 'react';
import ProductCard from './ProductCard';

const PRODUCTS = [
  { id: 1, name: 'Samsung Galaxy S23 Ultra', price: 124999, image: 'https://via.placeholder.com/200x200?text=Samsung+S23', category: 'Mobiles', rating: 4.5, discount: 15 },
  { id: 2, name: 'iPhone 15 Pro Max', price: 159900, image: 'https://via.placeholder.com/200x200?text=iPhone+15', category: 'Mobiles', rating: 4.7, discount: 10 },
  { id: 3, name: 'Sony WH-1000XM5', price: 29990, image: 'https://via.placeholder.com/200x200?text=Sony+XM5', category: 'Electronics', rating: 4.6, discount: 20 },
  { id: 4, name: 'MacBook Air M2', price: 119900, image: 'https://via.placeholder.com/200x200?text=MacBook+Air', category: 'Laptops', rating: 4.8, discount: 12 },
  { id: 5, name: 'Nike Air Max 270', price: 12995, image: 'https://via.placeholder.com/200x200?text=Nike+Air', category: 'Fashion', rating: 4.3, discount: 25 },
  { id: 6, name: 'OnePlus 11 5G', price: 56999, image: 'https://via.placeholder.com/200x200?text=OnePlus+11', category: 'Mobiles', rating: 4.4, discount: 18 },
  { id: 7, name: 'LG OLED 55" TV', price: 89999, image: 'https://via.placeholder.com/200x200?text=LG+OLED', category: 'Electronics', rating: 4.6, discount: 30 },
  { id: 8, name: 'HP Pavilion Gaming', price: 64999, image: 'https://via.placeholder.com/200x200?text=HP+Gaming', category: 'Laptops', rating: 4.2, discount: 22 },
  { id: 9, name: 'boAt Airdopes 141', price: 1299, image: 'https://via.placeholder.com/200x200?text=boAt+141', category: 'Electronics', rating: 4.1, discount: 40 },
  { id: 10, name: 'Levi\'s Jeans', price: 2999, image: 'https://via.placeholder.com/200x200?text=Levis', category: 'Fashion', rating: 4.0, discount: 35 },
  { id: 11, name: 'Dell Monitor 27"', price: 18999, image: 'https://via.placeholder.com/200x200?text=Dell+27', category: 'Electronics', rating: 4.3, discount: 20 },
  { id: 12, name: 'Adidas Ultraboost', price: 15999, image: 'https://via.placeholder.com/200x200?text=Adidas', category: 'Fashion', rating: 4.5, discount: 28 },
];

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    setProducts(PRODUCTS);
  }, []);

  const categories = ['All', ...new Set(PRODUCTS.map((p) => p.category))];
  const filtered = filter === 'All' ? products : products.filter((p) => p.category === filter);

  return (
    <div className="product-page">
      <div className="filter-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="product-grid">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;
