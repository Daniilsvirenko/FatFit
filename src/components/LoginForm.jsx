import React, { useState } from 'react';
import './LoginForm.css'; // Import CSS specific to LoginForm

const LoginForm = ({ onSignUpClick, onResetPasswordClick, onSubmit }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
  const handleSubmit =  async (e) => {
    e.preventDefault(); 
    try {
      const response = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        onSubmit(username, password);
        alert("Login successful");
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("An error occurred while logging in.");
    }
  };
// Removed unused handleChange and extra password input
return (
  <form onSubmit={handleSubmit} className="login-form">
    <h2>Log In</h2>
    <input
      className="login_input"
      type="text"
      placeholder="Username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      required
      style={{width: '90%'}}
    />
    <div className='password-login'   style={{ position: 'relative' }}>
      <input
        className="login_input"
        type={showPassword ? 'text' : 'password'}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div
        type="button"
        style={{ position: 'absolute', right: '0px', top: '40%', transform: 'translateY(-50%)' }}
        onClick={() => setShowPassword(!showPassword)}
        className="toggle-password"
        tabIndex={-1}
      >
        {showPassword ? (
          <img src="/assets/icons8-eye-50.png" style={{ width: '24px', height: '24px' }} alt="hide password" />
        ) : (
          <img src="/assets/icons8-closed-eye-50.png" style={{ width: '24px', height: '24px' }} alt="show password" />
        )}
      </div>
    </div>
    <button type="submit">Log In</button>
    <div className="login-actions">
      <button type="button" onClick={onSignUpClick}>
        Sign Up
      </button>
      <button type="button" onClick={onResetPasswordClick}>
        Forgot Password?
      </button>
    </div>
  </form>
);
};

export default LoginForm;
