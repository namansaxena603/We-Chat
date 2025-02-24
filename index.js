const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const pg = require("pg");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "We-chat",
    resave: false,
    saveUninitialized: true,
  })
);

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "chat",
  password: "1234",
  port: 5432,
});
db.connect();

const rooms = new Set(); // Maintain a set of rooms

function isAuthenticated(req, res, next) {
  if (req.session.userName) {
    return next();
  } else {
    res.redirect("/login");
  }
}

app.set("view engine", "ejs");

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

  console.log(`Attempting login: ${userName}`);
  try {
    const result = await db.query("SELECT * FROM chatter WHERE username=$1", [
      userName,
    ]);

    console.log(`Query result: ${JSON.stringify(result.rows)}`);

    if (result.rows.length > 0) {
      const storedPassword = result.rows[0].password;

      if (storedPassword == password) {
        // Loose comparison to cover potential type mismatches
        req.session.userName = userName; // Store username in session
        console.log(`User logged in: ${userName}`);
        res.redirect("/"); // Ensure redirect to /
      } else {
        console.log("Incorrect username or password");
        res.send(
          '<script>alert("Invalid username or password"); window.location.href="/login";</script>'
        ); // Display alert message
      }
    } else {
      console.log("User not found");
      res.send(
        '<script>alert("User not found, Try registering"); window.location.href="/register";</script>'
      ); // Display alert message
    }
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  console.log(`Attempting registration: ${username}`);
  try {
    const userExists = await db.query(
      "SELECT * FROM chatter WHERE username=$1",
      [username]
    );
    if (userExists.rows.length > 0) {
      console.log("Username already exists");
      return res.send(
        '<script>alert("Username already exists"); window.location.href="/register";</script>'
      ); // Display alert message
    }

    const emailExists = await db.query("SELECT * FROM chatter WHERE email=$1", [
      email,
    ]);
    if (emailExists.rows.length > 0) {
      console.log("Email already registered");
      return res.send(
        '<script>alert("Email already registered"); window.location.href="/register";</script>'
      ); // Display alert message
    }

    await db.query(
      "INSERT INTO chatter (username, email, password) VALUES ($1, $2, $3)",
      [username, email, password]
    );
    console.log(`User registered: ${username}, ${email}`);
    req.session.userName = username; // Store username in session
    res.redirect("/");
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).send("Internal Server Error");
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // Send the list of rooms to the user
  socket.emit("room list", Array.from(rooms));
  console.log("Emitted room list:", Array.from(rooms));

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
      console.log(`Fetched messages for room ${room}:`, result.rows); // Debugging log
      socket.emit("existing messages", result.rows);
    } catch (error) {
      console.error("Error fetching room messages", error);
    }

    io.emit("room list", Array.from(rooms));
    console.log("Emitted updated room list:", Array.from(rooms));
  });

  socket.on("chat message", async (data) => {
    const room = data.room;
    io.to(room).emit("chat message", data); // Broadcast the message to the room
    console.log(
      `Message from ${data.userName} in ${data.room}: ${data.message}`
    );

    try {
      await db.query(
        "INSERT INTO chatter (username, message, room) VALUES ($1, $2, $3)",
        [data.userName, data.message, room]
      );
      console.log(`Inserted message into room ${room}: ${data.message}`);
    } catch (error) {
      console.error("Error inserting message into database", error);
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000 http://localhost:3000");
});
