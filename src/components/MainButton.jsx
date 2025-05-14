import React, { useState } from 'react';
import './MainButton.css'; // Import CSS specific to MainButton

const MainButton = ({ onOpenLogin }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (isLoading) return; // Prevent multiple clicks
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onOpenLogin(); // Trigger the login section to open
    }, 2000); // Simulate loading time
  };

  return (
    <button
      id="LogIn"
      onClick={handleClick}
      disabled={isLoading}
      className={`main-button ${isLoading ? 'loading' : ''}`}
      aria-busy={isLoading}
      aria-disabled={isLoading}
    >
      {isLoading ? 'Loading...' : 'Try our new website!'}
    </button>
  );
};

export default MainButton;
