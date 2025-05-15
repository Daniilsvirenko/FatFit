const BASE_URL = "http://localhost:3001";

// Register user
export async function registerUser(data) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return await res.json();
}

// Login
export async function loginUser(data) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return await res.json();
}

// Submit answers and get meal plan (with calories)
export async function submitAnswers(data) {
  const res = await fetch(`${BASE_URL}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return await res.json();
}

// Get meal of the day
export async function getMealOfTheDay(username) {
  const res = await fetch(`${BASE_URL}/meal-of-the-day?username=${encodeURIComponent(username)}`);
  return await res.json();
}

// Get all users (admin/debug)
export async function getAllUsers() {
  const res = await fetch(`${BASE_URL}/users`);
  return await res.json();
}
