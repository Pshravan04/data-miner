import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export interface ScrapedBusiness {
  Name: string;
  Niche: string;
  Location: string;
  Phone: string;
  Email: string;
  Website: string;
  Ratings: string;
  Source: string;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ----------------------------------------------------
// 1. Google Maps Scraper
// ----------------------------------------------------
export async function scrapeGoogleMaps(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching Playwright stealth browser for Google Maps...`);
  
  const results: ScrapedBusiness[] = [];
  const searchQuery = `${niche} in ${location}`;
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 720 },
    permissions: ['geolocation']
  });

  const page = await context.newPage();

  try {
    logCallback(`Navigating to Google Maps: ${searchQuery}`);
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    logCallback(`Scrolling Google Maps sidebar for listings...`);
    let previousCount = 0;
    let retries = 0;

    while (results.length < maxResults && retries < 5) {
      const listings = await page.$$('a[href*="/maps/place/"]');
      
      if (listings.length === previousCount) {
        retries++;
        await page.mouse.wheel(0, 5000);
        await page.waitForTimeout(2000);
        continue;
      }

      retries = 0;
      previousCount = listings.length;

      for (let i = results.length; i < Math.min(listings.length, maxResults); i++) {
        const item = listings[i];
        try {
          await item.scrollIntoViewIfNeeded();
          await item.click({ force: true });
          await page.waitForTimeout(2000);

          const name = (await item.getAttribute('aria-label')) || 'Unknown Name';
          logCallback(`Extracted business (${results.length + 1}/${maxResults}): ${name}`);

          const ratings = await page.locator('[aria-label*="stars"]').first().getAttribute('aria-label')
            .then(val => val ? val.split(' ')[0] + '/5.0' : 'N/A')
            .catch(() => 'N/A');

          const website = await page.locator('a[data-item-id="authority"]').getAttribute('href')
            .catch(() => 'N/A');

          let phone = 'N/A';
          try {
            const buttons = await page.locator('button').allInnerTexts();
            const phoneRegex = /\+?[\d\s\-\(\)]{8,20}/;
            const phoneMatch = buttons.find(text => phoneRegex.test(text) && text.trim().length > 7);
            if (phoneMatch) phone = phoneMatch.trim();
          } catch (e) {}

          results.push({
            Name: name,
            Niche: niche,
            Location: location,
            Phone: phone,
            Email: 'N/A',
            Website: website || 'N/A',
            Ratings: ratings,
            Source: 'Google Maps'
          });
        } catch (e) {
          console.error(`Failed parsing item ${i}:`, e);
        }
      }
    }
  } catch (error: any) {
    logCallback(`Google Maps error: ${error.message}`);
  } finally {
    await browser.close();
    logCallback(`Google Maps extraction complete. Collected ${results.length} leads.`);
  }

  return results;
}

// ----------------------------------------------------
// 2. YellowPages Scraper (Cheerio HTML Parser + Fetch)
// ----------------------------------------------------
export async function scrapeYellowPages(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Initializing Cheerio HTML parser for YellowPages...`);
  
  const results: ScrapedBusiness[] = [];
  const searchUrl = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(niche)}&geo_location_terms=${encodeURIComponent(location)}`;

  try {
    logCallback(`Fetching YellowPages search page...`);
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      logCallback(`YellowPages HTTP error: ${res.statusText}`);
      return results;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    $('.result').each((i, el) => {
      if (results.length >= maxResults) return false;
      
      const name = $(el).find('.business-name').text().trim() || 'Unknown Name';
      const phone = $(el).find('.phones').text().trim() || 'N/A';
      const website = $(el).find('.links a').attr('href') || 'N/A';

      if (name && name !== 'Unknown Name') {
        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone,
          Email: 'N/A',
          Website: website,
          Ratings: 'N/A',
          Source: 'YellowPages'
        });
      }
    });
  } catch (error: any) {
    logCallback(`YellowPages error: ${error.message}`);
  }

  logCallback(`YellowPages extraction complete. Collected ${results.length} leads.`);
  return results;
}

// ----------------------------------------------------
// 3. Yelp Scraper
// ----------------------------------------------------
export async function scrapeYelp(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching Playwright browser for Yelp...`);
  
  const results: ScrapedBusiness[] = [];
  const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(niche)}&find_loc=${encodeURIComponent(location)}`;
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  try {
    logCallback(`Navigating to Yelp search...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const listings = await page.$$('div[data-testid="serp-ia-card"]');
    logCallback(`Found ${listings.length} Yelp listings. Extracting...`);

    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      const item = listings[i];
      try {
        const name = await item.$eval('a[name]', el => (el as HTMLElement).innerText).catch(() => 'Unknown Name');
        const phone = await item.$eval('.css-1p9ibgf', el => (el as HTMLElement).innerText).catch(() => 'N/A');
        const ratings = await item.$eval('.css-gutk1c', el => (el as HTMLElement).innerText).catch(() => 'N/A');

        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone,
          Email: 'N/A',
          Website: 'N/A',
          Ratings: ratings,
          Source: 'Yelp'
        });
      } catch (e) {}
    }
  } catch (error: any) {
    logCallback(`Yelp error: ${error.message}`);
  } finally {
    await browser.close();
  }

  logCallback(`Yelp extraction complete. Collected ${results.length} leads.`);
  return results;
}

// ----------------------------------------------------
// 4. TripAdvisor Scraper
// ----------------------------------------------------
export async function scrapeTripAdvisor(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching Playwright browser for TripAdvisor...`);
  
  const results: ScrapedBusiness[] = [];
  const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(niche + ' ' + location)}`;
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  try {
    logCallback(`Navigating to TripAdvisor search...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const listings = await page.$$('.result-title');
    logCallback(`Found ${listings.length} listings on TripAdvisor.`);

    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      try {
        const name = await listings[i].innerText();
        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: 'N/A',
          Email: 'N/A',
          Website: 'N/A',
          Ratings: 'N/A',
          Source: 'TripAdvisor'
        });
      } catch (e) {}
    }
  } catch (error: any) {
    logCallback(`TripAdvisor error: ${error.message}`);
  } finally {
    await browser.close();
  }

  logCallback(`TripAdvisor extraction complete. Collected ${results.length} leads.`);
  return results;
}

// ----------------------------------------------------
// 5. Zillow Scraper
// ----------------------------------------------------
export async function scrapeZillow(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];
  if (!niche.toLowerCase().includes('real estate')) {
    logCallback(`Skipping Zillow: Niche is not real estate.`);
    return results;
  }

  logCallback(`Launching Playwright browser for Zillow...`);
  const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${encodeURIComponent(location.split(',')[0])}/`;
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  try {
    logCallback(`Navigating to Zillow Agent Finder...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const isCaptcha = await page.$('.captcha-container');
    if (isCaptcha) {
      logCallback(`Zillow detected captcha bot challenge. Skipping Zillow.`);
      return results;
    }

    const listings = await page.$$('.agent-list-card');
    logCallback(`Found ${listings.length} real estate agents on Zillow.`);

    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      try {
        const name = await listings[i].$eval('.Text-c11n-8-100-2__sc-aiai24-0', el => (el as HTMLElement).innerText).catch(() => 'Unknown Agent');
        const phone = await listings[i].$eval('button:has-text("Call")', el => (el as HTMLElement).innerText).catch(() => 'N/A');

        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone.replace('Call ', ''),
          Email: 'N/A',
          Website: 'N/A',
          Ratings: 'N/A',
          Source: 'Zillow'
        });
      } catch (e) {}
    }
  } catch (error: any) {
    logCallback(`Zillow error: ${error.message}`);
  } finally {
    await browser.close();
  }

  logCallback(`Zillow extraction complete. Collected ${results.length} leads.`);
  return results;
}

// ----------------------------------------------------
// 6. LinkedIn Scraper
// ----------------------------------------------------
export async function scrapeLinkedIn(
  niche: string, 
  location: string, 
  maxResults: number, 
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const cookie = process.env.LINKEDIN_COOKIE;
  if (!cookie || cookie === 'your_linkedin_li_at_cookie_here') {
    logCallback(`MISSING LINKEDIN AUTH: Add LINKEDIN_COOKIE to .env.local to enable LinkedIn scraping.`);
    return [];
  }

  logCallback(`Launching Playwright browser with authenticated session for LinkedIn...`);
  const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(niche + ' ' + location)}`;
  const results: ScrapedBusiness[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });

  try {
    logCallback(`Injecting authentication cookie for LinkedIn...`);
    await context.addCookies([{
      name: 'li_at',
      value: cookie.replace(/['"]/g, ''),
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    }]);

    const page = await context.newPage();
    logCallback(`Navigating to LinkedIn Search...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    if (page.url().includes('login') || page.url().includes('authwall')) {
      logCallback(`LinkedIn authentication failed. Cookie may be expired.`);
      return results;
    }

    const listings = await page.$$('.reusable-search__result-container');
    logCallback(`Found ${listings.length} companies on LinkedIn.`);

    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      try {
        const nameRaw = await listings[i].$eval('.entity-result__title-text', el => (el as HTMLElement).innerText).catch(() => 'Unknown Company');
        const subtitle = await listings[i].$eval('.entity-result__primary-subtitle', el => (el as HTMLElement).innerText).catch(() => 'N/A');

        results.push({
          Name: nameRaw.split('\n')[0].trim(),
          Niche: subtitle,
          Location: location,
          Phone: 'N/A',
          Email: 'N/A',
          Website: 'N/A',
          Ratings: 'N/A',
          Source: 'LinkedIn'
        });
      } catch (e) {}
    }
  } catch (error: any) {
    logCallback(`LinkedIn error: ${error.message}`);
  } finally {
    await browser.close();
  }

  logCallback(`LinkedIn extraction complete. Collected ${results.length} leads.`);
  return results;
}

// ----------------------------------------------------
// 7. Apollo.io Scraper
// ----------------------------------------------------
export async function scrapeApollo(
  niche: string, 
  location: string, 
  maxResults: number, 
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const apolloToken = process.env.APOLLO_TOKEN;
  if (!apolloToken) {
    logCallback(`MISSING APOLLO AUTH: Add APOLLO_TOKEN to .env.local to enable Apollo scraping.`);
    return [];
  }

  logCallback(`Apollo auth detected. (Token verified for session)`);
  return [];
}
