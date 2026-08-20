import React from 'react';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const PRODUCTS = [
  { id: 1, name: 'Samsung Galaxy S23 Ultra', price: 124999, image: 'https://via.placeholder.com/400x400?text=Samsung+S23', category: 'Mobiles', rating: 4.5, discount: 15, description: 'Samsung Galaxy S23 Ultra with S Pen, 200MP camera, Snapdragon 8 Gen 2 processor, 5000mAh battery. Premium flagship experience with titanium frame.' },
  { id: 2, name: 'iPhone 15 Pro Max', price: 159900, image: 'https://via.placeholder.com/400x400?text=iPhone+15', category: 'Mobiles', rating: 4.7, discount: 10, description: 'iPhone 15 Pro Max with A17 Pro chip, titanium design, 48MP camera system, USB-C, and Action button. Most powerful iPhone ever.' },
  { id: 3, name: 'Sony WH-1000XM5', price: 29990, image: 'https://via.placeholder.com/400x400?text=Sony+XM5', category: 'Electronics', rating: 4.6, discount: 20, description: 'Industry-leading noise cancellation with Auto NC Optimizer. Crystal clear hands-free calling with 4 beamforming microphones.' },
  { id: 4, name: 'MacBook Air M2', price: 119900, image: 'https://via.placeholder.com/400x400?text=MacBook+Air', category: 'Laptops', rating: 4.8, discount: 12, description: 'Supercharged by M2 chip. Strikingly thin design. Up to 18 hours of battery life. 13.6-inch Liquid Retina display.' },
  { id: 5, name: 'Nike Air Max 270', price: 12995, image: 'https://via.placeholder.com/400x400?text=Nike+Air', category: 'Fashion', rating: 4.3, discount: 25, description: 'The Nike Air Max 270 features Nike\'s biggest heel Air unit yet for a super-soft ride. The sleek design looks great on and off the court.' },
  { id: 6, name: 'OnePlus 11 5G', price: 56999, image: 'https://via.placeholder.com/400x400?text=OnePlus+11', category: 'Mobiles', rating: 4.4, discount: 18, description: 'OnePlus 11 with Snapdragon 8 Gen 2, 50MP triple camera, 100W SUPERVOOC charging. Hasselblad camera for natural colour.' },
];

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const product = PRODUCTS.find((p) => p.id === parseInt(id)) || PRODUCTS[0];
  const discountedPrice = product.price - (product.price * product.discount) / 100;

  return (
    <div className="product-detail">
      <div className="product-detail-image">
        <img src={product.image} alt={product.name} />
      </div>
      <div className="product-detail-info">
        <h1>{product.name}</h1>
        <div className="product-rating-lg">
          <span className="rating-badge">{product.rating} ★</span>
          <span className="rating-count">Ratings</span>
        </div>
        <div className="product-price-lg">
          <span className="current-price">₹{discountedPrice.toLocaleString()}</span>
          <span className="original-price">₹{product.price.toLocaleString()}</span>
          <span className="discount">{product.discount}% off</span>
        </div>
        <p className="product-description">{product.description}</p>
        <div className="product-actions">
          <button className="btn-buy" onClick={() => { addToCart(product); }}>BUY NOW</button>
          <button className="btn-cart" onClick={() => addToCart(product)}>ADD TO CART</button>
        </div>
        <div className="product-highlights">
          <h3>Highlights</h3>
          <ul>
            <li>Free delivery available</li>
            <li>7-day replacement policy</li>
            <li>GST invoice available</li>
            <li>1 year manufacturer warranty</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
