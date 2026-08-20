import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Payment = () => {
  const navigate = useNavigate();
  const { total, clearCart } = useCart();
  const [method, setMethod] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate payment processing via payment-service
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      clearCart();
    }, 3000);
  };

  if (success) {
    return (
      <div className="payment-success">
        <div className="success-icon">✓</div>
        <h2>Payment Successful!</h2>
        <p>Order placed successfully. Your order ID is: <strong>FK{Date.now()}</strong></p>
        <p>Total paid: ₹{total.toLocaleString()}</p>
        <button onClick={() => navigate('/')}>Continue Shopping</button>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <h2>Payment Methods</h2>
      <div className="payment-container">
        <div className="payment-options">
          <label className={`payment-option ${method === 'upi' ? 'selected' : ''}`}>
            <input type="radio" name="payment" value="upi" checked={method === 'upi'}
              onChange={(e) => setMethod(e.target.value)} />
            <span>UPI</span>
          </label>
          <label className={`payment-option ${method === 'card' ? 'selected' : ''}`}>
            <input type="radio" name="payment" value="card" checked={method === 'card'}
              onChange={(e) => setMethod(e.target.value)} />
            <span>Credit / Debit Card</span>
          </label>
          <label className={`payment-option ${method === 'netbanking' ? 'selected' : ''}`}>
            <input type="radio" name="payment" value="netbanking" checked={method === 'netbanking'}
              onChange={(e) => setMethod(e.target.value)} />
            <span>Net Banking</span>
          </label>
          <label className={`payment-option ${method === 'cod' ? 'selected' : ''}`}>
            <input type="radio" name="payment" value="cod" checked={method === 'cod'}
              onChange={(e) => setMethod(e.target.value)} />
            <span>Cash on Delivery</span>
          </label>
        </div>

        <form onSubmit={handlePayment} className="payment-form">
          {method === 'upi' && (
            <div className="form-group">
              <label>UPI ID</label>
              <input type="text" placeholder="yourname@upi" required value={upiId}
                onChange={(e) => setUpiId(e.target.value)} />
            </div>
          )}
          {method === 'card' && (
            <>
              <div className="form-group">
                <label>Card Number</label>
                <input type="text" placeholder="1234 5678 9012 3456" required value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)} maxLength={19} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Expiry</label>
                  <input type="text" placeholder="MM/YY" required value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)} maxLength={5} />
                </div>
                <div className="form-group">
                  <label>CVV</label>
                  <input type="password" placeholder="CVV" required value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)} maxLength={3} />
                </div>
              </div>
            </>
          )}
          {method === 'netbanking' && (
            <div className="form-group">
              <label>Select Bank</label>
              <select required>
                <option value="">Choose Bank</option>
                <option>SBI</option>
                <option>HDFC</option>
                <option>ICICI</option>
                <option>Axis</option>
                <option>Kotak</option>
              </select>
            </div>
          )}
          <div className="payment-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Total Amount</span>
              <span className="total-amount">₹{total.toLocaleString()}</span>
            </div>
          </div>
          <button type="submit" className="pay-btn" disabled={loading}>
            {loading ? 'Processing...' : `Pay ₹${total.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Payment;
