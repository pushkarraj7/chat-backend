require("dotenv").config(); // Load environment variables
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// Express and server setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Message schema and model
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Message", messageSchema);

// Socket.IO logic
let users = {}; // Keep track of connected users

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Store user connection info
  socket.on("register_user", (username) => {
    users[username] = socket.id; // Store socket.id for each username
    console.log(`${username} connected with id: ${socket.id}`);
  });

  // Send private message to a specific user
  socket.on("send_message", async (data) => {
    const { message, recipient } = data;

    // Check if recipient is online
    if (users[recipient]) {
      const newMessage = new Message({
        username: data.username,
        message,
      });
      await newMessage.save();

      // Emit the message to the recipient (private)
      io.to(users[recipient]).emit("receive_message", newMessage);
      // Optionally, send the message back to the sender
      socket.emit("receive_message", newMessage);
    } else {
      console.log("User not connected:", recipient);
    }
  });

  socket.on("disconnect", () => {
    // Remove user from users list when disconnected
    for (let user in users) {
      if (users[user] === socket.id) {
        console.log(`${user} disconnected`);
        delete users[user];
      }
    }
  });
});

// Start the server
server.listen(5000, () => console.log("Server running on port 5000"));
