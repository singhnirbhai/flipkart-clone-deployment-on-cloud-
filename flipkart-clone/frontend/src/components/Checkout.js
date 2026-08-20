import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Checkout = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState({
    name: '', phone: '', pincode: '', address: '', city: '', state: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/payment');
  };

  return (
    <div className="checkout-page">
      <h2>Checkout</h2>
      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="form-section">
          <h3>Delivery Address</h3>
          <div className="form-group">
            <input type="text" placeholder="Full Name" required value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })} />
          </div>
          <div className="form-group">
            <input type="tel" placeholder="Mobile Number" required value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <input type="text" placeholder="Pincode" required value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value })} />
          </div>
          <div className="form-group">
            <textarea placeholder="Address (Area and Street)" required value={address.address}
              onChange={(e) => setAddress({ ...address, address: e.target.value })} />
          </div>
          <div className="form-row">
            <input type="text" placeholder="City" required value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            <select required value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}>
              <option value="">Select State</option>
              <option>Maharashtra</option>
              <option>Delhi</option>
              <option>Karnataka</option>
              <option>Tamil Nadu</option>
              <option>Uttar Pradesh</option>
              <option>Gujarat</option>
              <option>Rajasthan</option>
              <option>West Bengal</option>
            </select>
          </div>
        </div>
        <button type="submit" className="continue-btn">CONTINUE</button>
      </form>
    </div>
  );
};

export default Checkout;
