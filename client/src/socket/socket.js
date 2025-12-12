// socket.js - Socket.io client setup

import { io } from "socket.io-client";
import { useEffect, useState } from "react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export const useSocket = (selectedUser) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [privateMessages, setPrivateMessages] = useState({});
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [globalTypingUsers, setGlobalTypingUsers] = useState([]);
  const [privateTypingUsers, setPrivateTypingUsers] = useState([]);

  const connect = (username) => {
    socket.connect();
    if (username) socket.emit("user_join", username);
  };

  const disconnect = () => socket.disconnect();

  const sendMessage = (messageObj) => {
    socket.emit("send_message", messageObj);
  };

  const sendPrivateMessage = (to, message) => {
    socket.emit("private_message", { to, message });
  };

  const setTyping = (isTyping) => {
    if (!selectedUser) {
      socket.emit("typing", isTyping);
    } else {
      socket.emit("typing_private", { to: selectedUser.id, isTyping });
    }
  };

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onReceiveMessage = (message) => {
      console.log("Global message received:", message);
      setLastMessage(message);
      setMessages((prev) => [...prev, { ...message, isPrivate: false }]);
    };

    const onMessageDelivered = ({ messageId }) => {
      setPrivateMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((partnerId) => {
          updated[partnerId] = updated[partnerId].map((msg) =>
            msg.id === messageId ? { ...msg, delivered: true } : msg
          );
        });
        return updated;
      });
    };

    const onPrivateMessage = (message) => {
      const partnerId =
        message.senderId === socket.id ? message.receiverId : message.senderId;
      const isCurrentlyViewing = selectedUser?.id === partnerId;

      setPrivateMessages((prev) => ({
        ...prev,
        [partnerId]: [
          ...(prev[partnerId] || []),
          {
            ...message,
            isPrivate: true,
            delivered: true,
            read: isCurrentlyViewing,
          },
        ],
      }));
    };

    const onUserList = (userList) => {
      setUsers(userList);
      // Save to localStorage
      localStorage.setIn(
        "knownUsers",
        JSON.stringify(
          userList.map((u) => ({ id: u.id, username: u.username }))
        )
      );
    };

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

    const onTypingUsers = (users) => setGlobalTypingUsers(users);

    const onPrivateTyping = ({ from, isTyping }) => {
      if (from === socket.id) return;
      const username = users.find((u) => u.id === from)?.username;
      if (!username || selectedUser?.id !== from) return;
      setPrivateTypingUsers(isTyping ? [username] : []);
    };

    // Register all listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_delivered", onMessageDelivered);
    socket.on("private_message", onPrivateMessage);
    socket.on("user_list", onUserList);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);
    socket.on("typing_private", onPrivateTyping);

    // Cleanup — ONLY ONE RETURN!
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_delivered", onMessageDelivered);
      socket.off("private_message", onPrivateMessage);
      socket.off("user_list", onUserList);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("typing_users", onTypingUsers);
      socket.off("typing_private", onPrivateTyping);
    };
  }, [selectedUser, users]); // Add 'users' so typing works

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    globalTypingUsers,
    privateTypingUsers,
    privateMessages,
    setPrivateMessages,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
  };
};

export default socket;
