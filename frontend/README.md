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

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 👨‍💻 Developer & Credits

Crafted with ⚡ by **Shravan Phutane**.
* **Portfolio**: [shravan-phutane-portfolio.netlify.app](https://shravan-phutane-portfolio.netlify.app/)
* **GitHub**: [@Pshravan04](https://github.com/Pshravan04)
