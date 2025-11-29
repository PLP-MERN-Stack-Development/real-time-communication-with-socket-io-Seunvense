// socket.js - Socket.io client setup

import { io } from "socket.io-client";
import { useEffect, useState } from "react";

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [privateMessages, setPrivateMessages] = useState({});
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Connect to socket server
  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit("user_join", username);
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message
  const sendMessage = (messageObj) => {
    socket.emit("send_message", messageObj); // send directly
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    socket.emit("private_message", { to, message });
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit("typing", isTyping);
  };

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Add this function 👇
    const onReceiveMessage = (message) => {
      console.log("Global message received:", message);
      setLastMessage(message);
      setMessages((prev) => [...prev, { ...message, isPrivate: false }]);
    };

    // Private message events
    const onPrivateMessage = (message) => {
      console.log("Private message received:", message);
      setLastMessage(message);

      const partnerId =
        message.senderId === socket.id ? message.to : message.senderId;

      setPrivateMessages((prev) => ({
        ...prev,
        [partnerId]: [
          ...(prev[partnerId] || []),
          { ...message, isPrivate: true },
        ],
      }));
    };

    // User list & typing events
    const onUserList = (userList) => setUsers(userList);
    const onUserJoined = (user) =>
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    const onUserLeft = (user) =>
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    const onTypingUsers = (users) => setTypingUsers(users);

    // 👉 Register event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage); // FIXED
    socket.on("private_message", onPrivateMessage);
    socket.on("user_list", onUserList);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);

    // Cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("private_message", onPrivateMessage);
      socket.off("user_list", onUserList);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("typing_users", onTypingUsers);
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    privateMessages,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
  };
};

export default socket;
