// server.js - Socket.io Server with 50MB File Support

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Increase limit to 50MB for files
  maxHttpBufferSize: 50 * 1024 * 1024,
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const users = {};
const messages = [];
const typingUsers = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- NEW: Delete Message Handler (MOVED INSIDE) ---
  socket.on("delete_message", (messageId) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      messages.splice(index, 1); // Remove from server memory
      io.emit("message_deleted", messageId); // Tell everyone to remove it
    }
  });

  // Reaction Handler
  socket.on("add_reaction", ({ messageId, emoji, to }) => {
    if (to) {
      const reactionData = { messageId, emoji, reactorId: socket.id };
      io.to(to).emit("private_reaction", reactionData);
      socket.emit("private_reaction", reactionData);
    } else {
      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
        if (!msg.reactions[emoji].includes(socket.id)) {
          msg.reactions[emoji].push(socket.id);
        }
        io.emit("global_reaction_update", {
          messageId,
          reactions: msg.reactions,
        });
      }
    }
  });

  socket.on("typing_private", ({ to, isTyping }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit("typing_private", { from: socket.id, isTyping });
    }
    socket.emit("typing_private", { from: socket.id, isTyping });
  });

  socket.on("user_join", (username) => {
    users[socket.id] = { username, id: socket.id };
    io.emit("user_list", Object.values(users));
    io.emit("user_joined", { username, id: socket.id });
    console.log(`${username} joined the chat`);
  });

  socket.on("send_message", (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: users[socket.id]?.username || "Anonymous",
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      reactions: {},
    };
    messages.push(message);
    if (messages.length > 100) messages.shift();
    io.emit("receive_message", message);
  });

  socket.on("typing", (isTyping) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      if (isTyping) typingUsers[socket.id] = username;
      else delete typingUsers[socket.id];
      io.emit("typing_users", Object.values(typingUsers));
    }
  });

  socket.on("private_message", ({ to, encrypted }) => {
    const messageData = {
      id: Date.now(),
      sender: users[socket.id]?.username || "Anonymous",
      senderId: socket.id,
      receiverId: to,
      encrypted,
      timestamp: new Date().toISOString(),
      isPrivate: true,
      reactions: {},
    };

    const receiverSocket = io.sockets.sockets.get(to);
    if (receiverSocket) {
      receiverSocket.emit("private_message", messageData);
      socket.emit("message_delivered", { messageId: messageData.id });
    } else {
      socket.emit("private_message", messageData);
    }
    // Always send back to sender so they see it instantly
    socket.emit("private_message", messageData);
  });

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit("user_left", { username, id: socket.id });
    }
    delete users[socket.id];
    delete typingUsers[socket.id];
    io.emit("user_list", Object.values(users));
    io.emit("typing_users", Object.values(typingUsers));
  });
});

app.get("/api/messages", (req, res) => {
  res.json(messages);
});
app.get("/api/users", (req, res) => {
  res.json(Object.values(users));
});
app.get("/", (req, res) => {
  res.send("Socket.io Chat Server is running");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
