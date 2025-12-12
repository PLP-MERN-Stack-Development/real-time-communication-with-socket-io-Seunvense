import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useSocket } from "./socket/socket.js";

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  // NEW: Track the ID of the last global message read from LocalStorage
  const [lastReadGlobalId, setLastReadGlobalId] = useState(() => {
    return Number(localStorage.getItem("lastReadGlobalId")) || 0;
  });

  const [stickyNewMsgCount, setStickyNewMsgCount] = useState(0);

  const {
    connect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    isConnected,
    messages = [],
    users = [],
    globalTypingUsers = [],
    privateTypingUsers = [],
    privateMessages,
    setPrivateMessages,
  } = useSocket(selectedUser);

  const messagesEndRef = useRef(null);
  const unreadMarkerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helper to get my ID safely
  const socketId = users.find((u) => u.username === username)?.id;

  // 1. Define currentMessages
  const currentMessages = selectedUser
    ? privateMessages[selectedUser?.id] || []
    : messages.filter((msg) => !msg.isPrivate);

  const chatTitle = selectedUser
    ? `Chat with ${selectedUser.username}`
    : "Global Chat";

  // 2. SMART SCROLLING LOGIC
  useLayoutEffect(() => {
    // If unread marker exists, scroll there (center). Else scroll to bottom.
    if (unreadMarkerRef.current) {
      unreadMarkerRef.current.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }

    // Calculate unread count on open
    let unreadCount = 0;
    if (selectedUser) {
      unreadCount = currentMessages.filter(
        (m) => !m.read && m.senderId !== socketId
      ).length;
    } else {
      // Global logic: Count messages with ID > lastReadGlobalId
      unreadCount = currentMessages.filter(
        (m) => m.id > lastReadGlobalId && m.senderId !== socketId
      ).length;
    }
    setStickyNewMsgCount(unreadCount);
  }, [selectedUser]); // Run when chat changes

  // 3. HANDLE SCROLL & READ STATUS
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    // Check if near bottom
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceToBottom < 50;

    if (isAtBottom) {
      setStickyNewMsgCount(0);

      if (selectedUser) {
        markPrivateAsRead();
      } else {
        markGlobalAsRead();
      }
    }
  };

  const markPrivateAsRead = () => {
    if (selectedUser && privateMessages[selectedUser.id]) {
      const hasUnread = privateMessages[selectedUser.id].some((m) => !m.read);
      if (!hasUnread) return;

      setPrivateMessages((prev) => ({
        ...prev,
        [selectedUser.id]: prev[selectedUser.id].map((msg) => ({
          ...msg,
          read: true,
        })),
      }));
    }
  };

  const markGlobalAsRead = () => {
    if (currentMessages.length === 0) return;
    const lastMsgId = currentMessages[currentMessages.length - 1].id;

    // Only update if we have actually advanced
    if (lastMsgId > lastReadGlobalId) {
      setLastReadGlobalId(lastMsgId);
      localStorage.setItem("lastReadGlobalId", lastMsgId);
    }
  };

  // 4. HANDLE INCOMING MESSAGES (Update Sticky Count)
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const lastMsg = currentMessages[currentMessages.length - 1];
    if (!lastMsg) return;

    const isMyMessage = lastMsg.senderId === socketId;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;

    if (isMyMessage || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // If we are at bottom, mark as read immediately
      if (!selectedUser) markGlobalAsRead();
    } else {
      // If we are scrolled up, increase count
      setStickyNewMsgCount((prev) => prev + 1);
    }
  }, [currentMessages.length]);

  // --- DRAFT & TYPING LOGIC (Standard) ---
  useEffect(() => {
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
    const newChatId = selectedUser?.id || "global";
    const saved = drafts[newChatId];
    setMessage(saved !== undefined ? saved : "");
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser && selectedUser !== null) return;
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
    if (!joined || !isConnected) return;
    if (message.trim()) {
      setTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 1000);
    } else {
      setTyping(false);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    if (selectedUser) {
      sendPrivateMessage(selectedUser.id, message.trim());
    } else {
      sendMessage({ message: message.trim() });
    }
    setMessage("");
    // Manually scroll to bottom on send and update global read
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (!selectedUser) markGlobalAsRead();
    }, 50);
  };

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
              <span className="w-3 h-3 bg-green-400 rounded-full animate-ping"></span>{" "}
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

        {/* Messages Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
          onScroll={handleScroll}
        >
          {currentMessages.map((msg, index) => {
            const isMine =
              msg?.sender === username || msg?.senderId === socketId;
            const isSystem = msg?.system === true;

            // --- DETERMINING UNREAD STATUS ---
            let isUnread = false;
            if (selectedUser) {
              // Private: Rely on server 'read' flag
              isUnread = !msg.read && !isMine;
            } else {
              // Global: Compare ID with local storage
              isUnread = msg.id > lastReadGlobalId && !isMine;
            }

            // Determine if this is the FIRST unread message to draw the line
            const prevMsg = currentMessages[index - 1];

            let isFirstUnread = false;
            if (isUnread) {
              if (!prevMsg) {
                isFirstUnread = true; // First message ever and it's unread
              } else if (selectedUser) {
                // Private: prev was read or mine
                isFirstUnread = prevMsg.read || prevMsg.senderId === socketId;
              } else {
                // Global: prev ID was <= lastReadGlobalId or mine
                isFirstUnread =
                  prevMsg.id <= lastReadGlobalId ||
                  prevMsg.senderId === socketId;
              }
            }

            return (
              <div key={msg.id || index}>
                {/* THE UNREAD DIVIDER */}
                {isFirstUnread && (
                  <div ref={unreadMarkerRef} className="flex items-center my-6">
                    <div className="flex-grow h-px bg-red-500/50"></div>
                    <span className="mx-4 text-xs font-bold text-red-400 uppercase tracking-wider">
                      Unread Messages
                    </span>
                    <div className="flex-grow h-px bg-red-500/50"></div>
                  </div>
                )}

                <div
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
                    <div className="text-xs opacity-70 mt-1 flex items-center gap-1 justify-end">
                      {msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                      {isMine && (
                        <div className="flex items-center">
                          <span className="text-white opacity-70">✓</span>
                          {/* Global doesn't support delivered/read ticks from server properly yet, so we hide specific ticks for global unless you add backend logic */}
                          {selectedUser && msg.delivered && !msg.read && (
                            <span className="text-white opacity-70 -ml-2">
                              ✓✓
                            </span>
                          )}
                          {selectedUser && msg.read && (
                            <span className="text-cyan-400 -ml-2">✓✓</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!selectedUser && globalTypingUsers.length > 0 && (
            <div className="text-gray-400 italic text-sm">
              {globalTypingUsers.join(", ")} is typing...
            </div>
          )}
          {selectedUser && privateTypingUsers.length > 0 && (
            <div className="text-gray-400 italic text-sm">
              {selectedUser.username} is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic New Message Indicator */}
        {stickyNewMsgCount > 0 && (
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setStickyNewMsgCount(0);
              if (selectedUser) markPrivateAsRead();
              else markGlobalAsRead();
            }}
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-700 transition animate-bounce z-10"
          >
            {stickyNewMsgCount} new message{stickyNewMsgCount > 1 ? "s" : ""} ↓
          </button>
        )}

        {/* Input Form */}
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
                if (e.key === "Escape") setMessage("");
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

      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          Online ({users.length})
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => setSelectedUser(null)}
            className={`w-full text-left px-3 py-2 rounded-lg relative flex justify-between items-center ${
              !selectedUser ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"
            } transition`}
          >
            <span>🌐 Global Chat</span>
            {/* Global Unread Badge in Sidebar */}
            {messages.filter(
              (m) => m.id > lastReadGlobalId && m.senderId !== socketId
            ).length > 0 &&
              selectedUser && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1 min-w-6 text-center">
                  {
                    messages.filter(
                      (m) => m.id > lastReadGlobalId && m.senderId !== socketId
                    ).length
                  }
                </span>
              )}
          </button>
          {users
            .filter((u) => u.username !== username)
            .map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
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
        </div>
      </div>
    </div>
  );
}

export default App;
