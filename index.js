// Importing dependencies
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const pg = require("pg");
const bodyParser = require("body-parser");
const session = require("express-session");
require("dotenv").config(); // Load environment variables from .env file

// Initialize Express app and Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret", // Use environment variable or fallback
    resave: false,
    saveUninitialized: true,
  })
);

// PostgreSQL Database configuration
const db = new pg.Client({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false, // Enable SSL if specified
});
db.connect();

// Maintain a set of rooms
const rooms = new Set();

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.userName) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// Set view engine
app.set("view engine", "ejs");

// Routes
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM chatter");
    res.render("main", {
      messages: result.rows,
      userName: req.session.userName,
    });
  } catch (error) {
    console.error("Error fetching stored messages", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/login", async (req, res) => {
  const userName = req.body.username;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM chatter WHERE username=$1", [
      userName,
    ]);
    if (result.rows.length > 0) {
      const storedPassword = result.rows[0].password;

      if (storedPassword === password) {
        req.session.userName = userName;
        res.redirect("/");
      } else {
        res.send(
          '<script>alert("Invalid username or password"); window.location.href="/login";</script>'
        );
      }
    } else {
      res.send(
        '<script>alert("User not found, Try registering"); window.location.href="/register";</script>'
      );
    }
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userExists = await db.query(
      "SELECT * FROM chatter WHERE username=$1",
      [username]
    );
    if (userExists.rows.length > 0) {
      return res.send(
        '<script>alert("Username already exists"); window.location.href="/register";</script>'
      );
    }

    const emailExists = await db.query("SELECT * FROM chatter WHERE email=$1", [
      email,
    ]);
    if (emailExists.rows.length > 0) {
      return res.send(
        '<script>alert("Email already registered"); window.location.href="/register";</script>'
      );
    }

    await db.query(
      "INSERT INTO chatter (username, email, password) VALUES ($1, $2, $3)",
      [username, email, password]
    );
    req.session.userName = username;
    res.redirect("/");
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).send("Internal Server Error");
  }
});

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.emit("room list", Array.from(rooms));

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("join room", async (room) => {
    socket.join(room);
    rooms.add(room);

    try {
      const result = await db.query("SELECT * FROM chatter WHERE room=$1", [
        room,
      ]);
      socket.emit("existing messages", result.rows);
    } catch (error) {
      console.error("Error fetching room messages", error);
    }

    io.emit("room list", Array.from(rooms));
  });

  socket.on("chat message", async (data) => {
    const room = data.room;
    io.to(room).emit("chat message", data);

    try {
      await db.query(
        "INSERT INTO chatter (username, message, room) VALUES ($1, $2, $3)",
        [data.userName, data.message, room]
      );
    } catch (error) {
      console.error("Error inserting message into database", error);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () =>
  console.log(`Server running on port ${port} http://localhost:${port}`)
);
