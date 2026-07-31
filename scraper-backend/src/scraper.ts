process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
import { chromium, Page } from 'playwright';
import * as cheerio from 'cheerio';

export interface ScrapedBusiness {
  name: string;
  category: string | null;
  address: string | null;
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
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
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
  
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const leads: ScrapedBusiness[] = [];

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(niche + ' in ' + location)}`;
    if (onProgress) onProgress(`Navigating to Google Maps: ${niche} in ${location}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    try {
      const consentButton = await page.$('form[action*="consent"] button');
      if (consentButton) {
        await consentButton.click();
        await sleep(2000);
      }
    } catch (e) {}

    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch (e) {
      if (onProgress) onProgress(`Error: Could not find results feed. It might be a CAPTCHA or no results.`);
      await browser.close();
      return leads;
    }

    if (onProgress) onProgress(`Results found. Starting inline extraction loop...`);

    let previousHeight = 0;
    let unchangedScrolls = 0;
    const seenUrls = new Set<string>();

    while (leads.length < maxResults && unchangedScrolls < 4) {
      const cardsHtml = await page.$$eval('div.Nv2PK', els => els.map(e => e.outerHTML));
      
      for (const html of cardsHtml) {
        if (leads.length >= maxResults) break;
        
        const $ = cheerio.load(html);
        const a = $('a').first();
        const href = a.attr('href');
        
        if (href && !seenUrls.has(href)) {
          seenUrls.add(href);
          
          const lines = $('div.W4Efsd').map((_, div) => $(div).text()).get();
          const website = $('a').filter((_, aEl) => {
            const h = $(aEl).attr('href');
            return !!h && h.startsWith('http') && !h.includes('google.com');
          }).attr('href') || null;
          
          const name = $('div.qBF1Pd, div.fontHeadlineSmall').text();
          
          let address = null;
          let category = null;
          if (lines.length > 2) {
            const parts = lines[2].split('·').map(s => s.trim());
            category = parts[0] || null;
            address = parts.slice(1).filter(s => s.length > 1).join(', ') || null;
          }
          
          const phoneMatch = lines.join(' ').match(/(?:\+?91[-.\s]?)?0?\d{3,5}[-.\s]?\d{5,8}/);
          const phone = phoneMatch ? phoneMatch[0].trim() : null;
          
          let rating: number | null = null;
          let reviewCount: number | null = null;
          const ratingAria = $('span[aria-label*="stars"]').attr('aria-label');
          if (ratingAria) {
             const rMatch = ratingAria.match(/([\d\.]+)\s*stars/);
             if (rMatch) rating = parseFloat(rMatch[1]);
             const revMatch = ratingAria.match(/([\d\,]+)\s*Reviews/);
             if (revMatch) reviewCount = parseInt(revMatch[1].replace(/,/g, ''));
          }

          let lat = null, lng = null;
          const mapUrlMatch = href.match(/!3d([-?\d\.]+)!4d([-?\d\.]+)/);
          if (mapUrlMatch) {
            lat = parseFloat(mapUrlMatch[1]);
            lng = parseFloat(mapUrlMatch[2]);
          }

          leads.push({
            name: name || 'Unknown',
            category,
            address,
            phone,
            website,
            rating,
            reviewCount,
            latitude: lat,
            longitude: lng,
            googleMapsUrl: href,
            social: { instagram: null, facebook: null, linkedin: null, twitter: null }
          });

          if (onProgress) onProgress(`[${leads.length}/${maxResults}] Extracted: ${name}`);
        }
      }

      if (leads.length >= maxResults) break;

      const feed = page.locator('div[role="feed"]');
      if (await feed.count() > 0) {
        await feed.evaluate((el: any) => el.scrollTo(0, el.scrollHeight));
        await sleep(2000); 
        
        const currentHeight = await feed.evaluate((el: any) => el.scrollHeight);
        if (currentHeight === previousHeight) {
          unchangedScrolls++;
          if (unchangedScrolls >= 8) break;
        } else {
          unchangedScrolls = 0;
          previousHeight = currentHeight;
        }
      } else {
        break;
      }
    }

    if (onProgress) onProgress(`Extraction complete. Found ${leads.length} leads.`);
  } catch (e: any) {
    if (onProgress) onProgress(`Fatal scraping error: ${e.message}`);
  } finally {
    if (onProgress) onProgress(`Closing browser...`);
    await browser.close();
  }

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
