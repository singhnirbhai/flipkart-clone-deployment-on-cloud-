import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Cart = () => {
  const { cart, removeFromCart, updateQty, total } = useCart();

  if (cart.length === 0) {
    return (
      <div className="cart-empty">
        <h2>Your cart is empty!</h2>
        <p>Add items to it now.</p>
        <Link to="/" className="shop-now-btn">Shop Now</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-items">
        <h2 className="cart-title">My Cart ({cart.length})</h2>
        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <img src={item.image} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h3>{item.name}</h3>
              <p className="cart-item-price">₹{item.price.toLocaleString()}</p>
              <div className="qty-controls">
                <button onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                <span>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
              </div>
              <button className="remove-btn" onClick={() => removeFromCart(item.id)}>REMOVE</button>
            </div>
            <div className="cart-item-total">
              ₹{(item.price * item.qty).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="cart-summary">
        <h3>PRICE DETAILS</h3>
        <div className="summary-row">
          <span>Price ({cart.length} items)</span>
          <span>₹{total.toLocaleString()}</span>
        </div>
        <div className="summary-row">
          <span>Delivery Charges</span>
          <span className="free">FREE</span>
        </div>
        <div className="summary-row total-row">
          <span>Total Amount</span>
          <span>₹{total.toLocaleString()}</span>
        </div>
        <Link to="/checkout" className="checkout-btn">PLACE ORDER</Link>
      </div>
    </div>
  );
};

export default Cart;
