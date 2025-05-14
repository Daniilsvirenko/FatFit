import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcrypt";
import { MongoClient } from "mongodb";

const app = express();
const PORT = 3001;
const raw = fs.readFileSync("./data/quiz.json", "utf-8");
const quiz = JSON.parse(raw);

const client = new MongoClient(process.env.MONGO_URI);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Conexiune reușită la MongoDB Atlas!");
  } catch (err) {
    console.error("❌ Eroare la conectare:", err);
  }
}

connectDB();
app.post("/login", async (req, res) => {
  const {username,password} = req.body
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username și parolă sunt obligatorii." });
  }
  try{
    const db = client.db("test");
    const users = db.collection("users");
    const TheUser = await users.findOne({ username });
    if (!TheUser) {
      return res.status(401).json({ message: "Username sau parolă greșită." });
    }
    const isMatch = await bcrypt.compare(password, TheUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Username sau parolă greșită." });
    }
    return res.status(200).json({ success: true, message: "Login reușit!" });
  } catch (err) {
    console.error("❌ Eroare la login:", err);
    return res.status(500).json({ message: "Eroare la server la log In " });
  }
});
// ✅ Endpoint: Verificare existență user/email
app.post("/check-user", async (req, res) => {
  const { username, email } = req.body;

  if (!username && !email) {
    return res
      .status(400)
      .json({ exists: false, message: "Username sau email lipsă" });
  }

  try {
    const db = client.db("test");
    const users = db.collection("users");

    const existingUser = await users.findOne({
      $or: [...(username ? [{ username }] : []), ...(email ? [{ email }] : [])],
    });

    if (existingUser) {
      return res.status(200).json({ exists: true });
    }

    return res.status(200).json({ exists: false });
  } catch (err) {
    console.error("Eroare la verificare:", err);
    return res.status(500).json({ message: "Eroare la server" });
  }
});

// ✅ Endpoint: Înregistrare user (fără answers)
app.post("/register", async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;

    if (!username || !password || !email || !fullname) {
      return res
        .status(400)
        .json({ message: "Username, email, fullname și parolă obligatorii." });
    }

    const db = client.db("test");
    const users = db.collection("users");

    const existingUser = await users.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      return res.status(400).json({ message: "Utilizatorul există deja." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await users.insertOne({
      fullname,
      username,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "Utilizator înregistrat cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la înregistrare:", err);
    res.status(500).json({ message: "Eroare la server." });
  }
});

// ✅ Endpoint: Salvare răspunsuri quiz
app.post("/answers", async (req, res) => {
  const { username, answers } = req.body;

  if (!username || !answers || typeof answers !== "object") {
    return res.status(400).json({
      success: false,
      message: "Username sau answers lipsesc sau sunt invalide.",
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

    res
      .status(201)
      .json({ success: true, message: "Răspunsuri salvate cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la salvarea răspunsurilor:", err);
    res.status(500).json({ success: false, message: "Eroare la server." });
  }
});

// ✅ Endpoint: Quiz
app.get("/quiz", (req, res) => {
  res.send(quiz);
});

// ✅ Endpoint: Health check
app.get("/", (req, res) => {
  res.send("Backend operational");
});

app.listen(PORT, () => {
  console.log(`Serverul rulează pe http://localhost:${PORT}`);
});
