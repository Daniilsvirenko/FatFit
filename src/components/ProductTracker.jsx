import React, { useState, useEffect } from 'react';
import { 
  searchFatSecret, 
  getFoodDetails,
  saveFoodToFavorites,
  getUserFoods 
} from '../api/fatfit';

export default function ProductTracker({ username }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [savedFoods, setSavedFoods] = useState([]);
  const [message, setMessage] = useState('');

  // Load user's saved foods on mount
  useEffect(() => {
    loadSavedFoods();
  }, [username]);

  const loadSavedFoods = async () => {
    try {
      const foods = await getUserFoods(username);
      setSavedFoods(foods);
    } catch (error) {
      setMessage('Error loading saved foods');
    }
  };

  // Search FatSecret database
  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const data = await searchFatSecret(searchQuery);
      setSearchResults(data.foods?.food || []);
    } catch (error) {
      setMessage('Error searching foods');
    }
  };

  // Get detailed food info
  const handleFoodSelect = async (foodId) => {
    try {
      const details = await getFoodDetails(foodId);
      setSelectedFood(details.food);
    } catch (error) {
      setMessage('Error fetching food details');
    }
  };

  // Save food to favorites
  const handleSaveFood = async () => {
    if (!selectedFood) return;

    try {
      await saveFoodToFavorites({
        username,
        foodId: selectedFood.food_id,
        foodName: selectedFood.food_name,
        servingSize: selectedFood.servings?.serving[0]?.serving_description
      });
      
      setMessage('Food saved successfully');
      loadSavedFoods(); // Refresh saved foods list
    } catch (error) {
      setMessage('Error saving food');
    }
  };

  return (
    <div className="product-tracker">
      <h2>Food Product Tracker</h2>
      
      {/* Search Form */}
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for foods..."
        />
        <button type="submit">Search</button>
      </form>

      {/* Search Results */}
      <div className="search-results">
        <h3>Search Results</h3>
        <ul>
          {searchResults.map((food) => (
            <li key={food.food_id} onClick={() => handleFoodSelect(food.food_id)}>
              {food.food_name}
            </li>
          ))}
        </ul>
      </div>

      {/* Selected Food Details */}
      {selectedFood && (
        <div className="food-details">
          <h3>{selectedFood.food_name}</h3>
          <p>Servings: {selectedFood.servings?.serving[0]?.serving_description}</p>
          <p>Calories: {selectedFood.servings?.serving[0]?.calories}</p>
          <p>Protein: {selectedFood.servings?.serving[0]?.protein}g</p>
          <p>Carbs: {selectedFood.servings?.serving[0]?.carbohydrate}g</p>
          <p>Fat: {selectedFood.servings?.serving[0]?.fat}g</p>
          <button onClick={handleSaveFood}>Save to Favorites</button>
        </div>
      )}

      {/* Saved Foods */}
      <div className="saved-foods">
        <h3>My Saved Foods</h3>
        <ul>
          {savedFoods.map((food) => (
            <li key={food._id}>
              {food.foodName} - {food.servingSize}
            </li>
          ))}
        </ul>
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
}
