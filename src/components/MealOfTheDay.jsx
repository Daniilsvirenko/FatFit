import React, { useEffect, useState } from "react";
import { getMealOfTheDay } from "../api/fatfit";

export default function MealOfTheDay({ username }) {
  const [meal, setMeal] = useState(null);

  useEffect(() => {
    if (username) {
      getMealOfTheDay(username).then(data => setMeal(data.mealOfTheDay));
    }
  }, [username]);

  if (!meal) return <div>Loading...</div>;
  return (
    <div>
      <h3>Meal of the Day</h3>
      <div>{meal.food_name}</div>
      <div>{meal.food_description}</div>
    </div>
  );
}
