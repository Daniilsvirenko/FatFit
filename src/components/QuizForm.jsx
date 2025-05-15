import React, { useState } from "react";
import { submitAnswers } from "../api/fatfit";

/**
 * QuizForm component
 * 
 * Collects user input for age, height, weight, gender, goal, and target date.
 * On submit, sends answers to backend /answers endpoint.
 * The backend saves answers, calculates daily calories, and fetches a meal plan from Spoonacular.
 * The meal plan is displayed below the form.
 * 
 * Props:
 * - username: string (the username of the logged-in user)
 */
export default function QuizForm({ username }) {
  // State for form answers
  const [answers, setAnswers] = useState({
    age: "",
    height: "",
    weight: "",
    gender: "male",
    goal: "lose",
    targetDate: ""
  });
  // State for meal plan and calories returned from backend
  const [mealPlan, setMealPlan] = useState(null);
  const [dailyCalories, setDailyCalories] = useState(null);

  // Handle input changes and update answers state
  const handleChange = e =>
    setAnswers({ ...answers, [e.target.name]: e.target.value });

  // On form submit, send answers to backend and update meal plan state
  const handleSubmit = async e => {
    e.preventDefault();
    // Calls POST /answers with { username, answers }
    const result = await submitAnswers({ username, answers });
    setMealPlan(result.mealPlan || null);
    setDailyCalories(result.dailyCalories || null);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* User input fields for quiz */}
      <input name="age" placeholder="Age" onChange={handleChange} required />
      <input name="height" placeholder="Height (cm)" onChange={handleChange} required />
      <input name="weight" placeholder="Weight (kg)" onChange={handleChange} required />
      <select name="gender" onChange={handleChange} value={answers.gender}>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>
      <select name="goal" onChange={handleChange} value={answers.goal}>
        <option value="lose">Lose Weight</option>
        <option value="keep">Keep Weight</option>
        <option value="gain">Gain Weight</option>
      </select>
      <input name="targetDate" placeholder="Target Date" type="date" onChange={handleChange} required />
      <button type="submit">Submit</button>
      {/* Display meal plan and calories */}
      {dailyCalories && <div>Daily Calories: {dailyCalories}</div>}
      {mealPlan && mealPlan.meals && (
        <ul>
          {mealPlan.meals.map(meal => (
            <li key={meal.id}>
              {meal.title} ({meal.readyInMinutes} min, {meal.servings} servings)
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
