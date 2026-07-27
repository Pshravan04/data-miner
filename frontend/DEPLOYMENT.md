# Data Miner - Deployment Guide 🚀

This guide provides step-by-step instructions for deploying **Data Miner** to production.

---

## 🧰 Deployment Options Summary

| Platform | Best For | Playwright Support | Cost |
| :--- | :--- | :--- | :--- |
| **Railway** *(Recommended)* | Docker / One-click git deploy | Native via Dockerfile | Low / Free trial |
| **Render** | Managed Web Service | Native via Dockerfile | Free / Low tier |
| **Fly.io** | Distributed Docker Containers | Native via Dockerfile | Free / Pay-as-you-go |
| **VPS (DigitalOcean/AWS/Hetzner)** | Docker Compose self-hosting | Native via Docker Compose | $4-$10/mo fixed |
| **Vercel** | Serverless Next.js Hosting | Basic via `vercel.json` | Free / Pro |

---

## Option 1: Railway / Render (Recommended - Docker)

1. Push your project to GitHub.
2. Log in to [Railway.app](https://railway.app) or [Render.com](https://render.com).
3. Create a **New Service** -> **Deploy from GitHub repo**.
4. Select the `frontend` directory.
5. Railway / Render will automatically detect the [Dockerfile](file:///d:/MVP%20projects/data-miner/frontend/Dockerfile) and build the container with Playwright pre-installed!
6. Add Environment Variables (optional):
   - `LINKEDIN_COOKIE`: your burner `li_at` cookie
   - `APOLLO_TOKEN`: your Apollo token

---

## Option 2: Self-Hosting on VPS with Docker Compose

1. Clone your repository on your server (Ubuntu / Debian VPS):
   ```bash
   git clone <your-repo-url>
   cd data-miner/frontend
   ```
2. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Run Docker Compose:
   ```bash
   docker compose up --build -d
   ```
4. Access the web app at `http://<your-vps-ip>:3000`.

---

## Option 3: Vercel Deployment

1. Install Vercel CLI or connect your GitHub repository to Vercel.
2. Set the Root Directory to `frontend`.
3. Vercel will automatically read [vercel.json](file:///d:/MVP%20projects/data-miner/frontend/vercel.json) to set max function duration.
4. Deploy!

---

## 🧪 Production Verification

To verify your build locally before deploying:
```bash
cd frontend
npm run build
npm run start
```
Open `http://localhost:3000` to test lead extractions in production mode.
