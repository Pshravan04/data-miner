"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeGoogleMaps = scrapeGoogleMaps;
const playwright_1 = require("playwright");
const cheerio = __importStar(require("cheerio"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function extractSocialsFromWebsite(url) {
    const socials = { instagram: null, facebook: null, linkedin: null, twitter: null };
    if (!url || !url.startsWith('http') || url.includes('google.com'))
        return socials;
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        clearTimeout(id);
        if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href')?.toLowerCase() || '';
                if (href.includes('instagram.com/'))
                    socials.instagram = href;
                if (href.includes('facebook.com/'))
                    socials.facebook = href;
                if (href.includes('linkedin.com/company/') || href.includes('linkedin.com/in/'))
                    socials.linkedin = href;
                if (href.includes('twitter.com/') || href.includes('x.com/'))
                    socials.twitter = href;
            });
        }
    }
    catch (e) {
        // ignore
    }
    return socials;
}
async function scrapeGoogleMaps(niche, location, maxResults, onProgress) {
    if (onProgress)
        onProgress(`Launching headless browser...`);
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US'
    });
    const page = await context.newPage();
    const leads = [];
    const seenUrls = new Set();
    try {
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(niche + ' in ' + location)}`;
        if (onProgress)
            onProgress(`Navigating to Google Maps: ${niche} in ${location}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
        // Dismiss consent dialog if exists (EU)
        try {
            const consentButton = await page.$('form[action*="consent"] button');
            if (consentButton) {
                await consentButton.click();
                await sleep(2000);
            }
        }
        catch (e) { }
        // Wait for the feed
        try {
            await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
        }
        catch (e) {
            if (onProgress)
                onProgress(`Error: Could not find results feed. It might be a CAPTCHA or no results.`);
            await browser.close();
            return leads;
        }
        if (onProgress)
            onProgress(`Results found. Starting extraction scroll loop...`);
        let previousHeight = 0;
        let unchangedScrolls = 0;
        // Scroll to load all cards up to maxResults
        while (leads.length < maxResults && unchangedScrolls < 4) {
            const cards = await page.$$('div[role="feed"] > div > div > a');
            for (const card of cards) {
                if (leads.length >= maxResults)
                    break;
                const href = await card.getAttribute('href');
                if (!href || seenUrls.has(href))
                    continue;
                seenUrls.add(href);
                // Option B: Click the card to get full detail pane
                try {
                    await card.click();
                    await sleep(Math.floor(Math.random() * 1000) + 1500); // Random human delay
                    // Wait for detail pane title to load
                    await page.waitForSelector('h1', { timeout: 5000 });
                    const name = await page.locator('h1').innerText().catch(() => '');
                    if (!name)
                        continue;
                    // Extract basic info from the detail pane
                    let address = 'N/A';
                    let website = null;
                    let phone = null;
                    let rating = null;
                    let reviewCount = null;
                    let category = 'N/A';
                    // Look through the buttons/info rows in the detail pane
                    const infoButtons = await page.$$('button[data-item-id]');
                    for (const btn of infoButtons) {
                        const id = await btn.getAttribute('data-item-id');
                        const text = await btn.innerText();
                        if (id?.startsWith('address:'))
                            address = text;
                        if (id?.startsWith('authority:'))
                            website = await btn.getAttribute('href') || text;
                        if (id?.startsWith('phone:border:'))
                            phone = text;
                    }
                    // Extract rating/reviews
                    try {
                        const ratingText = await page.locator('div[role="main"] span[aria-label*="stars"]').first().getAttribute('aria-label');
                        if (ratingText) {
                            const rMatch = ratingText.match(/([\d\.]+)\s*stars/);
                            if (rMatch)
                                rating = parseFloat(rMatch[1]);
                            const revMatch = ratingText.match(/([\d\,]+)\s*Reviews/);
                            if (revMatch)
                                reviewCount = parseInt(revMatch[1].replace(/,/g, ''));
                        }
                    }
                    catch (e) { }
                    // Category
                    try {
                        const catEl = await page.locator('button[jsaction="pane.rating.category"]').first();
                        if (catEl)
                            category = await catEl.innerText();
                    }
                    catch (e) { }
                    // Lat/Lng from URL
                    let lat = null;
                    let lng = null;
                    const mapUrlMatch = page.url().match(/!3d([-?\d\.]+)!4d([-?\d\.]+)/);
                    if (mapUrlMatch) {
                        lat = parseFloat(mapUrlMatch[1]);
                        lng = parseFloat(mapUrlMatch[2]);
                    }
                    if (onProgress)
                        onProgress(`[${leads.length + 1}/${maxResults}] Extracted: ${name}`);
                    leads.push({
                        name,
                        category,
                        address,
                        phone,
                        website,
                        rating,
                        reviewCount,
                        latitude: lat,
                        longitude: lng,
                        googleMapsUrl: page.url(),
                        social: { instagram: null, facebook: null, linkedin: null, twitter: null }
                    });
                }
                catch (e) {
                    console.error('Error parsing a card:', e);
                }
            }
            // Scroll down
            const feed = await page.$('div[role="feed"]');
            if (feed) {
                await feed.evaluate((el) => el.scrollBy(0, 1000));
                await sleep(1500); // Wait for network requests to populate more
                const currentHeight = await feed.evaluate((el) => el.scrollHeight);
                if (currentHeight === previousHeight) {
                    unchangedScrolls++;
                }
                else {
                    unchangedScrolls = 0;
                    previousHeight = currentHeight;
                }
            }
            else {
                break;
            }
        }
    }
    catch (e) {
        if (onProgress)
            onProgress(`Fatal scraping error: ${e.message}`);
    }
    finally {
        if (onProgress)
            onProgress(`Closing browser...`);
        await browser.close();
    }
    // Enrichment step
    if (leads.length > 0) {
        if (onProgress)
            onProgress(`Starting social media enrichment from business websites...`);
        for (let i = 0; i < leads.length; i++) {
            if (leads[i].website) {
                leads[i].social = await extractSocialsFromWebsite(leads[i].website);
            }
        }
    }
    return leads;
}
