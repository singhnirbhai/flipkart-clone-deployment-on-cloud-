import React, { useState } from 'react';
import { useCart } from '../context/CartContext';

const Login = () => {
  const { setUser } = useCart();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setUser({ name: isSignup ? name : email.split('@')[0], email });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <h2>{isSignup ? 'Looks like you\'re new here!' : 'Login'}</h2>
          <p>{isSignup ? 'Sign up with your details to get started' : 'Get access to your Orders, Wishlist and Recommendations'}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && (
            <div className="form-group">
              <input type="text" placeholder="Enter Name" required value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <input type="email" placeholder="Enter Email/Mobile number" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <input type="password" placeholder="Enter Password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="login-btn">
            {isSignup ? 'Signup' : 'Login'}
          </button>
          <p className="toggle-text" onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? 'Already have an account? Login' : 'New to Flipkart? Create an account'}
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
