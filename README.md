# Socket.io Real-Time Chat Application

A full-featured, secure, real-time chat application built with **React**, **Socket.io**, and **Node.js**. Supports global and private messaging with modern features like end-to-end encryption, reactions, voice notes, file sharing, and more.

**Live Demo:** _(Add after deployment)_  
Client: https://your-app.vercel.app  
Server: https://your-app.onrender.com

## Features

- **Real-time Global & Private Chat**
- **End-to-End Encryption** for private messages (AES via CryptoJS)
- **Typing Indicators** (per chat)
- **Read Receipts** (✓ delivered, ✓✓ read, blue ticks)
- **Unread Message Count** with divider line and "new messages" button
- **Message Replies** with preview
- **Message Reactions** (❤️ 👍 😂 + custom categories)
- **Voice Notes** with live recording
- **File Sharing** (Images, Videos, Audio, Documents up to 50MB)
  - Inline image preview
  - Video/audio playback
  - Download links
- **YouTube & Video Link Embedding** (play directly in chat)
- **Sound Notifications** with mute toggle
- **Delete Messages** (your own)
- **Copy Message Text**
- **Drafts** preserved when switching chats
- **Color-coded Usernames**
- **Responsive & Modern UI** with Tailwind CSS

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + ReactPlayer
- **Backend:** Node.js + Express + Socket.io
- **Encryption:** CryptoJS (AES)
- **Deployment:** Vercel (client) + Render (server)

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Local Development

1. Clone the repository

   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```

2. Install dependencies

# Server

cd server
npm install

# Client (in another terminal)

cd client
npm install

3. Start the server

cd server
npm start

# Runs on http://localhost:5000

4. Start the client

cd client
npm run dev

# Runs on http://localhost:5173

5. Open browser and join with any username
