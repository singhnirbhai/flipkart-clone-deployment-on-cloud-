import React from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingCart, FiUser, FiSearch } from 'react-icons/fi';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { cart, user } = useCart();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-blue">Flip</span>
          <span className="logo-yellow">kart</span>
        </Link>

        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Search for Products, Brands and More" />
        </div>

        <div className="nav-links">
          {user ? (
            <span className="nav-user">Hi, {user.name}</span>
          ) : (
            <Link to="/login" className="nav-link">Login</Link>
          )}
          <Link to="/cart" className="nav-link cart-link">
            <FiShoppingCart />
            <span>Cart</span>
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
