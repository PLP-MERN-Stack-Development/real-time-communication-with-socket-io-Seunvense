// socket.js - Socket.io client setup with E2EE

import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import CryptoJS from "crypto-js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Simple E2EE helper — generates key from usernames (alphabetical order for consistency)
const getChatKey = (user1, user2) => {
  const sorted = [user1, user2].sort().join("-");
  return CryptoJS.SHA256(sorted).toString(); // Secure hash as key
};

// Encrypt function
const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

// Decrypt function - NEW (Safe version)
const decryptMessage = (encrypted, key) => {
  try {
    // 1. Safety Check: If encrypted is empty or undefined, stop immediately.
    if (!encrypted) return "Error: No encrypted data";

    // 2. Try to decrypt
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed:", error);
    return "Could not decrypt message";
  }
};

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
    const myUsername = users.find((u) => u.id === socket.id)?.username;
    const theirUsername = users.find((u) => u.id === to)?.username;

    if (!myUsername || !theirUsername) {
      console.error("Cannot encrypt: Users not found");
      return;
    }

    const key = getChatKey(myUsername, theirUsername);
    const encrypted = encryptMessage(message, key);

    socket.emit("private_message", { to, encrypted });
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

    // --- RESTORED MISSING FUNCTION ---
    const onUserList = (userList) => {
      setUsers(userList);
      // Save to localStorage (Optional, but good for persistence)
      // Note: localStorage APIs are synchronous, be careful with large lists
      // localStorage.setItem("knownUsers", JSON.stringify(userList));
    };
    // --------------------------------

    const onPrivateMessage = (data) => {
      // DEBUG: See exactly what the server sent us
      console.log("Raw incoming private message:", data);

      // 1. Destructure BOTH 'encrypted' and 'message' (for backward compatibility)
      const { encrypted, message, senderId, receiverId, ...rest } = data;
      const partnerId = senderId === socket.id ? receiverId : senderId;

      const myUsername = users.find((u) => u.id === socket.id)?.username;
      const theirUsername = users.find((u) => u.id === partnerId)?.username;

      if (!myUsername || !theirUsername) return;

      const key = getChatKey(myUsername, theirUsername);

      // 2. DETERMINE CONTENT
      // If we have encrypted data, decrypt it.
      // If not, check if we have a plain 'message' (fallback for old code).
      let finalMessage = "";

      if (encrypted) {
        finalMessage = decryptMessage(encrypted, key);
      } else if (message) {
        finalMessage = message; // It was never encrypted (legacy)
      } else {
        finalMessage = "<i>Message content missing</i>";
      }

      setPrivateMessages((prev) => {
        const existing = prev[partnerId] || [];
        const updated = [
          ...existing,
          {
            ...rest,
            message: finalMessage, // Use the safe result
            senderId,
            receiverId,
            isPrivate: true,
            delivered: true,
            read: selectedUser?.id === partnerId,
          },
        ];
        return { ...prev, [partnerId]: updated };
      });
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
    socket.on("user_list", onUserList); // This line caused the error because function was missing
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);
    socket.on("typing_private", onPrivateTyping);

    // Cleanup
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
  }, [selectedUser, users]);

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
