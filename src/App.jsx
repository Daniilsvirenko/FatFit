import React, { useState } from 'react';
import Header from './components/Header';
import MainButton from './components/MainButton';
import AboutUs from './components/AboutUs';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPassword from './components/ForgotPassword';
import './App.css'; // Import global CSS
function App() {
  const [view, setView] = useState('main');

  const handleAboutUsClick = () => setView('aboutUs');
  const handleBackClick = () => setView('main');
  const handleOpenLogin = () => setView('login');
  const handleLoginSubmit = (username) => {
    alert(`Logged in as ${username}`);
    setView('main'); // Redirect to main view after login
  };

  return (
    <div className='TheRealMain'>
      <Header onAboutUsClick={handleAboutUsClick} />
      <main>
        {view === 'main' && <MainButton onOpenLogin={handleOpenLogin} />}
        {view === 'aboutUs' && <AboutUs onBackClick={handleBackClick} />}
        {view === 'login' && (
          <LoginForm
            onSignUpClick={() => setView('register')}
            onResetPasswordClick={() => setView('forgotPassword')}
            onSubmit={handleLoginSubmit}
          />
        )}
        {view === 'register' && <RegisterForm onBackClick={handleBackClick} />}
        {view === 'forgotPassword' && (
          <ForgotPassword onBackClick={handleBackClick} />
        )}
      </main>
      <footer>
        
      </footer>
    </div>
  );
}

export default App;