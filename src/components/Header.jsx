import React from 'react';
import './Header.css'; // Import CSS specific to Header

const Header = ({ onAboutUsClick }) => {
  return (
    <header className="header">
      <img
        src="/assets/LOGOwitoutBackgorund.png"
        alt="Logo"
        className="logo"
      />
      <p className="motivation">
        “Take care of your body. It’s the only place you have to live.” – Jim
        Rohn
      </p>
      <button id="AboutUS" onClick={onAboutUsClick} className="about-us-button">
        About Us
      </button>
    </header>
  );
};

export default Header;
