import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useSocket } from "./socket/socket.js";
import ReactPlayer from "react-player";

// --- 0. HELPER: Colors & Emojis ---
const USER_COLORS = [
  "text-red-500",
  "text-orange-400",
  "text-amber-300",
  "text-yellow-400",
  "text-lime-400",
  "text-green-500",
  "text-emerald-400",
  "text-teal-400",
  "text-cyan-400",
  "text-sky-400",
  "text-blue-400",
  "text-indigo-400",
  "text-pink-400",
  "text-rose-400",
  "text-fuchsia-400",
  "text-stone-400",
];

const getUserColor = (username) => {
  if (!username) return "text-gray-400";
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
};

const EMOJIS = {
  common: ["❤️", "👍", "😂", "😮", "😢", "😡"],
  love: ["💋", "🥵", "🍆", "🍑", "💦", "🥺"],
  school: ["📚", "🎓", "🧠", "💯"],
};

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  // UI States
  const [replyingTo, setReplyingTo] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeMsgId, setActiveMsgId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Voice Note States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [lastReadGlobalId, setLastReadGlobalId] = useState(() => {
    return Number(localStorage.getItem("lastReadGlobalId")) || 0;
  });

  const [stickyNewMsgCount, setStickyNewMsgCount] = useState(0);

  const {
    connect,
    sendMessage,
    sendPrivateMessage,
    sendReaction,
    deleteMessage,
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
  const notificationSound = useRef(null);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Initialize Sound
  useEffect(() => {
    notificationSound.current = new Audio(
      "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"
    );
    notificationSound.current.volume = 0.5;
  }, []);

  const socketId = users.find((u) => u.username === username)?.id;

  const currentMessages = selectedUser
    ? privateMessages[selectedUser?.id] || []
    : messages.filter((msg) => !msg.isPrivate);

  const chatTitle = selectedUser
    ? `Chat with ${selectedUser.username}`
    : "Global Chat";

  // --- SCROLLING LOGIC ---
  useLayoutEffect(() => {
    if (unreadMarkerRef.current) {
      unreadMarkerRef.current.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }

    let unreadCount = 0;
    if (selectedUser) {
      unreadCount = currentMessages.filter(
        (m) => !m.read && m.senderId !== socketId
      ).length;
    } else {
      unreadCount = currentMessages.filter(
        (m) => m.id > lastReadGlobalId && m.senderId !== socketId
      ).length;
    }
    setStickyNewMsgCount(unreadCount);
  }, [selectedUser]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceToBottom < 50;

    if (isAtBottom) {
      setStickyNewMsgCount(0);
      if (selectedUser) markPrivateAsRead();
      else markGlobalAsRead();
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
    if (lastMsgId > lastReadGlobalId) {
      setLastReadGlobalId(lastMsgId);
      localStorage.setItem("lastReadGlobalId", lastMsgId);
    }
  };

  const scrollToMessage = (id) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-gray-600");
      setTimeout(() => element.classList.remove("bg-gray-600"), 1000);
    }
  };

  // --- CONTEXT MENU LOGIC ---
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, msg });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCopy = () => {
    if (contextMenu?.msg?.message) {
      navigator.clipboard.writeText(contextMenu.msg.message);
    }
    closeContextMenu();
  };

  const handleDelete = () => {
    if (contextMenu?.msg) {
      deleteMessage(contextMenu.msg.id);
    }
    closeContextMenu();
  };

  // --- CONTENT RENDERER (FIXED) ---
  const renderMessageContent = (msg, isMine) => {
    // 1. FILE HANDLING
    if (msg.file) {
      const { fileType, fileName, fileData } = msg.file;
      const showDownload = !isMine;

      // IMAGE: Show for Everyone
      if (fileType.startsWith("image/")) {
        return (
          <div className="mt-1">
            <img
              src={fileData}
              alt={fileName}
              className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90 border border-gray-600"
              onClick={() => window.open(fileData)}
            />
            {showDownload && (
              <a
                href={fileData}
                download={fileName}
                className="text-[10px] text-blue-300 hover:underline mt-1 block"
              >
                ⬇ Download
              </a>
            )}
          </div>
        );
      }

      // VIDEO: Show for Everyone (Sender sees player now too!)
      if (fileType.startsWith("video/")) {
        return (
          <div className="max-w-[300px] mt-1 overflow-hidden rounded-lg bg-black">
            <video controls width="100%" className="rounded-lg">
              <source src={fileData} type={fileType} />
              Your browser does not support the video tag.
            </video>
            {showDownload && (
              <a
                href={fileData}
                download={fileName}
                className="text-[10px] text-blue-300 hover:underline mt-1 block"
              >
                ⬇ Download Video
              </a>
            )}
          </div>
        );
      }

      // AUDIO: Show for Everyone
      if (fileType.startsWith("audio/")) {
        return (
          <div className="min-w-[200px] mt-1">
            <audio controls src={fileData} className="w-full h-8" />
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-gray-400">
                {fileName.includes("voice-note") ? "🎤 Voice Note" : "🎵 Audio"}
              </span>
              {showDownload && (
                <a
                  href={fileData}
                  download={fileName}
                  className="text-[10px] text-blue-300 hover:underline"
                >
                  ⬇ Save
                </a>
              )}
            </div>
          </div>
        );
      }

      // DOCS: Sender just sees "Sent File", Receiver sees "Download"
      return (
        <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg border border-gray-600 mt-1">
          <span className="text-2xl">📄</span>
          <div className="overflow-hidden">
            <div className="font-bold text-sm truncate max-w-[150px] text-white">
              {fileName}
            </div>
            {showDownload ? (
              <a
                href={fileData}
                download={fileName}
                className="text-xs text-blue-400 font-bold hover:underline"
              >
                Download File
              </a>
            ) : (
              <span className="text-xs text-gray-400 italic">File Sent</span>
            )}
          </div>
        </div>
      );
    }

    // 2. TEXT & LINKS (Embed Youtube)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.message.split(urlRegex);

    return (
      <div className="whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            // Check if it's a playable link
            if (ReactPlayer.canPlay(part)) {
              return (
                <div
                  key={i}
                  className="mt-2 mb-2 max-w-[300px] rounded-lg overflow-hidden relative z-10 bg-black"
                >
                  {/* ReactPlayer with NO 'light' prop so it loads immediately */}
                  <ReactPlayer url={part} controls width="100%" height="auto" />
                  <a
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:underline block mt-1 truncate px-1 pb-1"
                  >
                    {part}
                  </a>
                </div>
              );
            }
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline relative z-10"
              >
                {part}
              </a>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  // --- HANDLE INCOMING MESSAGES ---
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
      if (!selectedUser) markGlobalAsRead();
    } else {
      setStickyNewMsgCount((prev) => prev + 1);

      // SOUND FIX: Check if audio object exists before playing
      if (soundEnabled && !isMyMessage) {
        if (notificationSound.current) {
          notificationSound.current.currentTime = 0;
          notificationSound.current
            .play()
            .catch((e) => console.log("Sound error:", e));
        }
      }
    }
  }, [currentMessages.length]);

  // --- DRAFT & TYPING LOGIC ---
  useEffect(() => {
    setReplyingTo(null);
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

  // --- MEDIA HANDLERS ---
  const handleAttachClick = (type) => {
    if (fileInputRef.current) {
      if (type === "media") fileInputRef.current.accept = "image/*,video/*";
      else if (type === "audio") fileInputRef.current.accept = "audio/*";
      else if (type === "doc") fileInputRef.current.accept = "*/*";
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("File too large! Limit is 50MB.");
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const fileData = reader.result;
      const payload = {
        message: "",
        file: { fileData, fileName: file.name, fileType: file.type },
        replyTo: replyingTo,
      };
      if (selectedUser) sendPrivateMessage(selectedUser.id, payload);
      else sendMessage(payload);
      setReplyingTo(null);
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          const payload = {
            message: "",
            file: {
              fileData: base64Audio,
              fileName: `voice-note-${Date.now()}.webm`,
              fileType: "audio/webm",
            },
            replyTo: replyingTo,
          };
          if (selectedUser) sendPrivateMessage(selectedUser.id, payload);
          else sendMessage(payload);
        };
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(
        () => setRecordingTime((prev) => prev + 1),
        1000
      );
    } catch (err) {
      console.error("Mic error:", err);
      alert("Cannot access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    const payload = { message: message.trim(), replyTo: replyingTo };
    if (selectedUser) sendPrivateMessage(selectedUser.id, payload);
    else sendMessage(payload);
    setMessage("");
    setReplyingTo(null);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (!selectedUser) markGlobalAsRead();
    }, 50);
  };

  const toggleEmojiMenu = (msgId) => {
    setActiveMsgId(activeMsgId === msgId ? null : msgId);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMsgId(null);
      setContextMenu(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-96">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
            StarApp
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
      {/* --- CONTEXT MENU --- */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden w-32"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            Copy Text
          </button>

          {(contextMenu.msg.sender === username ||
            contextMenu.msg.senderId === socketId) && (
            <button
              onClick={handleDelete}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
            >
              Delete
            </button>
          )}
        </div>
      )}

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
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-gray-400 hover:text-white transition-colors p-2"
              title={soundEnabled ? "Mute Sound" : "Enable Sound"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
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

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
          onScroll={handleScroll}
        >
          {currentMessages.map((msg, index) => {
            const isMine =
              msg?.sender === username || msg?.senderId === socketId;
            const isSystem = msg?.system === true;
            const userColor = getUserColor(msg?.sender);

            let isUnread = false;
            if (selectedUser) isUnread = !msg.read && !isMine;
            else isUnread = msg.id > lastReadGlobalId && !isMine;
            const prevMsg = currentMessages[index - 1];
            let isFirstUnread = false;
            if (isUnread) {
              if (!prevMsg) isFirstUnread = true;
              else if (selectedUser)
                isFirstUnread = prevMsg.read || prevMsg.senderId === socketId;
              else
                isFirstUnread =
                  prevMsg.id <= lastReadGlobalId ||
                  prevMsg.senderId === socketId;
            }

            return (
              <div key={msg.id || index} id={`msg-${msg.id}`}>
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
                  className={`flex ${
                    isMine ? "justify-end" : "justify-start"
                  } mb-2`}
                >
                  <div
                    className="relative group max-w-xs lg:max-w-md"
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                  >
                    {/* INTERACTION BUTTONS */}
                    {!isSystem && (
                      <div
                        className={`absolute top-2 z-20 ${
                          isMine ? "-left-8" : "-right-8"
                        }`}
                      >
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => toggleEmojiMenu(msg.id)}
                            className="text-gray-400 hover:text-white bg-gray-800 p-1 rounded-full shadow-md text-xs"
                          >
                            ☺
                          </button>
                          {/* Emoji Menu */}
                          {activeMsgId === msg.id && (
                            <div
                              className={`absolute top-full mt-1 ${
                                isMine ? "left-0" : "right-0"
                              } flex flex-col gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-xl w-max z-50`}
                            >
                              <div className="flex gap-1">
                                {EMOJIS.common.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => {
                                      sendReaction(msg.id, e);
                                      setActiveMsgId(null);
                                    }}
                                    className="hover:scale-125 transition text-lg"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1 pt-1 border-t border-gray-600">
                                {EMOJIS.love.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => {
                                      sendReaction(msg.id, e);
                                      setActiveMsgId(null);
                                    }}
                                    className="hover:scale-125 transition text-lg"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1 pt-1 border-t border-gray-600">
                                {EMOJIS.school.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => {
                                      sendReaction(msg.id, e);
                                      setActiveMsgId(null);
                                    }}
                                    className="hover:scale-125 transition text-lg"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="text-gray-400 hover:text-white bg-gray-800 p-1 rounded-full shadow-md text-xs mt-1 block"
                          title="Reply"
                        >
                          ↩️
                        </button>
                      </div>
                    )}

                    {/* MESSAGE BUBBLE */}
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm border border-transparent ${
                        isSystem
                          ? "bg-gray-700 text-gray-300"
                          : isMine
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-white"
                      }`}
                    >
                      {msg.replyTo && (
                        <div
                          onClick={() => scrollToMessage(msg.replyTo.id)}
                          className={`mb-2 p-2 rounded text-xs cursor-pointer border-l-4 bg-black/20 ${
                            isMine ? "border-purple-300" : "border-gray-500"
                          }`}
                        >
                          <span
                            className={`font-bold ${getUserColor(
                              msg.replyTo.sender
                            )}`}
                          >
                            {msg.replyTo.sender}
                          </span>
                          <p className="opacity-70 truncate">
                            {msg.replyTo.message || "Attachment"}
                          </p>
                        </div>
                      )}

                      {!isMine && !isSystem && (
                        <div className={`text-xs font-bold mb-1 ${userColor}`}>
                          {msg?.sender || "User"}
                        </div>
                      )}

                      {renderMessageContent(msg, isMine)}

                      <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                        {isMine && (
                          <div className="flex items-center">
                            <span className="text-white opacity-70">✓</span>
                            {selectedUser && msg.delivered && !msg.read && (
                              <span className="text-white opacity-70 -ml-1">
                                ✓✓
                              </span>
                            )}
                            {selectedUser && msg.read && (
                              <span className="text-cyan-400 -ml-1">✓✓</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* REACTIONS DISPLAY */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div
                        className={`absolute -bottom-3 ${
                          isMine ? "right-4" : "left-4"
                        } flex gap-1 z-10`}
                      >
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <div
                            key={emoji}
                            className="bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-gray-600 shadow flex items-center gap-1"
                          >
                            <span>{emoji}</span>
                            {users.length > 1 && (
                              <span className="font-bold">{users.length}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!selectedUser && globalTypingUsers.length > 0 && (
            <div className="text-gray-400 italic text-sm ml-4 mb-2">
              {globalTypingUsers.join(", ")} is typing...
            </div>
          )}
          {selectedUser && privateTypingUsers.length > 0 && (
            <div className="text-gray-400 italic text-sm ml-4 mb-2">
              {selectedUser.username} is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

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

        {/* INPUT AREA */}
        <form
          onSubmit={handleSend}
          className="bg-gray-800 p-4 border-t border-gray-700"
        >
          {replyingTo && (
            <div className="flex justify-between items-center bg-gray-700 p-2 rounded-t-lg mb-1 border-l-4 border-purple-500">
              <div className="text-sm text-gray-300">
                Replying to{" "}
                <span
                  className={`font-bold ${getUserColor(replyingTo.sender)}`}
                >
                  {replyingTo.sender}
                </span>
                <span className="ml-2 opacity-70 truncate block max-w-xs">
                  {replyingTo.message || "Attachment"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex gap-3 items-center relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className={`p-2 rounded-full transition-colors ${
                  showAttachMenu
                    ? "bg-gray-700 text-purple-400"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Attach"
              >
                📎
              </button>
              {showAttachMenu && (
                <div className="absolute bottom-12 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl flex flex-col w-40 overflow-hidden z-50">
                  <button
                    type="button"
                    onClick={() => handleAttachClick("media")}
                    className="px-4 py-3 text-left hover:bg-gray-700 text-sm flex items-center gap-2"
                  >
                    🖼️ Photo/Video
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttachClick("audio")}
                    className="px-4 py-3 text-left hover:bg-gray-700 text-sm flex items-center gap-2"
                  >
                    🎵 Audio File
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttachClick("doc")}
                    className="px-4 py-3 text-left hover:bg-gray-700 text-sm flex items-center gap-2"
                  >
                    📄 Document
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                selectedUser
                  ? `Message ${selectedUser.username}...`
                  : "Type a message..."
              }
              className="flex-1 bg-gray-700 text-white px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              autoFocus
            />

            {message.trim() ? (
              <button
                type="submit"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
              >
                Send
              </button>
            ) : (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-400"
                }`}
                title={isRecording ? "Stop Recording" : "Record Voice Note"}
              >
                {isRecording ? `🛑 ${recordingTime}s` : "🎤"}
              </button>
            )}
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
                  <div
                    className={`w-3 h-3 rounded-full animate-pulse bg-current ${getUserColor(
                      user.username
                    )}`}
                  ></div>
                  <span
                    className={`${getUserColor(user.username)} font-medium`}
                  >
                    {user.username}
                  </span>
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
