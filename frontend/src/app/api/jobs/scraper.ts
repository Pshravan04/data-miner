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
  Address?: string;
  Socials?: string;
}

// ──────────────────────────────────────────────
// Anti-Bot: Rotating User Agents
// ──────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/126.0.0.0 Safari/537.36'
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getAntiBotHeaders(acceptType: 'html' | 'json' = 'html') {
  return {
    'User-Agent': getRandomUA(),
    'Accept': acceptType === 'html' ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' : 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
}

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function extractPhone(text: string): string {
  if (!text) return 'N/A';
  const mobileRe = /(?:\+?91[\s.\-]?)?(?:0)?([6-9]\d{4}[\s.\-]?\d{5}|[6-9]\d{9})/g;
  const m = text.match(mobileRe);
  if (m) {
    for (const match of m) {
      const digits = match.replace(/\D/g, '');
      const ten = digits.length > 10 ? digits.slice(-10) : digits;
      if (ten.length === 10 && /^[6-9]/.test(ten)) {
        return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
      }
    }
  }
  return 'N/A';
}

function extractEmail(text: string): string {
  if (!text) return 'N/A';
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (m) {
    const e = m[0].toLowerCase();
    if (!e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg') && !e.includes('example.com') && !e.includes('sentry')) return e;
  }
  return 'N/A';
}

function cleanTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/•\s*Instagram.*$/i, '')
    .replace(/\|\s*Facebook.*$/i, '')
    .replace(/-\s*LinkedIn.*$/i, '')
    .replace(/-\s*Justdial.*$/i, '')
    .replace(/-\s*Yellow\s*Pages.*$/i, '')
    .replace(/\|\s*Official.*$/i, '')
    .replace(/([-|]).*$/, '')
    .trim();
}

function isJunk(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return true;
  const l = name.toLowerCase();
  const junk = ['wikipedia', 'dictionary', 'definition', 'about us', 'contact us',
    'terms of service', 'privacy policy', 'how to', 'guide', 'blog', 'forum',
    'sign up', 'login', 'career', 'hiring', 'news', 'youtube', 'pinterest', 'justdial', 'sulekha'];
  return junk.some(j => l.includes(j));
}

// ──────────────────────────────────────────────
// Multi-Engine Search Fallback (HTML Parsers)
// ──────────────────────────────────────────────

async function searchWebEngines(
  query: string,
  maxResults: number,
  seenNames: Set<string>,
  niche: string,
  location: string,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];

  // Try DuckDuckGo first
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    logCallback(`🦆 Trying DuckDuckGo...`);
    const res = await fetchWithTimeout(url, { headers: getAntiBotHeaders('html') }, 8000);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const elements = $('.result').toArray();

      for (const el of elements) {
        if (results.length >= maxResults) break;
        const titleEl = $(el).find('.result__title a, .result__a');
        const title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';
        const snippet = $(el).find('.result__snippet').text().trim();

        if (href.includes('uddg=')) {
          try { href = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') || href; } catch {}
        }
        processSearchResult(title, snippet, href, niche, location, seenNames, results, 'DuckDuckGo');
      }
      if (results.length > 0) return results;
    } else {
      logCallback(`⚠️ DuckDuckGo returned HTTP ${res.status}. Falling back...`);
    }
  } catch (e: any) {
    logCallback(`⚠️ DuckDuckGo failed: ${e.message}`);
  }

  // Fallback 1: Yahoo Search
  if (results.length === 0) {
    try {
      const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&n=20`;
      logCallback(`🟣 Trying Yahoo Search...`);
      const res = await fetchWithTimeout(url, { headers: getAntiBotHeaders('html') }, 8000);

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const elements = $('.algo').toArray();

        for (const el of elements) {
          if (results.length >= maxResults) break;
          const title = $(el).find('h3.title').text().trim();
          const href = $(el).find('h3.title a').attr('href') || '';
          const snippet = $(el).find('.compText').text().trim();
          
          processSearchResult(title, snippet, href, niche, location, seenNames, results, 'Yahoo');
        }
        if (results.length > 0) return results;
      } else {
        logCallback(`⚠️ Yahoo returned HTTP ${res.status}.`);
      }
    } catch (e: any) {
      logCallback(`⚠️ Yahoo failed: ${e.message}`);
    }
  }

  // Fallback 2: AOL Search
  if (results.length === 0) {
    try {
      const url = `https://search.aol.com/aol/search?q=${encodeURIComponent(query)}&n=20`;
      logCallback(`🔵 Trying AOL Search...`);
      const res = await fetchWithTimeout(url, { headers: getAntiBotHeaders('html') }, 8000);

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const elements = $('.algo').toArray();

        for (const el of elements) {
          if (results.length >= maxResults) break;
          const title = $(el).find('h3.title').text().trim();
          const href = $(el).find('h3.title a').attr('href') || '';
          const snippet = $(el).find('.compText').text().trim();
          
          processSearchResult(title, snippet, href, niche, location, seenNames, results, 'AOL');
        }
      } else {
        logCallback(`⚠️ AOL returned HTTP ${res.status}.`);
      }
    } catch (e: any) {
      logCallback(`⚠️ AOL failed: ${e.message}`);
    }
  }

  return results;
}

function processSearchResult(
  title: string, 
  snippet: string, 
  href: string, 
  niche: string, 
  location: string, 
  seenNames: Set<string>, 
  results: ScrapedBusiness[],
  source: string
) {
  const name = cleanTitle(title);
  if (isJunk(name)) return;

  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normName || seenNames.has(normName)) return;
  seenNames.add(normName);

  const combinedText = `${title} ${snippet}`;
  const phone = extractPhone(combinedText);
  const email = extractEmail(combinedText);

  results.push({
    Name: name,
    Niche: niche,
    Location: location,
    Phone: phone,
    Email: email,
    Website: href.startsWith('http') && !href.includes('yahoo') && !href.includes('aol') ? href : 'N/A',
    Ratings: 'N/A',
    Source: source,
  });
}


// ──────────────────────────────────────────────
// OpenStreetMap Spatial (Overpass + Nominatim)
// ──────────────────────────────────────────────

const COORDS: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.076, lon: 72.878 }, pune: { lat: 18.520, lon: 73.857 },
  delhi: { lat: 28.614, lon: 77.209 }, bangalore: { lat: 12.972, lon: 77.595 },
  hyderabad: { lat: 17.385, lon: 78.487 }, ahmedabad: { lat: 23.023, lon: 72.571 },
  chennai: { lat: 13.083, lon: 80.271 }, kolkata: { lat: 22.573, lon: 88.364 },
  jaipur: { lat: 26.912, lon: 75.787 }, surat: { lat: 21.170, lon: 72.831 },
  lucknow: { lat: 26.847, lon: 80.946 }, nagpur: { lat: 21.146, lon: 79.088 },
  indore: { lat: 22.720, lon: 75.858 }, thane: { lat: 19.218, lon: 72.978 },
  bhopal: { lat: 23.259, lon: 77.413 }, chandigarh: { lat: 30.733, lon: 76.779 },
  noida: { lat: 28.535, lon: 77.391 }, gurgaon: { lat: 28.457, lon: 77.027 },
};

async function searchSpatialAPI(
  niche: string,
  location: string,
  maxResults: number,
  seenNames: Set<string>,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];
  const cleanLoc = location.split(',')[0].toLowerCase().trim();
  
  // Method 1: OpenStreetMap Nominatim (more forgiving API)
  logCallback(`🗺️ Trying OpenStreetMap Nominatim...`);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${niche} in ${location}`)}&format=json&addressdetails=1&extratags=1&limit=50`;
    
    // Nominatim strictly requires a custom User-Agent identifying the app
    const res = await fetchWithTimeout(url, { 
      headers: { 
        'User-Agent': 'DataMinerApp/2.0 (contact@dataminer.local)',
        'Accept': 'application/json'
      } 
    }, 10000);

    if (res.ok) {
      const data = await res.json();
      logCallback(`Nominatim returned ${data.length} results.`);
      
      for (const item of data) {
        if (results.length >= maxResults) break;
        const tags = item.extratags || {};
        
        const rawName = item.name || item.display_name?.split(',')[0];
        if (!rawName || rawName.length < 3) continue;

        const name = cleanTitle(rawName);
        if (isJunk(name)) continue;

        const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normName || seenNames.has(normName)) continue;
        seenNames.add(normName);

        const phone = tags.phone || tags['contact:phone'] || extractPhone(JSON.stringify(tags));
        const email = tags.email || tags['contact:email'] || extractEmail(JSON.stringify(tags));
        const website = tags.website || tags['contact:website'] || 'N/A';

        results.push({
          Name: name,
          Niche: niche,
          Location: location,
          Phone: phone || 'N/A',
          Email: email || 'N/A',
          Website: website.startsWith('http') ? website : 'N/A',
          Ratings: 'N/A',
          Source: 'OpenStreetMap',
        });
      }
    } else {
      logCallback(`⚠️ Nominatim returned HTTP ${res.status}`);
    }
  } catch (e: any) {
    logCallback(`⚠️ Nominatim failed: ${e.message}`);
  }

  // Method 2: Overpass API Fallback (with fixed headers)
  if (results.length < maxResults && COORDS[cleanLoc]) {
    const coords = COORDS[cleanLoc];
    logCallback(`🗺️ Falling back to Overpass API for coordinates...`);
    try {
      const radius = 50000;
      const overpassQuery = `[out:json][timeout:15];(node["office"](around:${radius},${coords.lat},${coords.lon});node["shop"](around:${radius},${coords.lat},${coords.lon});node["amenity"](around:${radius},${coords.lat},${coords.lon});way["office"](around:${radius},${coords.lat},${coords.lon}););out tags 200;`;
      const url = `https://overpass-api.de/api/interpreter`;
      
      const res = await fetchWithTimeout(url, { 
        method: 'POST',
        headers: { 
          // Overpass requires explicit URL-encoded content type and accepts JSON
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': getRandomUA()
        },
        body: `data=${encodeURIComponent(overpassQuery)}`
      }, 15000);

      if (res.ok) {
        const data = await res.json();
        const elements = data.elements || [];
        const nicheTerm = niche.toLowerCase().replace(/agents?|services?/gi, '').trim();

        for (const el of elements) {
          if (results.length >= maxResults) break;
          const tags = el.tags || {};
          const rawName = tags.name;
          if (!rawName || rawName.length < 3) continue;

          const name = cleanTitle(rawName);
          if (isJunk(name)) continue;

          const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!normName || seenNames.has(normName)) continue;

          const tagStr = JSON.stringify(tags).toLowerCase();
          if (!tagStr.includes(nicheTerm) && !tagStr.includes('office') && !tagStr.includes('agency') && !tagStr.includes('company') && !tagStr.includes('service') && !tagStr.includes('shop')) continue;

          seenNames.add(normName);
          const phone = tags.phone || tags['contact:phone'] || extractPhone(JSON.stringify(tags));
          const email = tags.email || tags['contact:email'] || extractEmail(JSON.stringify(tags));
          const website = tags.website || tags['contact:website'] || 'N/A';

          results.push({
            Name: name,
            Niche: niche,
            Location: location,
            Phone: phone || 'N/A',
            Email: email || 'N/A',
            Website: website.startsWith('http') ? website : 'N/A',
            Ratings: 'N/A',
            Source: 'Overpass API',
          });
        }
      } else {
        logCallback(`⚠️ Overpass returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      logCallback(`⚠️ Overpass failed: ${e.message}`);
    }
  }

  return results;
}

// ──────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────

export async function scrapeGoogleMaps(
  niche: string,
  location: string,
  maxResults: number,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const seenNames = new Set<string>();
  let allLeads: ScrapedBusiness[] = [];
  const cleanLoc = location.split(',')[0].trim();

  // 1. Search Web Engines (DDG -> Yahoo -> AOL)
  const queries = [
    `${niche} in ${cleanLoc} phone contact`,
    `best ${niche} ${cleanLoc} phone number`,
    `"${niche}" "${cleanLoc}" site:justdial.com OR site:sulekha.com`,
    `"${niche}" "${cleanLoc}" "+91"`,
  ];

  for (const q of queries) {
    if (allLeads.length >= maxResults) break;
    logCallback(`🔍 Querying: "${q}"`);
    const batch = await searchWebEngines(q, maxResults - allLeads.length, seenNames, niche, location, logCallback);
    allLeads.push(...batch);
    logCallback(`📊 Leads found so far: ${allLeads.length}`);
    await new Promise(r => setTimeout(r, 600)); // Rate limit pause
  }

  // 2. Spatial Databases (Nominatim -> Overpass)
  if (allLeads.length < maxResults) {
    const geoBatch = await searchSpatialAPI(niche, location, maxResults - allLeads.length, seenNames, logCallback);
    allLeads.push(...geoBatch);
    logCallback(`📊 Leads found after Geo Search: ${allLeads.length}`);
  }

  logCallback(`🎯 Search complete: ${allLeads.length} leads extracted`);
  return allLeads;
}

// ──────────────────────────────────────────────
// Website enrichment — extract email/phone/socials
// ──────────────────────────────────────────────

export async function enrichLeadFromWebsite(websiteUrl: string): Promise<{ email: string; socials: string; phone: string }> {
  if (!websiteUrl || websiteUrl === 'N/A' || websiteUrl.includes('google.com/maps')) {
    return { email: 'N/A', socials: 'N/A', phone: 'N/A' };
  }

  try {
    const res = await fetchWithTimeout(websiteUrl, {
      headers: getAntiBotHeaders('html')
    }, 5000);

    if (!res.ok) return { email: 'N/A', socials: 'N/A', phone: 'N/A' };

    const html = await res.text();
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    const email = extractEmail(bodyText);
    const phone = extractPhone(bodyText);

    const socialLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;
      const lh = href.toLowerCase();
      if (lh.includes('facebook.com/') && !socialLinks.some(l => l.includes('facebook.com'))) socialLinks.push(href);
      else if (lh.includes('instagram.com/') && !socialLinks.some(l => l.includes('instagram.com'))) socialLinks.push(href);
      else if (lh.includes('linkedin.com/') && !socialLinks.some(l => l.includes('linkedin.com'))) socialLinks.push(href);
      else if ((lh.includes('twitter.com/') || lh.includes('x.com/')) && !socialLinks.some(l => l.includes('twitter.com') || l.includes('x.com'))) socialLinks.push(href);
    });

    return {
      email,
      socials: socialLinks.length > 0 ? socialLinks.join(', ') : 'N/A',
      phone,
    };
  } catch (e) {}

  return { email: 'N/A', socials: 'N/A', phone: 'N/A' };
}
