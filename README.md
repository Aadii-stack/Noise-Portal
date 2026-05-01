# 🔊 Noise Pollution Citizen Reporting Portal

A full-stack web application for reporting noise violations in Mumbai. Citizens can submit anonymous reports with video evidence and GPS location. Authorities review, assign officers, and track case status through a secure dashboard.

## Features

- **Video Evidence** — Upload MP4/MOV/AVI files up to 100MB with drag-and-drop
- **GPS Location** — Capture incident location via browser GPS or interactive map
- **Authority Dashboard** — JWT-protected officer login with report management
- **Filters & Export** — Filter by status/type/zone/date, export as CSV or PDF
- **Bilingual** — English and Hindi language toggle
- **Public Statistics** — Anonymous aggregate data viewable by anyone

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Vanilla JS, Vite, Leaflet, jsPDF   |
| Backend   | Node.js, Express, JWT, Multer      |
| Database  | Supabase (PostgreSQL)               |
| Storage   | Supabase Storage (video files)      |

## Project Structure

```
noise-portal/
├── client/                     # Frontend (Vite)
│   ├── index.html              # App shell (minimal — pages loaded by JS)
│   └── src/
│       ├── main.js             # Entry point — imports partials, wires modules
│       ├── utils.js            # DOM helpers, API wrapper, toast, HTML escape
│       ├── i18n.js             # English / Hindi translations
│       ├── map.js              # Shared Leaflet map helpers
│       ├── report.js           # Citizen report submission logic
│       ├── dashboard.js        # Authority dashboard logic
│       ├── stats.js            # Public statistics logic
│       ├── styles.css          # CSS import barrel
│       ├── css/                # Split stylesheets
│       │   ├── base.css        # Tokens, reset, globals
│       │   ├── layout.css      # Header, nav, containers
│       │   ├── components.css  # Buttons, forms, panels, maps
│       │   ├── home.css        # Hero page
│       │   ├── dashboard.css   # Dashboard, table, modal
│       │   ├── stats.css       # Statistics cards
│       │   └── responsive.css  # Mobile breakpoints
│       └── pages/              # HTML partials
│           ├── home.html       # Hero / landing
│           ├── submit.html     # Report form
│           ├── dashboard.html  # Officer dashboard
│           ├── stats.html      # Public statistics
│           └── modal.html      # Report detail modal
├── server/                     # Backend (Express)
│   ├── server.js               # Entry point
│   ├── routes/                 # API route handlers
│   ├── services/               # Database & Supabase logic
│   ├── middleware/              # Auth middleware
│   └── .env.example            # Environment template
├── .gitignore
└── README.md
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/noise-portal.git
cd noise-portal
```

### 2. Install dependencies

```bash
# Root dependencies (concurrently)
npm install

# Client
cd client && npm install && cd ..

# Server
cd server && npm install && cd ..
```

### 3. Configure environment

```bash
# Copy example env files and fill in your values
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your:
- Supabase project URL and service role key
- JWT secret (any long random string)
- Officer login credentials

### 4. Supabase setup

1. Create a [Supabase](https://supabase.com) project
2. Create a `reports` table with the required columns
3. Create a `noise-report-videos` storage bucket
4. Copy the project URL and service role key to `server/.env`

### 5. Run locally

```bash
# Start both client and server
npm run dev
```

Or run separately:

```bash
# Terminal 1 — Server (port 5001)
cd server && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Environment Variables

### Server (`server/.env`)

| Variable                   | Description                          |
|----------------------------|--------------------------------------|
| `PORT`                     | Server port (default: 5001)          |
| `CLIENT_ORIGIN`            | CORS allowed origin                  |
| `JWT_SECRET`               | Secret key for JWT signing           |
| `OFFICER_EMAIL`            | Officer login email                  |
| `OFFICER_PASSWORD`         | Officer login password               |
| `SUPABASE_URL`             | Supabase project URL                 |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase service role key            |
| `SUPABASE_REPORTS_TABLE`   | Table name for reports               |
| `SUPABASE_VIDEOS_BUCKET`   | Storage bucket for videos            |

### Client (`client/.env`)

| Variable        | Description                                     |
|-----------------|-------------------------------------------------|
| `VITE_API_URL`  | API base URL (leave empty when using Vite proxy) |

## License

MIT
