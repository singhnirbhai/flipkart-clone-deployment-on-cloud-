import React from 'react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-col">
          <h4>ABOUT</h4>
          <a href="/">Contact Us</a>
          <a href="/">About Us</a>
          <a href="/">Careers</a>
          <a href="/">Flipkart Stories</a>
        </div>
        <div className="footer-col">
          <h4>HELP</h4>
          <a href="/">Payments</a>
          <a href="/">Shipping</a>
          <a href="/">Cancellation & Returns</a>
          <a href="/">FAQ</a>
        </div>
        <div className="footer-col">
          <h4>POLICY</h4>
          <a href="/">Return Policy</a>
          <a href="/">Terms Of Use</a>
          <a href="/">Security</a>
          <a href="/">Privacy</a>
        </div>
        <div className="footer-col">
          <h4>SOCIAL</h4>
          <a href="/">Facebook</a>
          <a href="/">Twitter</a>
          <a href="/">YouTube</a>
          <a href="/">Instagram</a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2024 Flipkart Clone. Built for educational purposes.</p>
      </div>
    </footer>
  );
};

export default Footer;
