import { useEffect, useState, useRef } from "react";
import { useSocket } from "./socket/socket.js";

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({}); // { "global": "hello", "user123": "hey there" }
  const [selectedUser, setSelectedUser] = useState(null); // null = global, object = private chat

  const {
    connect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    isConnected,
    messages = [],
    users = [],
    typingUsers = [],
    privateMessages,
    setPrivateMessages,
  } = useSocket(selectedUser);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isUserScrolling = useRef(false);

  // Define currentMessages HERE — BEFORE any useEffect that uses it!
  const currentMessages = selectedUser
    ? privateMessages[selectedUser?.id] || []
    : messages.filter((msg) => !msg.isPrivate);

  const chatTitle = selectedUser
    ? `Chat with ${selectedUser.username}`
    : "Global Chat";

  useEffect(() => {
    // Don't auto-scroll if user is manually scrolling up
    if (isUserScrolling.current) return;

    const lastMsg = currentMessages[currentMessages.length - 1];
    if (!lastMsg) return;

    const myUserId = users.find((u) => u.username === username)?.id;
    const isMyMessage = lastMsg.senderId === myUserId;

    if (isMyMessage) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        isUserScrolling.current = false; // Reset after scroll
      }, 100);
    }
  }, [currentMessages.length, selectedUser, users, username]);

  // PERFECT DRAFT SYSTEM — NO MORE MIXING
  useEffect(() => {
    // When user switches chat → save current draft + load new one
    const saveCurrentDraft = () => {
      const currentChatId = selectedUser?.id || "global";
      if (message.trim() !== "") {
        setDrafts((prev) => ({ ...prev, [currentChatId]: message }));
      } else {
        setDrafts((prev) => {
          const copy = { ...prev };
          delete copy[currentChatId];
          return copy;
        });
      }
    };

    saveCurrentDraft();

    // Load the draft for the NEW chat
    const newChatId = selectedUser?.id || "global";
    const saved = drafts[newChatId];
    if (saved !== undefined) {
      setMessage(saved);
    } else {
      setMessage("");
    }
  }, [selectedUser]);

  // Save draft while typing (so it's never lost)
  useEffect(() => {
    if (!selectedUser && selectedUser !== null) return; // wait for first render
    const chatId = selectedUser?.id || "global";
    if (message.trim() === "") {
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[chatId];
        return copy;
      });
    } else {
      setDrafts((prev) => ({ ...prev, [chatId]: message }));
    }
  }, [message, selectedUser]);

  useEffect(() => {
    if (selectedUser && privateMessages[selectedUser.id]) {
      setPrivateMessages((prev) => ({
        ...prev,
        [selectedUser.id]: prev[selectedUser.id].map((msg) => ({
          ...msg,
          read: true,
        })),
      }));
    }
  }, [selectedUser, privateMessages]);

  // Debounced typing (global + private)

  useEffect(() => {
    if (!joined || !isConnected) return;

    if (message.trim()) {
      setTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 1000);
    } else {
      setTyping(false);
    }

    // Cleanup on unmount or when message becomes empty
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, joined, isConnected, setTyping]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      connect(username.trim());
      setJoined(true);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Send message
    if (selectedUser) {
      sendPrivateMessage(selectedUser.id, message.trim());
    } else {
      sendMessage({ message: message.trim() });
    }

    // Clear input + draft
    setMessage("");
    const currentChatId = selectedUser?.id || "global";
    setDrafts((prev) => {
      const updated = { ...prev };
      delete updated[currentChatId];
      return updated;
    });
  };
  console.log("Selected user:", selectedUser);
  console.log("Private messages:", privateMessages);
  console.log(
    "Current messages in private:",
    privateMessages[selectedUser?.id]
  );

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-96">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
            Socket.io Chat
          </h1>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-5 py-4 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-purple-600 text-gray-800 text-lg"
              autoFocus
              required
            />
            <button
              type="submit"
              className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-lg text-lg transition"
            >
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-gray-900 flex overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="text-purple-400 hover:text-purple-300"
              >
                ← Global
              </button>
            )}
            <h1 className="text-2xl font-bold text-white">{chatTitle}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-green-400 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-ping"></span>
              Connected
            </span>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 rounded"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
          onScroll={() => {
            if (!scrollContainerRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } =
              scrollContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            isUserScrolling.current = distanceFromBottom > 300;
          }}
        >
          {currentMessages.map((msg) => {
            const isMine =
              msg?.sender === username ||
              msg?.senderId === users.find((u) => u.username === username)?.id;

            const isSystem = msg?.system === true;

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    isSystem
                      ? "bg-gray-700 text-gray-300"
                      : isMine
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-white"
                  }`}
                >
                  {!isMine && (
                    <div className="text-xs opacity-70 mb-1">
                      {msg?.sender || "User"}
                    </div>
                  )}
                  <div>{msg?.message}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {msg?.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {typingUsers.length > 0 && !typingUsers.includes(username) && (
            <div className="text-gray-400 italic">
              {typingUsers.join(", ")} is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        {/* Input */}
        <form
          onSubmit={handleSend}
          className="bg-gray-800 p-4 border-t border-gray-700"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMessage("");
                  const chatId = selectedUser?.id || "global";
                  setDrafts((prev) => {
                    const updated = { ...prev };
                    delete updated[chatId];
                    return updated;
                  });
                }
              }}
              placeholder={
                selectedUser
                  ? `Message ${selectedUser.username}...`
                  : "Type a message..."
              }
              className="flex-1 bg-gray-700 text-white px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              autoFocus
            />
            <button
              type="submit"
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Users Sidebar */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          Online ({users.length})
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => setSelectedUser(null)}
            className={`w-full text-left px-3 py-2 rounded-lg ${
              !selectedUser ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"
            } transition`}
          >
            🌐 Global Chat
          </button>

          {/* 🔥 FIXED PART STARTS HERE */}
          {users
            .filter((u) => u.username !== username)
            .map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);

                  // Mark all messages from this user as read WHEN opening the chat
                  if (privateMessages[user.id]) {
                    setPrivateMessages((prev) => ({
                      ...prev,
                      [user.id]: prev[user.id].map((msg) => ({
                        ...msg,
                        read: true,
                      })),
                    }));
                  }
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg transition relative ${
                  selectedUser?.id === user.id
                    ? "bg-purple-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span>{user.username}</span>
                </div>

                {/* Unread badge */}
                {privateMessages[user.id]?.some((m) => !m.read) &&
                  selectedUser?.id !== user.id && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1 min-w-6 text-center">
                      {
                        privateMessages[user.id].filter((msg) => !msg.read)
                          .length
                      }
                    </span>
                  )}
              </button>
            ))}
          {/* 🔥 FIXED PART ENDS HERE */}
        </div>
      </div>
    </div>
  );
}

export default App;
