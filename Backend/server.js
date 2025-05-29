import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcrypt";
import { MongoClient, ObjectId } from "mongodb";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 3001;

// Load quiz questions from file
const raw = fs.readFileSync("./data/quiz.json", "utf-8");
const quiz = JSON.parse(raw);

// MongoDB client setup
const client = new MongoClient(process.env.MONGO_URI);

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

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

// JWT middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token." });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token." });
    req.user = user;
    next();
  });
}

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
    // Generate JWT
    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "2h" });
    return res.status(200).json({ success: true, message: "Login successful!", token });
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
    // Generate JWT
    const token = jwt.sign({ username, email }, JWT_SECRET, { expiresIn: "2h" });
    res.status(201).json({ message: "User registered successfully!", token });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

function getMealCount(mealPreference) {
  if (mealPreference === "3") return 3;
  if (mealPreference === "4–5") return 5;
  if (mealPreference === "6 or more") return 6;
  return 3; // default
}

/**
 * Calculate comprehensive nutritional needs
 */
function calculateNutritionalNeeds(answers) {
  // BMR calculation (Mifflin-St Jeor)
  let bmr;
  if (answers.gender.toLowerCase() === "male") {
    bmr = 10 * answers.weight + 6.25 * answers.height - 5 * answers.age + 5;
  } else {
    bmr = 10 * answers.weight + 6.25 * answers.height - 5 * answers.age - 161;
  }

  // Activity multipliers
  const activityMultipliers = {
    "Sedentary (mostly sitting, desk job)": 1.2,
    "Lightly active (light movement, errands)": 1.375,
    "Moderately active (walks, active job)": 1.55,
    "Very active (physically demanding job)": 1.725
  };

  const tdee = bmr * (activityMultipliers[answers.activityLevel] || 1.2);

  // Adjust calories based on goal
  let targetCalories;
  let macroRatio;
  
  switch (answers.goal) {
    case "lose":
      targetCalories = tdee * 0.85;
      macroRatio = { protein: 0.3, carbs: 0.4, fat: 0.3 };
      break;
    case "gain":
      targetCalories = tdee * 1.15;
      macroRatio = { protein: 0.35, carbs: 0.45, fat: 0.2 };
      break;
    default:
      targetCalories = tdee;
      macroRatio = { protein: 0.25, carbs: 0.45, fat: 0.3 };
  }

  const proteinGrams = Math.round((targetCalories * macroRatio.protein) / 4);
  const carbGrams = Math.round((targetCalories * macroRatio.carbs) / 4);
  const fatGrams = Math.round((targetCalories * macroRatio.fat) / 9);

  return {
    targetCalories: Math.round(targetCalories),
    macros: {
      protein: proteinGrams,
      carbs: carbGrams,
      fat: fatGrams
    },
    mealsPerDay: getMealCount(answers["14.How many meals/snacks do you eat per day?"])
  };
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

    // Insert the answers first, mealPlan/nutrition will be updated after generation
    const insertResult = await answersCollection.insertOne({
      username,
      answers,
      submittedAt: new Date(),
      mealPlan: null,
      nutrition: null
    });

    const nutritionNeeds = calculateNutritionalNeeds(answers);
    const mealCount = getMealCount(answers["14.How many meals/snacks do you eat per day?"]);

    // Dietary preferences/allergies handling
    let diet = "";
    let intolerances = [];
    let excludeIngredients = [];
    if (answers["13.Do you follow any specific dietary preferences or have allergies?"]) {
      const prefs = answers["13.Do you follow any specific dietary preferences or have allergies?"];
      if (prefs.includes("Vegetarian")) {
        diet = "vegetarian";
        excludeIngredients.push("chicken,beef,pork,fish,seafood,gelatin");
      }
      if (prefs.includes("Vegan")) {
        diet = "vegan";
        excludeIngredients.push("chicken,beef,pork,fish,seafood,gelatin,egg,cheese,milk,honey,butter,yogurt");
      }
      if (prefs.includes("Gluten-free")) intolerances.push("gluten");
      if (prefs.includes("Lactose intolerant")) intolerances.push("dairy");
    }

    // Get meal plan from Spoonacular with exact meal count
    const spoonacularKey = process.env.SPOONACULAR_API_KEY;
    let spoonacularUrl = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${nutritionNeeds.targetCalories}&number=${mealCount}&apiKey=${spoonacularKey}`;
    if (diet) spoonacularUrl += `&diet=${encodeURIComponent(diet)}`;
    if (intolerances.length > 0) spoonacularUrl += `&intolerances=${encodeURIComponent(intolerances.join(","))}`;
    if (excludeIngredients.length > 0) spoonacularUrl += `&excludeIngredients=${encodeURIComponent(excludeIngredients.join(","))}`;

    const mealRes = await fetch(spoonacularUrl);
    let mealPlan = {};
    if (mealRes.ok) {
      mealPlan = await mealRes.json();
      if (mealPlan.meals) {
        while (mealPlan.meals.length < mealCount) {
          const additionalMealRes = await fetch(`https://api.spoonacular.com/recipes/random?number=1&apiKey=${spoonacularKey}`);
          if (additionalMealRes.ok) {
            const additionalMeal = await additionalMealRes.json();
            if (additionalMeal.recipes && additionalMeal.recipes[0]) {
              mealPlan.meals.push({
                id: additionalMeal.recipes[0].id,
                title: additionalMeal.recipes[0].title,
                readyInMinutes: additionalMeal.recipes[0].readyInMinutes,
                servings: additionalMeal.recipes[0].servings,
                sourceUrl: additionalMeal.recipes[0].sourceUrl,
                image: additionalMeal.recipes[0].image
              });
            }
          }
        }
        mealPlan.meals = mealPlan.meals.slice(0, mealCount);
        mealPlan.meals = mealPlan.meals.map(meal => {
          let image = meal.image;
          if (image && !image.startsWith("http")) {
            image = `https://img.spoonacular.com/recipes/${meal.id}-556x370.jpg`;
          }
          return { ...meal, image };
        });
      }
    }

    // Save mealPlan and nutrition info to the just-inserted answer document
    await answersCollection.updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          mealPlan,
          nutrition: {
            dailyCalories: nutritionNeeds.targetCalories,
            macros: nutritionNeeds.macros
          }
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Answers saved and meal plan generated!",
      dailyCalories: nutritionNeeds.targetCalories,
      macros: nutritionNeeds.macros,
      mealPlan
    });
  } catch (err) {
    console.error("❌ Error:", err);
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
 * Get detailed food info from FatSecret
 * GET /fatsecret-food/:id
 */
app.get("/fatsecret-food/:id", async (req, res) => {
  try {
    const token = await getFatSecretToken();
    const response = await fetch("https://platform.fatsecret.com/rest/server.api", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `method=food.get&food_id=${req.params.id}&format=json`
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch food details");
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Save user's favorite foods
 * POST /user-foods
 * Body: { username, foodId, foodName, servingSize }
 * Protected: JWT required
 */
app.post("/user-foods", authenticateJWT, async (req, res) => {
  try {
    const { foodId, foodName, servingSize } = req.body;
    const username = req.user.username;
    const db = client.db("test");
    await db.collection("userFoods").insertOne({
      username,
      foodId,
      foodName,
      servingSize,
      savedAt: new Date()
    });
    res.json({ message: "Food saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a user's saved food (e.g., serving size)
 * PUT /user-foods/:id
 * Body: { servingSize }
 * Protected: JWT required
 */
app.put("/user-foods/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { servingSize } = req.body;
    const username = req.user.username;
    const db = client.db("test");
    const result = await db.collection("userFoods").updateOne(
      { _id: new ObjectId(id), username },
      { $set: { servingSize } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Food not found or not owned by user." });
    }
    res.json({ message: "Food updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a user's saved food
 * DELETE /user-foods/:id
 * Protected: JWT required
 */
app.delete("/user-foods/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;
    const db = client.db("test");
    const result = await db.collection("userFoods").deleteOne({
      _id: new ObjectId(id),
      username
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Food not found or not owned by user." });
    }
    res.json({ message: "Food deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get user's saved foods
 * GET /user-foods/:username
 * Protected: JWT required, only allow user to get their own foods
 */
app.get("/user-foods/:username", authenticateJWT, async (req, res) => {
  try {
    const username = req.user.username;
    if (username !== req.params.username) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const db = client.db("test");
    const foods = await db.collection("userFoods")
      .find({ username })
      .sort({ savedAt: -1 })
      .toArray();
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  if (!username || username.trim() === '') {
    return res.status(400).json({ 
      success: false,
      message: "Please provide a valid username"
    });
  }

  try {
    const db = client.db("test");
    const answersCollection = db.collection("answers");
    // Get latest answer with mealPlan for this user
    const latestAnswers = await answersCollection.find({ username }).sort({ submittedAt: -1 }).limit(1).toArray();
    
    if (!latestAnswers.length) {
      return res.status(404).json({ 
        success: false,
        message: "No answers found for user." 
      });
    }

    // If mealPlan exists in DB, return it directly
    if (latestAnswers[0].mealPlan && latestAnswers[0].nutrition) {
      return res.json({
        success: true,
        message: "Meal plan loaded from database!",
        dailyCalories: latestAnswers[0].nutrition.dailyCalories,
        macros: latestAnswers[0].nutrition.macros,
        mealPlan: latestAnswers[0].mealPlan
      });
    }

    // Fallback: generate meal plan if not present (should rarely happen)
    const answers = latestAnswers[0].answers;
    const nutritionNeeds = calculateNutritionalNeeds(answers);
    let mealCount;
    const mealAnswer = answers["14.How many meals/snacks do you eat per day?"];
    if (mealAnswer === "3") mealCount = 3;
    else if (mealAnswer === "4–5") mealCount = 5;
    else if (mealAnswer === "6 or more") mealCount = 6;
    else mealCount = 3;

    const caloriesPerMeal = Math.round(nutritionNeeds.targetCalories / mealCount);
    let allMeals = [];
    const batchSize = 3;
    const batches = Math.ceil(mealCount / batchSize);

    for (let i = 0; i < batches; i++) {
      const remainingMeals = mealCount - (i * batchSize);
      const currentBatchSize = Math.min(remainingMeals, batchSize);
      const spoonacularKey = process.env.SPOONACULAR_API_KEY;
      let spoonacularUrl = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${caloriesPerMeal * currentBatchSize}&number=${currentBatchSize}&apiKey=${spoonacularKey}`;
      let diet = "";
      let intolerances = [];
      let excludeIngredients = [];
      if (answers["13.Do you follow any specific dietary preferences or have allergies?"]) {
        const prefs = answers["13.Do you follow any specific dietary preferences or have allergies?"];
        if (prefs.includes("Vegetarian")) {
          diet = "vegetarian";
          excludeIngredients.push("chicken,beef,pork,fish,seafood,gelatin");
        }
        if (prefs.includes("Vegan")) {
          diet = "vegan";
          excludeIngredients.push("chicken,beef,pork,fish,seafood,gelatin,egg,cheese,milk,honey,butter,yogurt");
        }
        if (prefs.includes("Gluten-free")) intolerances.push("gluten");
        if (prefs.includes("Lactose intolerant")) intolerances.push("dairy");
      }
      if (diet) spoonacularUrl += `&diet=${encodeURIComponent(diet)}`;
      if (intolerances.length > 0) spoonacularUrl += `&intolerances=${encodeURIComponent(intolerances.join(","))}`;
      if (excludeIngredients.length > 0) spoonacularUrl += `&excludeIngredients=${encodeURIComponent(excludeIngredients.join(","))}`;

      const mealRes = await fetch(spoonacularUrl);
      if (mealRes.ok) {
        const batchPlan = await mealRes.json();
        if (batchPlan.meals) {
          const enrichedMeals = await Promise.all(batchPlan.meals.map(async (meal) => {
            let image = meal.image;
            if (!meal.sourceUrl || !image) {
              const detailsRes = await fetch(
                `https://api.spoonacular.com/recipes/${meal.id}/information?apiKey=${spoonacularKey}`
              );
              if (detailsRes.ok) {
                const details = await detailsRes.json();
                image = details.image || image;
                return {
                  ...meal,
                  sourceUrl: details.sourceUrl,
                  image: image && !image.startsWith("http")
                    ? `https://img.spoonacular.com/recipes/${meal.id}-556x370.jpg`
                    : image
                };
              }
            }
            if (image && !image.startsWith("http")) {
              image = `https://img.spoonacular.com/recipes/${meal.id}-556x370.jpg`;
            }
            return { ...meal, image };
          }));
          allMeals = [...allMeals, ...enrichedMeals];
        }
      }
    }

    // Construct final response
    const mealPlan = {
      meals: allMeals.slice(0, mealCount),
      nutrients: {
        calories: nutritionNeeds.targetCalories,
        protein: nutritionNeeds.macros.protein,
        fat: nutritionNeeds.macros.fat,
        carbohydrates: nutritionNeeds.macros.carbs
      }
    };

    // Save the generated mealPlan and nutrition info to the latest answer document
    await answersCollection.updateOne(
      { _id: latestAnswers[0]._id },
      {
        $set: {
          mealPlan,
          nutrition: {
            dailyCalories: nutritionNeeds.targetCalories,
            macros: nutritionNeeds.macros
          }
        }
      }
    );

    res.json({
      success: true,
      message: "Meal plan generated and saved!",
      dailyCalories: nutritionNeeds.targetCalories,
      macros: nutritionNeeds.macros,
      mealPlan
    });

  } catch (err) {
    console.error("❌ Error getting meal of the day:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * Get users with their quiz answers
 * GET /user-details
 * Returns: Array of usernames and their quiz answers
 */
app.get("/user-details", async (req, res) => {
  try {
    const { username } = req.query;
    const db = client.db("test");
    const answersCollection = db.collection("answers");

    if (username) {
      // Get only the latest answer for the specific user
      const userAnswer = await answersCollection
        .find({ username })
        .sort({ submittedAt: -1 })
        .limit(1)
        .toArray();

      if (userAnswer.length === 0) {
        return res.json({
          success: true,
          count: 0,
          users: []
        });
      }

      const simplifiedAnswer = {
        username: userAnswer[0].username,
        answers: userAnswer[0].answers
      };

      return res.json({
        success: true,
        count: 1,
        users: [simplifiedAnswer]
      });
    }

    // If no username provided, get all users' latest answers
    const userAnswers = await answersCollection
      .find({})
      .sort({ submittedAt: -1 })
      .toArray();

    const simplifiedAnswers = userAnswers.map(entry => ({
      username: entry.username,
      answers: entry.answers
    }));

    res.json({
      success: true,
      count: simplifiedAnswers.length,
      users: simplifiedAnswers
    });
  } catch (err) {
    console.error("❌ Error fetching user answers:", err);
    res.status(500).json({ message: "Server error fetching answers." });
  }
});

/**
 * Test endpoint to check user answers
 * POST /test-answers
 * Adds sample test data and returns all user details
 */
app.post("/test-answers", async (req, res) => {
  try {
    const db = client.db("test");
    const answersCollection = db.collection("answers");

    // Complete sample test data matching all quiz questions
    const testAnswers = [
      {
        username: "testuser1",
        answers: {
          "1.What is your age?": "25",
          "2.What is your gender?": "Male",
          "3.What is your current weight?": "70",
          "4.What is your height?": "175",
          "5.What is your primary goal?": "Gain muscle",
          "6.By when would you like to reach this goal?": "3 months",
          "7.What is your daily activity level (outside of workouts)?": "Moderately active (walks, active job)",
          "8.How many days per week do you plan to work out?": "3–4 days",
          "9.How long is a typical workout session for you?": "45–60 minutes",
          "10.Which types of workouts do you enjoy/prefer?": ["Strength training / Weightlifting", "HIIT (High-Intensity Interval Training)"],
          "11.Do you have any injuries or medical conditions we should know about?": "No",
          "13.Do you follow any specific dietary preferences or have allergies?": ["None"],
          "14.How many meals/snacks do you eat per day?": "4–5",
          // Additional fields needed for calculations
          age: "25",
          gender: "Male",
          weight: "70",
          height: "175",
          goal: "gain",
          activityLevel: "Moderately active (walks, active job)"
        }
      },
      {
        username: "testuser2",
        answers: {
          "1.What is your age?": "30",
          "2.What is your gender?": "Female",
          "3.What is your current weight?": "65",
          "4.What is your height?": "165",
          "5.What is your primary goal?": "Lose weight",
          "6.By when would you like to reach this goal?": "6 months",
          "7.What is your daily activity level (outside of workouts)?": "Lightly active (light movement, errands)",
          "8.How many days per week do you plan to work out?": "5–6 days",
          "9.How long is a typical workout session for you?": "30–45 minutes",
          "10.Which types of workouts do you enjoy/prefer?": ["Cardio (running, biking)", "Yoga / Mobility"],
          "11.Do you have any injuries or medical conditions we should know about?": "No",
          "13.Do you follow any specific dietary preferences or have allergies?": ["Vegetarian"],
          "14.How many meals/snacks do you eat per day?": "3",
          // Additional fields needed for calculations
          age: "30",
          gender: "Female",
          weight: "65",
          height: "165",
          goal: "lose",
          activityLevel: "Lightly active (light movement, errands)"
        }
      }
    ];

    // Clear existing test data
    await answersCollection.deleteMany({ 
      username: { $in: ["testuser1", "testuser2"] } 
    });

    // Insert test data
    await answersCollection.insertMany(testAnswers);

    // Get all user details to verify
    const allAnswers = await answersCollection
      .find({})
      .toArray();

    res.json({
      success: true,
      message: "Test data added successfully",
      testData: testAnswers,
      allAnswers: allAnswers.map(({ username, answers }) => ({ username, answers }))
    });

  } catch (err) {
    console.error("❌ Error adding test data:", err);
    res.status(500).json({ message: "Server error adding test data." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

