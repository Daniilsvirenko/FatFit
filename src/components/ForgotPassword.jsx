import React, { useState } from 'react';
import './ForgotPassword.css'; // Import CSS specific to ForgotPassword

const ForgotPassword = ({ onBackClick }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Password reset link sent to ${email}`);
  };

  return (
    <form onSubmit={handleSubmit} className="forgot-password-form">
      <h2 className="forgot-password-title">Forgot Password</h2>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="forgot-password-input"
        required
      />
      <div className="forgot-password-actions">
        <button type="submit" className="forgot-password-button">
          Send Reset Link
        </button>
        <button
          type="button"
          onClick={onBackClick}
          className="forgot-password-back-button"
        >
          Back
        </button>
      </div>
    </form>
  );
};

export default ForgotPassword;
