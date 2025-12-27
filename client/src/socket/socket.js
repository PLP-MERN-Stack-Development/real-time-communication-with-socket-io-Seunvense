// socket.js - Fixed Private Replies & Encryption

import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import CryptoJS from "crypto-js";

// --- CHANGE: Dynamic URL Selection ---
// 1. If VITE_SOCKET_URL is set in .env, use it.
// 2. Otherwise, default to your Render URL for production.
// 3. Keep localhost as a fallback only for local dev if .env is missing.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "https://starapp-c5h0.onrender.com";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const getChatKey = (user1, user2) => {
  const sorted = [user1, user2].sort().join("-");
  return CryptoJS.SHA256(sorted).toString();
};

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encrypted, key) => {
  try {
    if (!encrypted) return null;
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
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

  const deleteMessage = (messageId) => {
    socket.emit("delete_message", messageId);
  };

  const sendReaction = (messageId, emoji) => {
    const to = selectedUser ? selectedUser.id : null;
    socket.emit("add_reaction", { messageId, emoji, to });
  };

  const sendPrivateMessage = (to, contentObj) => {
    const myUsername = users.find((u) => u.id === socket.id)?.username;
    const theirUsername = users.find((u) => u.id === to)?.username;

    if (!myUsername || !theirUsername) return;

    const key = getChatKey(myUsername, theirUsername);
    const payloadString = JSON.stringify(contentObj);
    const encrypted = encryptMessage(payloadString, key);

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
      setLastMessage(message);
      setMessages((prev) => [...prev, { ...message, isPrivate: false }]);
    };

    const onMessageDeleted = (messageId) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setPrivateMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((userId) => {
          updated[userId] = updated[userId].filter(
            (msg) => msg.id !== messageId
          );
        });
        return updated;
      });
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

    const onUserList = (userList) => setUsers(userList);

    const onPrivateMessage = (data) => {
      const { encrypted, message, senderId, receiverId, ...rest } = data;
      const partnerId = senderId === socket.id ? receiverId : senderId;
      const myUsername = users.find((u) => u.id === socket.id)?.username;
      const theirUsername = users.find((u) => u.id === partnerId)?.username;

      if (!myUsername || !theirUsername) return;

      const key = getChatKey(myUsername, theirUsername);

      let decryptedText = "";
      let decryptedReplyTo = null;

      if (encrypted) {
        const rawDecrypted = decryptMessage(encrypted, key);
        if (rawDecrypted) {
          try {
            const parsed = JSON.parse(rawDecrypted);
            decryptedText = parsed.message || parsed;
            decryptedReplyTo = parsed.replyTo || null;
          } catch (e) {
            decryptedText = rawDecrypted;
          }
        } else {
          decryptedText = "<i>Message content missing</i>";
        }
      } else if (message) {
        decryptedText = message;
      }

      setPrivateMessages((prev) => {
        const existing = prev[partnerId] || [];
        const updated = [
          ...existing,
          {
            ...rest,
            message: decryptedText,
            replyTo: decryptedReplyTo,
            senderId,
            receiverId,
            isPrivate: true,
            delivered: true,
            read: selectedUser?.id === partnerId,
            reactions: {},
          },
        ];
        return { ...prev, [partnerId]: updated };
      });
    };

    const onGlobalReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
      );
    };

    const onPrivateReaction = ({ messageId, emoji, reactorId }) => {
      setPrivateMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((partnerId) => {
          updated[partnerId] = updated[partnerId].map((msg) => {
            if (msg.id === messageId) {
              const currentReactions = msg.reactions || {};
              const emojiUsers = currentReactions[emoji] || [];
              if (!emojiUsers.includes(reactorId)) {
                return {
                  ...msg,
                  reactions: {
                    ...currentReactions,
                    [emoji]: [...emojiUsers, reactorId],
                  },
                };
              }
            }
            return msg;
          });
        });
        return updated;
      });
    };

    const onUserJoined = (user) =>
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined`,
          timestamp: new Date().toISOString(),
        },
      ]);

    const onUserLeft = (user) =>
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left`,
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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_delivered", onMessageDelivered);
    socket.on("private_message", onPrivateMessage);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("user_list", onUserList);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);
    socket.on("typing_private", onPrivateTyping);
    socket.on("global_reaction_update", onGlobalReaction);
    socket.on("private_reaction", onPrivateReaction);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_delivered", onMessageDelivered);
      socket.off("private_message", onPrivateMessage);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("user_list", onUserList);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("typing_users", onTypingUsers);
      socket.off("typing_private", onPrivateTyping);
      socket.off("global_reaction_update", onGlobalReaction);
      socket.off("private_reaction", onPrivateReaction);
    };
  }, [selectedUser, users]);

  return {
    socket,
    isConnected,
    messages,
    users,
    globalTypingUsers,
    privateTypingUsers,
    privateMessages,
    setPrivateMessages,
    connect,
    disconnect,
    sendMessage,
    deleteMessage,
    sendPrivateMessage,
    setTyping,
    sendReaction,
  };
};

export default socket;
