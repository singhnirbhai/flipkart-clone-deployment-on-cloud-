import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const discountedPrice = product.price - (product.price * product.discount) / 100;

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`}>
        <img src={product.image} alt={product.name} className="product-image" />
      </Link>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-rating">
          <span className="rating-badge">{product.rating} ★</span>
        </div>
        <div className="product-price">
          <span className="current-price">₹{discountedPrice.toLocaleString()}</span>
          <span className="original-price">₹{product.price.toLocaleString()}</span>
          <span className="discount">{product.discount}% off</span>
        </div>
        <button className="add-to-cart-btn" onClick={() => addToCart(product)}>
          ADD TO CART
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
