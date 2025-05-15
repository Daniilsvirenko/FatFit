import React, { useState, useEffect } from 'react';
import './RegisterForm.css';
import { registerUser } from "../api/fatfit";

const RegisterForm = ({ onBackClick }) => {
  const [quizData, setQuizData] = useState([]);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch('http://localhost:3001/quiz')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch quiz');
        return res.json();
      })
      .then(data => setQuizData(data))
      .catch(err => console.error('Error fetching quiz:', err));
  }, []);

  const EmailCheck = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const Checkpass = (password) =>
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const handleNext = async () => {
    if (step === 1) {
      const { fullname, username, email, password } = formData;
      if (fullname && username && email && password) {
        if (!EmailCheck(email)) {
          alert('Invalid email');
          return;
        }
        if (!Checkpass(password)) {
          alert('Password must be at least 8 characters long, contain one uppercase letter and one special character');
          return;
        }

        try {
          const checkRes = await fetch('http://localhost:3001/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email }),
          });

          const checkData = await checkRes.json();

          if (checkData.exists) {
            alert('Username sau email deja există!');
            return;
          }
        } catch (err) {
          console.error('Eroare la verificare utilizator:', err);
          alert('A apărut o eroare la verificarea utilizatorului.');
          return;
        }

        setStep(2);
      } else {
        alert('Completează toate câmpurile');
      }
    } else if (step === 2) {
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setStep(3);
      }
    }
  };

  const handlePrev = () => {
    if (step === 2 && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      setStep(prev => prev - 1);
    }
  };

  const handleChange = (question, value) => {
    setFormData({ ...formData, [question]: value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const result = await registerUser(formData);
    setMessage(result.message);
  };

  return (
    <div className="register-form">
      {step === 1 && (
        <div className="step-container">
          <div className="Inputs-signup">
            <h2>Step 1: Basic Info</h2>
            <input type="text" placeholder="Full Name" className="form-input" onChange={e => handleChange('fullname', e.target.value)} />
            <input type="text" placeholder="Username" className="form-input" onChange={e => handleChange('username', e.target.value)} />
            <input type="email" placeholder="Email" className="form-input" onChange={e => handleChange('email', e.target.value)} />
            <div className="password-container">
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" className="form-input" onChange={e => handleChange('password', e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button className="form-button" onClick={handleNext}>Next</button>
        </div>
      )}
      {step === 2 && (
        <div className="step-container">
          <h2>Step 2: Quiz</h2>
          <div className="quiz-question">
            {quizData.length > 0 && quizData[currentQuestionIndex] ? (
              <>
                <p>{quizData[currentQuestionIndex].question}</p>
                {quizData[currentQuestionIndex].type === 'text' && (
                  <input type="text" className="form-input Input_quiz" onChange={e => handleChange(quizData[currentQuestionIndex].question, e.target.value)} />
                )}
                {quizData[currentQuestionIndex].type === 'radio' &&
                  quizData[currentQuestionIndex].options.map((option, idx) => (
                    <label key={idx} className='radio-label'>
                      <input type="radio" name={quizData[currentQuestionIndex].question} value={option} onChange={e => handleChange(quizData[currentQuestionIndex].question, e.target.value)} />
                      {option}
                    </label>
                  ))}
                {quizData[currentQuestionIndex].type === 'checkbox' &&
                  quizData[currentQuestionIndex].options.map((option, idx) => (
                    <label key={idx} className='checkbox-label'>
                      <input type="checkbox" name={quizData[currentQuestionIndex].question} value={option} onChange={e => handleChange(quizData[currentQuestionIndex].question, e.target.value)} />
                      {option}
                    </label>
                  ))}
              </>
            ) : (
              <p>Loading quiz...</p>
            )}
          </div>
          <div className="form-navigation">
            <button className='form-button' onClick={handlePrev}>Back</button>
            <button className='form-button' onClick={handleNext}>
              {currentQuestionIndex === quizData.length - 1 ? 'Next' : 'Next Question'}
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="step-container">
          <h2>Step 3: Review & Submit</h2>
          <div className="form-review">
            {Object.entries(formData).map(([key, value]) => (
              <div key={key}><strong>{key}:</strong> {value.toString()}</div>
            ))}
          </div>
          <div className="form-navigation">
            <button className='form-button' onClick={handlePrev}>Back</button>
            <button className='form-button' onClick={handleSubmit}>Submit</button>
          </div>
        </div>
      )}
      <button className="cancel-button" onClick={onBackClick}>Cancel</button>
      {message && <div>{message}</div>}
    </div>
  );
};

export default RegisterForm;
