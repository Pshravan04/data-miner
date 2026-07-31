process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
import { chromium, Page } from 'playwright';
import * as cheerio from 'cheerio';

export interface ScrapedBusiness {
  name: string;
  category: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  social: {
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    twitter: string | null;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function extractSocialsFromWebsite(url: string | null): Promise<any> {
  const socials = { instagram: null, facebook: null, linkedin: null, twitter: null };
  if (!url || !url.startsWith('http') || url.includes('google.com')) return socials;

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
        if (href.includes('instagram.com/')) (socials as any).instagram = href;
        if (href.includes('facebook.com/')) (socials as any).facebook = href;
        if (href.includes('linkedin.com/company/') || href.includes('linkedin.com/in/')) (socials as any).linkedin = href;
        if (href.includes('twitter.com/') || href.includes('x.com/')) (socials as any).twitter = href;
      });
    }
  } catch (e) {
    // ignore
  }
  return socials;
}

export async function scrapeGoogleMaps(niche: string, location: string, maxResults: number, onProgress?: (msg: string) => void): Promise<ScrapedBusiness[]> {
  if (onProgress) onProgress(`Launching headless browser...`);
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage', // Prevent shared memory exhaustion in Docker
      '--no-sandbox', // Required for some environments
      '--disable-setuid-sandbox',
      '--disable-gpu', // Disable GPU hardware acceleration
      '--no-zygote',
      '--single-process', // Run in a single process to save RAM
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US'
  });

  const page = await context.newPage();
  
  // Aggressively block images, fonts, and media to save RAM on free tier
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const leads: ScrapedBusiness[] = [];
  const seenUrls = new Set<string>();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(niche + ' in ' + location)}`;
    if (onProgress) onProgress(`Navigating to Google Maps: ${niche} in ${location}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Dismiss consent dialog if exists (EU)
    try {
      const consentButton = await page.$('form[action*="consent"] button');
      if (consentButton) {
        await consentButton.click();
        await sleep(2000);
      }
    } catch (e) {}

    // Wait for the feed
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch (e) {
      if (onProgress) onProgress(`Error: Could not find results feed. It might be a CAPTCHA or no results.`);
      await browser.close();
      return leads;
    }

    if (onProgress) onProgress(`Results found. Starting human-like extraction loop...`);

    let previousHeight = 0;
    let unchangedScrolls = 0;
    const seenNames = new Set<string>();

    while (leads.length < maxResults && unchangedScrolls < 4) {
      // Get all currently visible cards in the feed
      const cards = await page.$$('div[role="feed"] > div > div > a');
      
      let processedInThisBatch = 0;

      for (const card of cards) {
        if (leads.length >= maxResults) break;
        
        try {
          const ariaLabel = await card.getAttribute('aria-label');
          if (!ariaLabel || seenNames.has(ariaLabel)) continue;

          // Click the card in the sidebar to open the detail pane
          await card.scrollIntoViewIfNeeded();
          await card.click();
          await sleep(2000); // Wait for the slide-in animation and data load

          // The h1 in the detail pane should match the business name
          const name = await page.locator('h1').innerText().catch(() => ariaLabel);
          
          if (!name || seenNames.has(name)) continue;
          seenNames.add(name);
          processedInThisBatch++;

          let address = 'N/A';
          let website = null;
          let phone = null;
          let rating: number | null = null;
          let reviewCount: number | null = null;
          let category = 'N/A';

          // Extract data from the detail pane
          const infoButtons = await page.$$('button[data-item-id]');
          for (const btn of infoButtons) {
            const id = await btn.getAttribute('data-item-id');
            const text = await btn.innerText();
            if (id?.startsWith('address:')) address = text;
            if (id?.startsWith('authority:')) website = await btn.getAttribute('href') || text;
            if (id?.startsWith('phone:border:')) phone = text;
          }

          try {
            const ratingText = await page.locator('div[role="main"] span[aria-label*="stars"]').first().getAttribute('aria-label');
            if (ratingText) {
              const rMatch = ratingText.match(/([\d\.]+)\s*stars/);
              if (rMatch) rating = parseFloat(rMatch[1]);
              const revMatch = ratingText.match(/([\d\,]+)\s*Reviews/);
              if (revMatch) reviewCount = parseInt(revMatch[1].replace(/,/g, ''));
            }
          } catch (e) {}
          
          try {
            const catEl = await page.locator('button[jsaction="pane.rating.category"]').first();
            if (catEl) category = await catEl.innerText();
          } catch (e) {}

          let lat = null;
          let lng = null;
          const mapUrlMatch = page.url().match(/!3d([-?\d\.]+)!4d([-?\d\.]+)/);
          if (mapUrlMatch) {
            lat = parseFloat(mapUrlMatch[1]);
            lng = parseFloat(mapUrlMatch[2]);
          }

          if (onProgress) onProgress(`[${leads.length + 1}/${maxResults}] Extracted: ${name}`);

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

        } catch (e) {
          console.error('Error parsing a card detail:', e);
        }
      }

      // Scroll the feed to load more cards
      const feed = page.locator('div[role="feed"]');
      if (await feed.count() > 0) {
        await feed.evaluate((el: any) => el.scrollTo(0, el.scrollHeight));
        await sleep(2500); 
        
        const currentHeight = await feed.evaluate((el: any) => el.scrollHeight);
        
        // If we didn't process any new cards and height didn't change, we might be at the end
        if (currentHeight === previousHeight && processedInThisBatch === 0) {
          unchangedScrolls++;
          if (unchangedScrolls >= 6) break; // End of list
        } else {
          unchangedScrolls = 0;
          previousHeight = currentHeight;
        }
      } else {
        break;
      }
    }

    if (onProgress) onProgress(`Extraction complete. Found ${leads.length} leads.`);
    await browser.close();
  } catch (e: any) {
    if (onProgress) onProgress(`Fatal scraping error: ${e.message}`);
    await browser.close();
  }

  // Enrichment step
  if (leads.length > 0) {
    if (onProgress) onProgress(`Starting social media enrichment from business websites...`);
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].website) {
        leads[i].social = await extractSocialsFromWebsite(leads[i].website);
      }
    }
  }

  return leads;
}
