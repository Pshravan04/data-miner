# Data Miner (B2B Lead Scraper) - Project Overview

## 1. Project Goal
Data Miner is a full-stack Next.js web application designed to help users scrape B2B leads and business data across multiple platforms simultaneously. 

The goal of the project is to provide a single, unified dashboard where a user can enter a **Niche** (e.g., SEO Agencies, Software Development) and a **Location** (e.g., New York, NY), and automatically extract actionable business leads (Name, Location, Niche, Website, Phone Number, Ratings, and Source Platform) into a downloadable Excel `.xlsx` file.

## 2. Tech Stack
- **Frontend & Backend:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS (Dark Mode, Glassmorphism UI)
- **Data Scraping Engine:** Playwright (Headless Browser Automation)
- **Data Export:** `xlsx` (Excel file generation)

## 3. Features Implemented So Far

### Stunning UI & Dashboard
- Created a beautiful, modern, dark-themed dashboard using a purple/black glassmorphism aesthetic.
- Fully responsive design with typing suggestions/autocomplete for the Niche and Location input fields (pre-populated with massive datasets).
- Real-time logging console that displays live terminal-style updates as the invisible bots scrape the web in the background.
- "Start Extraction" and "Download Excel" workflows built out.

### Playwright Scraping Engine
The core backend architecture relies on `playwright` to spin up invisible chromium browsers that simulate human behavior to scrape data without relying on expensive official APIs.

Currently supported and wired-up platforms:
1. **Google Maps** (Fully Functional) - Searches maps and extracts exact business names (via `aria-label`), phone numbers, ratings, and websites.
2. **YellowPages** (Fully Functional) - Scrapes the standard YellowPages directory for businesses and contact info.
3. **Yelp** (Wired Up) - Scrapes Yelp search results.
4. **TripAdvisor** (Wired Up) - Scrapes TripAdvisor location listings.
5. **Zillow** (Wired Up) - specifically targets real estate agents; has built-in captcha detection to skip if blocked.
6. **LinkedIn** (Wired Up / Authenticated) - Reads a burner account's `li_at` cookie from `.env.local` to inject an authenticated session and scrape company search results without getting immediately blocked.
7. **Apollo.io** (Wired Up / Authenticated) - Reads a burner account's `remember_token` from `.env.local` to scrape the Apollo B2B database.

### Intelligent Data Merging
- When "All Platforms" is selected, the backend triggers all scrapers in parallel using `Promise.all`.
- Instead of dumping one platform's results all at once, the data is **interleaved** in a round-robin style (e.g., 1 from Google Maps, 1 from YellowPages, 1 from LinkedIn, repeat).
- Automatically formats all the merged data into a clean Excel file sent to the frontend for the user to download.

## 4. Current State & Next Steps
- The scraper architecture and UI are fundamentally complete.
- **Next step for Apollo:** Provide the Apollo `remember_token` to `.env.local` to fully unlock the Apollo integration.
- Further anti-bot evasion techniques (like proxies or stealth plugins) may be required in the future if platforms like Zillow or LinkedIn aggressively block the scraping server.
