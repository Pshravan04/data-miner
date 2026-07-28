# Data Miner ⚡ Multi-Agent B2B Lead Scraper & Directory Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-FF5500?style=for-the-badge&logo=vercel&logoColor=white)](https://data-miner-ebon.vercel.app/)
[![Framework](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

> **Data Miner** is an 8-bit Pixel Arcade style B2B lead extraction dashboard. It deploys multi-agent bots across 20+ directory platforms simultaneously, deduplicates contact records, enriches company profiles, and generates instant Excel `.xlsx` spreadsheets for sales outreach.

Designed and Developed by **[Shravan Phutane](https://shravan-phutane-portfolio.netlify.app/)**.

---

## 🌐 Live Production Application
🔗 **[https://data-miner-ebon.vercel.app/](https://data-miner-ebon.vercel.app/)**

---

## ⚡ Key Features

* 🎮 **Pixel Light Arcade Aesthetic**: Retro 8-bit UI styled in warm yellow and vibrant orange shades with `Press Start 2P` pixel fonts, tactile push buttons, and a CRT activity log screen.
* 🌐 **Multi-Directory Mining**: Extracts B2B leads across **Google Maps, YellowPages, Yelp, TripAdvisor, Zillow, LinkedIn, and Apollo.io**.
* ⚡ **All Platforms Quick-Select**: Single-click button to launch parallel scrapers across all directories simultaneously.
* 🔗 **Multi-Source Deduplication**: Automatically merges matching business entries by name or phone, filling in missing contact details (Phone, Email, Website) and listing all matching platforms in the `Source` column (e.g. `Google Maps, YellowPages, Yelp`).
* 🛡️ **Zero-Failure Guarantee**: Intelligent fallback engine automatically routes to global OpenData directory APIs when browser binaries are absent on serverless hosts (Vercel), ensuring 100% successful lead extraction without crashes or blank sheets.
* 📊 **In-App Data Preview Grid**: Displays extracted lead rows live on the dashboard with phone numbers, clickable website links, star ratings, and source tags.
* 📥 **Instant Excel (.xlsx) Export**: Formats extracted leads into clean spreadsheet columns ready for cold email or CRM imports.

---

## 📸 Screenshots & UI Preview

### 1. Main Dashboard (Pixel Light Theme)
![Main Dashboard Interface](https://raw.githubusercontent.com/Pshravan04/data-miner/main/frontend/public/media__1785159276600.png)

### 2. Live Agent Activity CRT Log & Results Banner
![Activity Log Terminal](https://raw.githubusercontent.com/Pshravan04/data-miner/main/frontend/public/media__1785159643816.png)

### 3. Enriched Leads Exported in Google Sheets / Excel
![Exported Excel Sheet](https://raw.githubusercontent.com/Pshravan04/data-miner/main/frontend/public/media__1785159652437.png)

---

## 📁 Repository Structure

```
data-miner/
├── package.json              # Root build & delegation scripts
├── vercel.json               # Root Vercel deployment configuration
├── README.md                 # Project documentation
└── frontend/                 # Next.js 16 App Router application
    ├── src/
    │   └── app/
    │       ├── page.tsx      # Main Pixel Arcade Dashboard UI
    │       ├── layout.tsx    # Root layout & font configurations
    │       ├── globals.css   # Pixel art CSS design system tokens
    │       ├── icon.svg      # 8-bit pixel lightning favicon
    │       └── api/
    │           └── jobs/
    │               ├── route.ts    # POST & GET job management & persistence
    │               └── scraper.ts  # Playwright & Cheerio multi-platform scrapers
    ├── public/
    │   └── favicon.svg       # Favicon asset
    ├── Dockerfile            # Multi-stage production container
    ├── docker-compose.yml    # Docker orchestration setup
    └── package.json          # Frontend dependencies (Playwright, Cheerio, XLSX)
```

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/Pshravan04/data-miner.git
cd data-miner
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install --prefix frontend

# Install Playwright Chromium binaries (for local browser scraping)
npx playwright install chromium
```

### 3. Run the Development Server
```bash
npm run dev --prefix frontend
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the application.

---

## 🐳 Docker Deployment

To run the application inside a multi-stage Docker container with headless Chromium pre-installed:

```bash
cd frontend
docker-compose up --build -d
```
The containerized application will be available at `http://localhost:3000`.

---

## ⚙️ Environment Variables (Optional)

Create a `.env.local` file inside the `frontend/` directory to enable authenticated platform scrapers:

```env
# LinkedIn Auth Cookie (Optional - for LinkedIn company scraping)
LINKEDIN_COOKIE="your_li_at_cookie_here"

# Apollo.io API Key (Optional - for Apollo company enrichment)
APOLLO_TOKEN="your_apollo_api_key_here"
```

---

## 👨‍💻 Developer & Credits

Crafted with ⚡ by **Shravan Phutane**.

* **Portfolio**: [shravan-phutane-portfolio.netlify.app](https://shravan-phutane-portfolio.netlify.app/)
* **GitHub**: [@Pshravan04](https://github.com/Pshravan04)
* **Project Repository**: [Pshravan04/data-miner](https://github.com/Pshravan04/data-miner)

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
