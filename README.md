# StarApp – Real-Time Secure Chat

**StarApp** is a modern, full-featured real-time chat application built with **React**, **Socket.io**, and **Node.js**. It delivers a smooth, secure, and engaging messaging experience with advanced features inspired by WhatsApp and Discord.

**Live Demo**  
🌐 **Client:** https://real-time-communication-with-socket-seven.vercel.app/  
🔌 **Server:** https://starapp-c5h0.onrender.com/

**Repository:** https://github.com/PLP-MERN-Stack-Development/real-time-communication-with-socket-io-Seunvense.git

## Features

- **Real-time Global & Private Messaging**
- **End-to-End Encryption (E2EE)** for all private messages using AES (CryptoJS) — server cannot read content
- **Typing Indicators** (global and per-private chat)
- **Read Receipts** (✓ delivered, ✓✓ read with blue ticks)
- **Unread Message Count** with red divider line and animated "new messages" button
- **Message Replies** with clickable preview
- **Message Reactions** with beautiful hover emoji picker (❤️ 👍 😂 + custom love & school categories)
- **Voice Notes** with live recording, timer, and playback
- **File & Media Sharing** (up to 50MB)
  - Images displayed inline
  - Videos and audio with native players
  - Documents with download link
- **YouTube & Video Link Embedding** – play videos directly in chat via ReactPlayer
- **Sound Notifications** with toggle (🔊 / 🔇)
- **Delete Your Own Messages** (with live removal for all users)
- **Copy Message Text** via right-click context menu
- **Drafts Preserved** when switching between chats
- **Color-Coded Usernames** for easy identification
- **Fully Responsive & Modern UI** powered by Tailwind CSS

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + ReactPlayer
- **Backend:** Node.js + Express + Socket.io
- **Real-time Communication:** Socket.io with WebSocket support
- **Encryption:** CryptoJS (AES-256)
- **Deployment:**
  - Client: Vercel
  - Server: Render

## Setup Instructions (Local Development)

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/PLP-MERN-Stack-Development/real-time-communication-with-socket-io-Seunvense.git
   cd real-time-communication-with-socket-io-Seunvense

   ```

2. Install dependencies

cd server
npm install

3. Start the server

cd client
npm install

Server runs on: http://localhost:5000

4. Start the client

cd client
npm run dev

Client runs on: http://localhost:5173

5. Open your browser to http://localhost:5173, enter a username, and start chatting!
