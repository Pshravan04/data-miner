import { chromium } from 'playwright';

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

export async function scrapeGoogleMaps(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching stealth browser for Google Maps...`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    permissions: ['geolocation']
  });
  
  const page = await context.newPage();
  const results: ScrapedBusiness[] = [];

  try {
    const searchQuery = `${niche} in ${location}`;
    logCallback(`Navigating to Google Maps and searching for: ${searchQuery}`);
    
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the results feed to load
    await page.waitForTimeout(4000);

    logCallback(`Scrolling and extracting business listings...`);
    
    let previousCount = 0;
    let retries = 0;
    
    while (results.length < maxResults && retries < 5) {
      // Find all listing elements (a tags with href containing '/maps/place/')
      const listings = await page.$$('a[href*="/maps/place/"]');
      
      if (listings.length === previousCount) {
        retries++;
        // Scroll the sidebar (the feed div) down
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
          
          // Wait for the details pane to populate
          await page.waitForTimeout(2500); 
          
          logCallback(`Extracting actual details for business ${i + 1}/${maxResults}...`);
          
          // Extract Name directly from the aria-label of the link, which is 100% accurate on Google Maps
          const name = await item.getAttribute('aria-label') || 'Unknown Name';
          
          // Extract Rating
          const ratings = await page.locator('[aria-label*="stars"]').first().getAttribute('aria-label')
            .then(val => val ? val.split(' ')[0] + '/5.0' : 'N/A')
            .catch(() => 'N/A');
          
          // Extract Website
          const website = await page.locator('a[data-item-id="authority"]').getAttribute('href')
            .catch(() => 'N/A');
            
          // Extract Phone using aria-labels that indicate phone numbers or text format
          let phone = 'N/A';
          try {
              const buttons = await page.locator('button').allInnerTexts();
              const phoneRegex = /\+?[\d\s\-\(\)]{8,20}/;
              const phoneMatch = buttons.find(text => phoneRegex.test(text) && text.trim().length > 7);
              if (phoneMatch) phone = phoneMatch.trim();
          } catch (e) {}
            
          let email = 'N/A';
          // We can optionally visit the website to scrape the email here.
          // For speed in the MVP, we skip the secondary crawl unless specified.
          
          results.push({
            Name: name,
            Niche: niche,
            Location: location,
            Phone: phone,
            Email: email,
            Website: website,
            Ratings: ratings,
            Source: 'Google Maps'
          });
          
        } catch (e) {
          console.error(`Error parsing item ${i}:`, e);
        }
      }
    }
  } catch (error) {
    console.error('Scraping error:', error);
    logCallback(`Scraping error: ${error}`);
  } finally {
    await browser.close();
    logCallback(`Extraction complete. Successfully pulled ${results.length} real businesses.`);
  }

  return results;
}

export async function scrapeYellowPages(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching stealth browser for YellowPages...`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = await context.newPage();
  const results: ScrapedBusiness[] = [];

  try {
    const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(niche)}&geo_location_terms=${encodeURIComponent(location)}`;
    logCallback(`Navigating to YellowPages: ${niche} in ${location}`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const listings = await page.$$('.result');
    logCallback(`Found ${listings.length} listings on YellowPages... extracting...`);
    
    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      const item = listings[i];
      try {
        const name = await item.$eval('.business-name', el => (el as HTMLElement).innerText).catch(() => 'Unknown Name');
        const phone = await item.$eval('.phones', el => (el as HTMLElement).innerText).catch(() => 'N/A');
        const website = await item.$eval('.links a', el => (el as HTMLAnchorElement).href).catch(() => 'N/A');
        
        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone,
          Email: 'N/A', // YellowPages rarely lists email directly
          Website: website,
          Ratings: 'N/A', // Ratings on YP require complex parsing, skip for MVP
          Source: 'YellowPages'
        });
      } catch (e) {
        console.error(`Error parsing YP item ${i}:`, e);
      }
    }
  } catch (error) {
    logCallback(`YellowPages Scraping error: ${error}`);
  } finally {
    await browser.close();
    logCallback(`YellowPages extraction complete. Found ${results.length} results.`);
  }

  return results;
}

export async function scrapeYelp(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching stealth browser for Yelp...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const results: ScrapedBusiness[] = [];

  try {
    const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(niche)}&find_loc=${encodeURIComponent(location)}`;
    logCallback(`Navigating to Yelp: ${niche} in ${location}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const listings = await page.$$('div[data-testid="serp-ia-card"]');
    logCallback(`Found ${listings.length} listings on Yelp... extracting...`);
    
    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      const item = listings[i];
      try {
        const name = await item.$eval('a[name]', el => (el as HTMLElement).innerText).catch(() => 'Unknown Name');
        const phone = await item.$eval('.css-1p9ibgf', el => (el as HTMLElement).innerText).catch(() => 'N/A'); // Phone selector on Yelp varies
        const website = 'N/A'; // Yelp hides website links behind redirects
        const ratings = await item.$eval('.css-gutk1c', el => (el as HTMLElement).innerText).catch(() => 'N/A');

        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone,
          Email: 'N/A',
          Website: website,
          Ratings: ratings,
          Source: 'Yelp'
        });
      } catch (e) {}
    }
  } catch (error) {
    logCallback(`Yelp Scraping error: ${error}`);
  } finally {
    await browser.close();
    logCallback(`Yelp extraction complete. Found ${results.length} results.`);
  }
  return results;
}

export async function scrapeTripAdvisor(
  niche: string, 
  location: string, 
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Launching stealth browser for TripAdvisor...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  const page = await context.newPage();
  const results: ScrapedBusiness[] = [];

  try {
    const url = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(niche + ' ' + location)}`;
    logCallback(`Navigating to TripAdvisor: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const listings = await page.$$('.result-title');
    logCallback(`Found ${listings.length} listings on TripAdvisor... extracting...`);
    
    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      try {
        const name = await listings[i].innerText();
        results.push({
          Name: name, Niche: niche, Location: location,
          Phone: 'N/A', Email: 'N/A', Website: 'N/A', Ratings: 'N/A',
          Source: 'TripAdvisor'
        });
      } catch (e) {}
    }
  } catch (error) {
    logCallback(`TripAdvisor Scraping error: ${error}`);
  } finally {
    await browser.close();
  }
  return results;
}

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

  logCallback(`Launching stealth browser for Zillow...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  const page = await context.newPage();

  try {
    const url = `https://www.zillow.com/professionals/real-estate-agent-reviews/${encodeURIComponent(location.split(',')[0])}/`;
    logCallback(`Navigating to Zillow Agent Finder...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000); // Wait for captcha or load

    const isCaptcha = await page.$('.captcha-container');
    if (isCaptcha) {
      logCallback(`Zillow blocked the request with a Captcha. Skipping Zillow.`);
      return results;
    }

    const listings = await page.$$('.agent-list-card');
    for (let i = 0; i < Math.min(listings.length, maxResults); i++) {
      try {
        const name = await listings[i].$eval('.Text-c11n-8-100-2__sc-aiai24-0', el => (el as HTMLElement).innerText).catch(() => 'Unknown Agent');
        const phone = await listings[i].$eval('button:has-text("Call")', el => (el as HTMLElement).innerText).catch(() => 'N/A');
        
        results.push({
          Name: name, Niche: niche, Location: location,
          Phone: phone.replace('Call ', ''), Email: 'N/A', Website: 'N/A', Ratings: 'N/A',
          Source: 'Zillow'
        });
      } catch (e) {}
    }
  } catch (error) {
    logCallback(`Zillow Scraping error: ${error}`);
  } finally {
    await browser.close();
  }
  return results;
}

export async function scrapeLinkedIn(niche: string, location: string, maxResults: number, logCallback: (msg: string) => void): Promise<ScrapedBusiness[]> {
  logCallback(`LinkedIn scraper invoked... checking for auth cookies...`);
  const cookie = process.env.LINKEDIN_COOKIE;
  if (!cookie || cookie === 'your_linkedin_li_at_cookie_here') {
    logCallback(`MISSING AUTHENTICATION: To scrape LinkedIn, you MUST add LINKEDIN_COOKIE to your .env file.`);
    return [];
  }
  
  logCallback(`Launching stealth browser for LinkedIn using burner account...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  
  // Inject the cookie
  await context.addCookies([
    {
      name: 'li_at',
      value: cookie.replace(/['"]/g, ''),
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    }
  ]);
  
  const page = await context.newPage();
  const results: ScrapedBusiness[] = [];

  try {
    const url = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(niche + ' ' + location)}`;
    logCallback(`Navigating to LinkedIn Search...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000); 

    if (page.url().includes('login') || page.url().includes('authwall') || page.url().includes('signup')) {
      logCallback(`LinkedIn auth failed. The cookie might be expired or invalid. Skipping.`);
      return results;
    }

    const listings = await page.$$('.reusable-search__result-container');
    logCallback(`Found ${listings.length} companies on LinkedIn... extracting...`);
    
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
  } catch (error) {
    logCallback(`LinkedIn Scraping error: ${error}`);
  } finally {
    await browser.close();
  }
  return results;
}

export async function scrapeApollo(niche: string, location: string, maxResults: number, logCallback: (msg: string) => void): Promise<ScrapedBusiness[]> {
  logCallback(`Apollo scraper invoked... checking for auth credentials...`);
  const apolloToken = process.env.APOLLO_TOKEN;
  if (!apolloToken) {
    logCallback(`MISSING AUTHENTICATION: To scrape Apollo, you MUST add APOLLO_TOKEN to your .env file.`);
    return [];
  }
  
  // Implementation would go here using the token
  logCallback(`Apollo auth detected. (Full implementation pending burner account verification)`);
  return [];
}
