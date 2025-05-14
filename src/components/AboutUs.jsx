import React from 'react';
import './AboutUs.css'; // Import CSS specific to AboutUs

const AboutUs = ({ onBackClick }) => {
  return (
    <div className="about-us">
      <p className="about-us-text">
        We are a team consisting of Alexandru Tarita, Singh-Pamma Teghnoor, and
        Svirenko Daniil, students at FH CAMPUS Wien. We are excited to work on
        our project for the Professional Presentations course, focused on WEB
        Technologies.
      </p>
      <button id="return" onClick={onBackClick} className="back-button">
        Back
      </button>
    </div>
  );
};

export default AboutUs;
