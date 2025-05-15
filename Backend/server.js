import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcrypt";
import { MongoClient } from "mongodb";
import fetch from "node-fetch";

const app = express();
const PORT = 3001;

// Load quiz questions from file
const raw = fs.readFileSync("./data/quiz.json", "utf-8");
const quiz = JSON.parse(raw);

// MongoDB client setup
const client = new MongoClient(process.env.MONGO_URI);

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

/**
 * Connect to MongoDB Atlas
 */
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");
  } catch (err) {
    console.error("❌ Connection error:", err);
  }
}
connectDB();

/**
 * User login
 * POST /login
 * Body: { username, password }
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }
  try {
    const db = client.db("test");
    const users = db.collection("users");
    const user = await users.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Incorrect username or password." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect username or password." });
    }
    return res.status(200).json({ success: true, message: "Login successful!" });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
});

/**
 * Check if user/email exists
 * POST /check-user
 * Body: { username?, email? }
 */
app.post("/check-user", async (req, res) => {
  const { username, email } = req.body;
  if (!username && !email) {
    return res.status(400).json({ exists: false, message: "Username or email is missing." });
  }
  try {
    const db = client.db("test");
    const users = db.collection("users");
    const existingUser = await users.findOne({
      $or: [...(username ? [{ username }] : []), ...(email ? [{ email }] : [])],
    });
    return res.status(200).json({ exists: !!existingUser });
  } catch (err) {
    console.error("Check error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * Register a new user
 * POST /register
 * Body: { fullname, username, email, password }
 */
app.post("/register", async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;
    if (!username || !password || !email || !fullname) {
      return res.status(400).json({ message: "Username, email, fullname, and password are required." });
    }
    const db = client.db("test");
    const users = db.collection("users");
    const existingUser = await users.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await users.insertOne({ fullname, username, email, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * Calculate daily calorie needs using Mifflin-St Jeor Equation
 * @param {Object} answers - { age, height, weight, gender, goal }
 * @returns {number} dailyCalories
 */
function calculateCalories({ age, height, weight, gender, goal }) {
  let bmr;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  if (goal === "lose") return Math.round(bmr - 500);
  if (goal === "gain") return Math.round(bmr + 300);
  return Math.round(bmr);
}

/**
 * Save quiz answers and suggest meal plan from Spoonacular
 * POST /answers
 * Body: { username, answers }
 * Returns: { success, message, mealPlan, dailyCalories }
 */
app.post("/answers", async (req, res) => {
  const { username, answers } = req.body;
  if (
    !username ||
    !answers ||
    typeof answers !== "object" ||
    !answers.age ||
    !answers.height ||
    !answers.weight ||
    !answers.gender ||
    !answers.goal
  ) {
    return res.status(400).json({
      success: false,
      message: "Username or required answers are missing or invalid.",
    });
  }
  try {
    const db = client.db("test");
    const answersCollection = db.collection("answers");
    await answersCollection.insertOne({
      username,
      answers,
      submittedAt: new Date(),
    });
    const dailyCalories = calculateCalories(answers);
    const spoonacularKey = process.env.SPOONACULAR_API_KEY;
    const mealCount = 3;
    const spoonacularUrl = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${dailyCalories}&number=${mealCount}&apiKey=${spoonacularKey}`;
    const mealRes = await fetch(spoonacularUrl);
    let mealPlan = {};
    if (mealRes.ok) {
      mealPlan = await mealRes.json();
    } else {
      const errorText = await mealRes.text();
      console.error("Spoonacular API error:", errorText);
    }
    res.status(201).json({
      success: true,
      message: "Answers saved and meal plan generated!",
      dailyCalories,
      mealPlan
    });
  } catch (err) {
    console.error("❌ Error saving answers or fetching Spoonacular:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/**
 * Get quiz questions
 * GET /quiz
 */
app.get("/quiz", (req, res) => {
  res.send(quiz);
});

/**
 * Health check
 * GET /
 */
app.get("/", (req, res) => {
  res.send("Backend operational");
});

/**
 * FatSecret API: Search foods
 * GET /fatsecret-search?q=apple
 * Query: q (search term)
 */
async function getFatSecretToken() {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=basic"
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("FatSecret token error response:", errorText);
    throw new Error("Failed to get FatSecret token: " + errorText);
  }
  const data = await response.json();
  return data.access_token;
}

app.get("/fatsecret-search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }
  try {
    const token = await getFatSecretToken();
    const response = await fetch("https://platform.fatsecret.com/rest/server.api", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `method=foods.search&search_expression=${encodeURIComponent(query)}&format=json`
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("FatSecret API error response:", errorText);
      return res.status(500).json({ error: "FatSecret API error", details: errorText });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ FatSecret API error:", err.message || err);
    res.status(500).json({ error: "Server error contacting FatSecret API", details: err.message });
  }
});

/**
 * Get all registered users (for admin/debug)
 * GET /users
 * Returns: Array of users (without passwords)
 */
app.get("/users", async (req, res) => {
  try {
    const db = client.db("test");
    const users = db.collection("users");
    const allUsers = await users.find({}, { projection: { password: 0 } }).toArray();
    res.json(allUsers);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Server error fetching users." });
  }
});

/**
 * Get meal of the day for a user based on their goal
 * GET /meal-of-the-day?username=USERNAME
 * Returns: { mealOfTheDay }
 */
app.get("/meal-of-the-day", async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: "Username is required." });
  }
  try {
    const db = client.db("test");
    const answersCollection = db.collection("answers");
    const latestAnswers = await answersCollection.find({ username }).sort({ submittedAt: -1 }).limit(1).toArray();
    if (!latestAnswers.length) {
      return res.status(404).json({ message: "No answers found for user." });
    }
    const answers = latestAnswers[0].answers;
    let searchTerm = "healthy";
    if (answers.goal === "lose") searchTerm = "low calorie";
    else if (answers.goal === "gain") searchTerm = "high protein";
    else if (answers.goal === "keep") searchTerm = "balanced";
    const token = await getFatSecretToken();
    const response = await fetch("https://platform.fatsecret.com/rest/server.api", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `method=foods.search&search_expression=${encodeURIComponent(searchTerm)}&format=json`
    });
    let suggestedDishes = [];
    if (response.ok) {
      const data = await response.json();
      suggestedDishes = data.foods ? data.foods.food : [];
    } else {
      const errorText = await response.text();
      console.error("FatSecret API error response:", errorText);
      return res.status(500).json({ message: "FatSecret API error", details: errorText });
    }
    // Pick a different meal each day using the day of year
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    let mealOfTheDay = null;
    if (suggestedDishes.length > 0) {
      const index = dayOfYear % suggestedDishes.length;
      mealOfTheDay = suggestedDishes[index];
    }
    res.json({ mealOfTheDay });
  } catch (err) {
    console.error("❌ Error getting meal of the day:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
