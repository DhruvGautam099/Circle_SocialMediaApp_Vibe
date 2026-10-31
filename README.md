# ⭕ Circle — A Mini Social Media Web App

Circle is a minimalist, lightweight social media web application built with vanilla web technologies, Node.js, Express, and SQLite. It offers a calm, friendly space to share thoughts, like and comment on posts, and follow friends.

---

## 🚀 Features

- **Authentication**: Secure registration, login, and session persistence using JWT (stored in `localStorage`) and bcrypt password hashing.
- **User Profiles**: Initial-letter pastel circle avatars (generated deterministically from usernames), editable display names & bios, join dates, follower / following / post counters, and a stream of the user's posts.
- **Posts & Live Counter**: Create text posts (up to 280 characters with live character countdown and warning colors), delete own posts, and view a global feed.
- **Likes & Animations**: Toggle like/unlike with real-time counters, active heart styling, and a subtle heart pop animation.
- **Inline Comments**: Expandable comments drawer beneath each post for reading and posting replies without leaving the feed; authors can delete their own comments.
- **Follow System & Dual Feed**: Follow/unfollow users directly from their profiles. Switch seamlessly between:
  - **For You**: Global stream of all posts.
  - **Following**: Filtered feed showing only posts from creators you follow.
- **Safe Rendering**: All user content is escaped using DOM `textContent` to strictly protect against XSS vulnerabilities.
- **Zero-Setup Database**: Uses `better-sqlite3` with foreign key cascades and pre-seeded demo accounts.
- **Aesthetic**: Warm pastel palette, soft rounded corners, smooth micro-interactions, and toast alerts instead of native browser popups.

---

## 🛠️ Tech Stack

- **Frontend**: Plain HTML5, Vanilla CSS3 (Custom design system with CSS variables), and Vanilla JavaScript (ES6+). Zero frameworks, zero bundlers.
- **Backend**: Node.js & Express.js.
- **Database**: SQLite via `better-sqlite3` (single-file `circle.db`).
- **Auth**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`.

---

## 🏁 Quick Start

### 1. Installation

Clone or open the repository folder and install dependencies:

```bash
cd CodeAlpha_Social_Media_App
npm install
```

### 2. Start the Application

```bash
npm start
```

The server starts at **[http://localhost:3000](http://localhost:3000)**. Open your browser and navigate to the URL.

---

## 👥 Demo Accounts

The database is pre-seeded with 3 demo accounts (password for all accounts is `password123`):

| Username | Display Name | Role / Bio |
| :--- | :--- | :--- |
| `alice` | Alice Walker | UI designer & coffee enthusiast ☕🎨 |
| `bob` | Bob Vance | Building open source tools 🚀💻 |
| `charlie` | Charlie Rose | Music lover & weekend baker 🌿🍞 |

*Tip: On the login page, you can click any of the demo account badges to auto-fill the login form instantly!*

---

## 📁 Project Structure

```text
CodeAlpha_Social_Media_App/
├── server.js              # Express app entrypoint & static server
├── db.js                  # SQLite database connection, tables schema & seed data
├── circle.db              # SQLite single-file database (created automatically)
├── package.json           # Dependencies and scripts ("npm start")
├── middleware/
│   └── auth.js            # JWT verification (requireAuth & optionalAuth)
├── routes/
│   ├── auth.js            # Register, Login, Session me
│   ├── users.js           # Profile view, Update bio/display name, Follow toggle
│   ├── posts.js           # Posts stream (all / following / username), Create, Delete, Like toggle
│   └── comments.js        # Post comments list, Add comment, Delete comment
└── public/                # Static frontend assets
    ├── index.html         # Main feed (For You & Following tabs, post composer)
    ├── login.html         # Login & Sign up page with demo auto-fill
    ├── profile.html       # User profile page & Edit bio modal
    ├── css/
    │   └── style.css      # Custom pastel design system & responsive styling
    └── js/
        ├── api.js         # Fetch wrapper, JWT tokens, avatar helper, toasts
        ├── auth.js        # Login & registration logic
        ├── feed.js        # Feed composer, post stream, likes, inline comments
        └── profile.js     # User profile, edit profile, follow toggle, user posts
```

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Create a new user account (`{ username, password, display_name }`)
- `POST /api/auth/login` — Log in and receive JWT token (`{ username, password }`)
- `GET /api/auth/me` — Verify session and fetch current logged-in user

### Users & Profiles
- `GET /api/users/:username` — Fetch user profile info, post/follower/following counts, and follow state
- `PUT /api/users/me` — Update display name and bio (Protected)
- `POST /api/users/:username/follow` — Toggle follow/unfollow for user (Protected)

### Posts
- `GET /api/posts?feed=all|following` — Get posts for "For You" or "Following" feed
- `GET /api/posts?username=:username` — Get posts by a specific user
- `POST /api/posts` — Create a new post (max 280 chars) (Protected)
- `DELETE /api/posts/:id` — Delete own post (Protected)
- `POST /api/posts/:id/like` — Toggle like/unlike on a post (Protected)

### Comments
- `GET /api/posts/:id/comments` — Get all comments for a post in chronological order
- `POST /api/posts/:id/comments` — Add a comment to a post (max 280 chars) (Protected)
- `DELETE /api/comments/:id` — Delete own comment (Protected)

---

## 🔒 Security & Code Quality

- **Prepared Statements**: Parameterized SQL queries via `better-sqlite3` to prevent SQL injection.
- **XSS Prevention**: User content is inserted into the DOM strictly via `element.textContent`.
- **Foreign Keys with Cascade**: `PRAGMA foreign_keys = ON;` ensures when a post or user is removed, associated likes and comments are cleaned up automatically.
- **Self-Follow Prevention**: Foreign keys and database `CHECK` constraints prevent users from following themselves.
