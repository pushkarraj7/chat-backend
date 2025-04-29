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
  sender: String,     // who sends the message
  recipient: String,  // who receives the message
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

  // Register user
  socket.on("register_user", (username) => {
    users[username] = socket.id;
    console.log(`${username} connected with id: ${socket.id}`);
  });

  // Fetch previous chats between two users
  socket.on("load_messages", async ({ sender, recipient }) => {
    const messages = await Message.find({
      $or: [
        { sender, recipient },
        { sender: recipient, recipient: sender },
      ],
    }).sort({ timestamp: 1 });

    socket.emit("previous_messages", messages);
  });

  // Sending a message
  socket.on("send_message", async (data) => {
    const { sender, recipient, message } = data;

    const newMessage = new Message({
      sender,
      recipient,
      message,
    });
    await newMessage.save();

    // Emit to recipient if online
    if (users[recipient]) {
      io.to(users[recipient]).emit("receive_message", newMessage);
    }

    // Emit to sender as well to show immediately
    socket.emit("receive_message", newMessage);
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    for (let user in users) {
      if (users[user] === socket.id) {
        console.log(`${user} disconnected`);
        delete users[user];
        break;
      }
    }
  });
});

// Start the server
server.listen(5000, () => console.log("Server running on port 5000"));
