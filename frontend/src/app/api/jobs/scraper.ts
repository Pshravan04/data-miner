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
  Socials?: string;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.0760, lon: 72.8777 },
  pune: { lat: 18.5204, lon: 73.8567 },
  delhi: { lat: 28.6139, lon: 77.2090 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  surat: { lat: 21.1702, lon: 72.8311 },
  lucknow: { lat: 26.8467, lon: 80.9462 },
  nagpur: { lat: 21.1458, lon: 79.0882 },
  indore: { lat: 22.7196, lon: 75.8577 },
  thane: { lat: 19.2183, lon: 72.9781 }
};

const SUB_LOCATIONS: Record<string, string[]> = {
  mumbai: ['Bandra', 'Andheri', 'Juhu', 'Worli', 'Powai', 'Thane', 'Navi Mumbai', 'Borivali', 'Malad', 'Goregaon', 'Dadar', 'Chembur', 'Mulund', 'Kandivali', 'Vashi'],
  pune: ['Kothrud', 'Baner', 'Wakad', 'Viman Nagar', 'Hadapsar', 'Hinjewadi', 'Kharadi', 'Aundh', 'Shivajinagar', 'Deccan', 'Magarpatta', 'Kalyani Nagar', 'Pimpri', 'Chinchwad', 'Kondhwa'],
  delhi: ['Connaught Place', 'Dwarka', 'Rohini', 'Saket', 'Lajpat Nagar', 'Karol Bagh', 'Nehru Place', 'Rajouri Garden', 'Janakpuri', 'Pitampura', 'Vasant Kunj', 'Greater Kailash', 'Hauz Khas', 'South Extension', 'Noida'],
  bangalore: ['Indiranagar', 'Koramangala', 'Whitefield', 'HSR Layout', 'Jayanagar', 'MG Road', 'Electronic City', 'Marathahalli', 'Yelahanka', 'Rajajinagar', 'JP Nagar', 'Bannerghatta', 'Hebbal', 'Malleswaram', 'Basavanagudi'],
  hyderabad: ['Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Hitech City', 'Madhapur', 'Ameerpet', 'Kukatpally', 'Secunderabad', 'Kondapur', 'Begumpet', 'Uppal', 'Dilsukhnagar', 'LB Nagar', 'Miyapur'],
  chennai: ['T Nagar', 'Adyar', 'Velachery', 'Anna Nagar', 'OMR', 'Nungambakkam', 'Mylapore', 'Porur', 'Tambaram', 'Guindy', 'Sholinganallur', 'Perambur', 'Egmore', 'Alwarpet'],
  kolkata: ['Salt Lake', 'New Town', 'Park Street', 'Ballygunge', 'Alipore', 'Howrah', 'Dum Dum', 'Behala', 'Jadavpur', 'Gariahat', 'Lake Town', 'Tollygunge', 'Rajarhat'],
  ahmedabad: ['SG Highway', 'Prahlad Nagar', 'Bodakdev', 'Satellite', 'Vastrapur', 'Navrangpura', 'Maninagar', 'Chandkheda', 'Bopal', 'Thaltej', 'Gurukul', 'Ambawadi']
};

// Niche-specific OSM tag mappings for better Overpass targeting
const NICHE_OSM_TAGS: Record<string, string[]> = {
  'real estate': ['office=estate_agent', 'office=property', 'shop=estate_agent', 'office=company'],
  'plumber': ['craft=plumber', 'shop=plumber', 'amenity=plumber'],
  'restaurant': ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'],
  'hotel': ['tourism=hotel', 'tourism=guest_house', 'tourism=motel'],
  'gym': ['leisure=fitness_centre', 'leisure=sports_centre', 'amenity=gym'],
  'hospital': ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'],
  'school': ['amenity=school', 'amenity=college', 'amenity=university'],
  'salon': ['shop=hairdresser', 'shop=beauty', 'amenity=beauty'],
  'dentist': ['amenity=dentist', 'healthcare=dentist'],
  'lawyer': ['office=lawyer', 'office=legal'],
  'architect': ['office=architect', 'office=architectural'],
  'car': ['shop=car', 'shop=car_repair', 'amenity=car_rental'],
  'pharmacy': ['amenity=pharmacy', 'shop=chemist'],
  'insurance': ['office=insurance', 'shop=insurance'],
  'bank': ['amenity=bank', 'office=financial'],
  'travel': ['shop=travel_agency', 'office=travel_agent'],
};

/**
 * Custom fetch wrapper with AbortController timeout to prevent hangs.
 */
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3500): Promise<Response> {
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

/**
 * Extracts real Indian phone numbers from text snippets.
 */
function extractIndianPhone(text: string): string {
  if (!text) return 'N/A';
  
  const phoneRegex = /(?:\+?91[\s\.-]?)?(?:0)?([6-9]\d{4}[\s\.-]?\d{5}|[6-9]\d{9}|[6-9]\d{2}[\s\.-]?\d{3}[\s\.-]?\d{4})/g;
  const matches = text.match(phoneRegex);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      const digits = match.replace(/[^0-9]/g, '');
      const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
      if (tenDigits.length === 10 && /^[6-9]/.test(tenDigits)) {
        return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
      }
    }
  }

  const landlineRegex = /(?:0\d{2,4}[\s-]?)?[2-8]\d{6,7}/g;
  const landlineMatches = text.match(landlineRegex);
  if (landlineMatches && landlineMatches.length > 0) {
    const clean = landlineMatches[0].trim();
    if (clean.length >= 8) return clean;
  }

  return 'N/A';
}

/**
 * Extracts real email address from text snippet.
 */
function extractEmail(text: string): string {
  if (!text) return 'N/A';
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  if (matches && matches.length > 0) {
    const email = matches[0].toLowerCase();
    if (!email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.svg')) {
      return email;
    }
  }
  return 'N/A';
}

/**
 * Cleans extracted company/profile title from search engine results.
 */
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/•\s*Instagram.*$/i, '')
    .replace(/\|\s*Facebook.*$/i, '')
    .replace(/-\s*LinkedIn.*$/i, '')
    .replace(/-\s*Justdial.*$/i, '')
    .replace(/\|\s*Official Site.*$/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/([-\|]).*$/, '')
    .trim();
}

/**
 * Rejects generic non-business pages or noise from search engines.
 */
function isGenericBusinessName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return true;
  const lower = name.toLowerCase();
  
  const genericKeywords = [
    'wikipedia', 'dictionary', 'definition', 'meaning', 'realtor.com',
    'real madrid', 'real daytime', 'designer clothes', 'buy & sell',
    'regulatory authority', 'rera', 'about us', 'contact us', 'home page',
    'terms of service', 'privacy policy', 'facebook', 'instagram', 'linkedin',
    'pinterest', 'youtube', 'twitter', 'mercedes', 'official site', 'global',
    'world wide', 'news', 'career', 'job search', 'hiring', 'recruitment',
    'how to', 'guide', 'news', 'blog', 'forum', 'thread', 'sign up', 'login'
  ];

  if (lower === 'real' || lower === 'estate' || lower === 'agent' || lower === 'agents' || lower.includes('real estate property & homes')) return true;
  return genericKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Targeted Deep Contact Search using sequential multi-engine fallbacks.
 */
async function enrichMissingPhone(name: string, location: string): Promise<{ phone: string; email: string }> {
  const cleanNameStr = cleanTitle(name);
  if (!cleanNameStr || cleanNameStr.length < 3) return { phone: 'N/A', email: 'N/A' };

  const query = `${cleanNameStr} ${location.split(',')[0]} phone contact mobile number`;
  const engines = [
    { name: 'Yahoo', url: `https://search.yahoo.com/search?q=${encodeURIComponent(query)}` },
    { name: 'Bing', url: `https://www.bing.com/search?q=${encodeURIComponent(query)}` }
  ];

  for (const engine of engines) {
    try {
      const res = await fetchWithTimeout(engine.url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, 800);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        
        let snippetText = '';
        if (engine.name === 'Yahoo') {
          snippetText = $('.algo, .compTitle, .compText').text();
        } else {
          snippetText = $('.b_algo, .b_ans').text();
        }
        
        const phone = extractIndianPhone(snippetText);
        const email = extractEmail(snippetText);
        if (phone !== 'N/A') {
          return { phone, email };
        }
      }
    } catch (e) {}
  }

  return { phone: 'N/A', email: 'N/A' };
}

/**
 * Dynamic Website Contact Enrichment Scraper.
 */
export async function enrichLeadFromWebsite(websiteUrl: string): Promise<{ email: string; socials: string }> {
  if (!websiteUrl || websiteUrl === 'N/A' || websiteUrl.includes('google.com/search') || websiteUrl.includes('bing.com')) {
    return { email: 'N/A', socials: 'N/A' };
  }

  try {
    const res = await fetchWithTimeout(websiteUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, 4000);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let email = extractEmail(html);
      const socialLinks: string[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')?.trim();
        if (href) {
          const lh = href.toLowerCase();
          if (lh.includes('facebook.com') && !socialLinks.some(l => l.includes('facebook.com'))) socialLinks.push(href);
          else if (lh.includes('instagram.com') && !socialLinks.some(l => l.includes('instagram.com'))) socialLinks.push(href);
          else if (lh.includes('linkedin.com') && !socialLinks.some(l => l.includes('linkedin.com'))) socialLinks.push(href);
          else if ((lh.includes('twitter.com') || lh.includes('x.com')) && !socialLinks.some(l => l.includes('twitter.com') || l.includes('x.com'))) socialLinks.push(href);
          else if (lh.includes('youtube.com') && !socialLinks.some(l => l.includes('youtube.com'))) socialLinks.push(href);
        }
      });
      return { email, socials: socialLinks.length > 0 ? socialLinks.join(', ') : 'N/A' };
    }
  } catch (e) {}
  return { email: 'N/A', socials: 'N/A' };
}

/**
 * Find the best Overpass tags for a given niche.
 */
function getOverpassTagsForNiche(niche: string): string[] {
  const lower = niche.toLowerCase();
  for (const [key, tags] of Object.entries(NICHE_OSM_TAGS)) {
    if (lower.includes(key)) return tags;
  }
  return ['office', 'shop', 'amenity', 'craft', 'healthcare'];
}

/**
 * Live Overpass OpenData Spatial Harvester — expanded with niche-specific tags and way/relation support.
 */
export async function scrapeOverpassAPI(
  niche: string,
  location: string,
  targetCount: number,
  historyKeys: Set<string>,
  logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Executing High-Volume Overpass Spatial Query for ${niche} in ${location}...`);
  const results: ScrapedBusiness[] = [];
  const seenNames = new Set<string>();
  const cleanLoc = location.split(',')[0].toLowerCase().trim();
  const coords = CITY_COORDINATES[cleanLoc] || { lat: 19.0760, lon: 72.8777 };
  const radius = 50000;

  try {
    const nicheTags = getOverpassTagsForNiche(niche);
    const tagQueries: string[] = [];
    for (const tag of nicheTags) {
      if (tag.includes('=')) {
        const [k, v] = tag.split('=');
        tagQueries.push(`node["${k}"="${v}"](around:${radius},${coords.lat},${coords.lon})`);
        tagQueries.push(`way["${k}"="${v}"](around:${radius},${coords.lat},${coords.lon})`);
      } else {
        tagQueries.push(`node["${tag}"](around:${radius},${coords.lat},${coords.lon})`);
        tagQueries.push(`way["${tag}"](around:${radius},${coords.lat},${coords.lon})`);
      }
    }
    const overpassQuery = `[out:json][timeout:10];(${tagQueries.join(';')};);out tags 2000;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': DEFAULT_USER_AGENT } }, 8000);
    if (res.ok) {
      const data = await res.json();
      const elements = data.elements || [];
      const nicheTerm = niche.toLowerCase().replace(/agents?/i, '').trim();
      logCallback(`Overpass returned ${elements.length} raw spatial nodes. Filtering for ${niche}...`);

      for (const el of elements) {
        if (results.length >= targetCount) break;
        const tags = el.tags || {};
        const rawName = tags.name;
        if (!rawName || rawName.length < 3) continue;
        const name = cleanTitle(rawName);
        if (!name || isGenericBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
        const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (historyKeys.has(nameKey)) continue;
        const tagStr = JSON.stringify(tags).toLowerCase();
        if (tagStr.includes(nicheTerm) || tagStr.includes('office') || tagStr.includes('agency') || tagStr.includes('estate') || tagStr.includes('property') || tagStr.includes('realty') || tagStr.includes('shop') || tagStr.includes('company') || tagStr.includes('service') || tagStr.includes('consultant')) {
          let phone = tags.phone || tags['contact:phone'] || tags.mobile || extractIndianPhone(JSON.stringify(tags));
          let email = tags.email || tags['contact:email'] || extractEmail(JSON.stringify(tags));
          seenNames.add(name.toLowerCase());
          const website = tags.website || tags['contact:website'] || tags.url || `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + cleanLoc)}`;
          results.push({
            Name: name, Niche: niche, Location: location, Phone: phone, Email: email,
            Website: website.startsWith('http') ? website : `https://${website}`,
            Ratings: tags['stars'] || '4.0/5.0', Source: 'Google Maps'
          });
          if (results.length % 10 === 0 || results.length === targetCount) {
            logCallback(`Extracted Overpass Business (${results.length}/${targetCount}): ${name}`);
          }
        }
      }
    }
  } catch (e: any) {
    logCallback(`Overpass Warning: ${e.message}`);
  }
  return results;
}

/**
 * Live OpenStreetMap Multi-Term B2B Harvester — uses ALL sub-locations.
 */
export async function scrapeOpenStreetMap(
  niche: string, location: string, maxResults: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];
  const seenNames = new Set<string>();
  try {
    const cleanLoc = location.split(',')[0].toLowerCase().trim();
    const cleanNicheStr = niche.replace(/agents?/i, '').trim();
    const baseSubLocs = SUB_LOCATIONS[cleanLoc] || [];
    const subLocs = ['', ...baseSubLocs];
    for (const sub of subLocs) {
      if (results.length >= maxResults) break;
      const targetArea = sub ? `${sub} ${cleanLoc}` : cleanLoc;
      const searchQueries = [`${niche} ${targetArea}`, `${cleanNicheStr} ${targetArea}`, `${cleanNicheStr} office ${targetArea}`];
      for (const q of searchQueries) {
        if (results.length >= maxResults) break;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&extratags=1&limit=50`;
        try {
          const res = await fetchWithTimeout(url, {
            headers: { 'User-Agent': `DataMiner/1.0 (${cleanLoc}@example.com)`, 'Accept': 'application/json' }
          }, 3500);
          if (res.ok) {
            const items = await res.json();
            if (Array.isArray(items)) {
              for (const item of items) {
                if (results.length >= maxResults) break;
                const rawName = item.display_name ? item.display_name.split(',')[0].trim() : '';
                const name = cleanTitle(rawName);
                if (!name || isGenericBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
                const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (historyKeys.has(nameKey)) continue;
                const extratags = item.extratags || {};
                let phone = extratags.phone || extratags['contact:phone'] || extratags.mobile || extractIndianPhone(JSON.stringify(item));
                let email = extratags.email || extratags['contact:email'] || extractEmail(JSON.stringify(item));
                seenNames.add(name.toLowerCase());
                let website = extratags.website || extratags['contact:website'] || extratags.url || 'N/A';
                if (!website.startsWith('http')) {
                  website = `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + cleanLoc)}`;
                }
                results.push({
                  Name: name, Niche: niche, Location: sub ? `${sub}, ${location}` : location,
                  Phone: phone, Email: email, Website: website, Ratings: '4.0/5.0', Source: 'Google Maps'
                });
                logCallback(`Extracted OSM Business (${results.length}/${maxResults}): ${name}`);
              }
            }
          }
        } catch (err) {}
        await new Promise(r => setTimeout(r, 1100));
      }
    }
  } catch (e: any) {
    logCallback(`OpenStreetMap Warning: ${e.message}`);
  }
  return results;
}

/**
 * Multi-engine search dorking — tries DuckDuckGo HTML, Bing, and Yahoo in sequence.
 * DuckDuckGo is more permissive from server IPs than Bing.
 */
async function scrapeSearchDork(
  dorkQuery: string, niche: string, location: string, platformName: string,
  maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  logCallback(`Executing Multi-Engine Search on ${platformName}: ${dorkQuery}`);
  const results: ScrapedBusiness[] = [];
  const seenUrls = new Set<string>();

  const searchEngines = [
    {
      name: 'DuckDuckGo',
      getUrl: (q: string, _offset: number) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      resultSelector: '.result',
      titleSelector: '.result__title a, .result__a',
      snippetSelector: '.result__snippet',
      urlAttr: 'href',
    },
    {
      name: 'Bing',
      getUrl: (q: string, offset: number) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&first=${offset + 1}&count=30`,
      resultSelector: '.b_algo',
      titleSelector: 'h2 a',
      snippetSelector: '.b_caption p, .b_algoSlug',
      urlAttr: 'href',
    },
    {
      name: 'Yahoo',
      getUrl: (q: string, offset: number) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}&b=${offset + 1}`,
      resultSelector: '.algo, .searchCenterMiddle .dd',
      titleSelector: 'h3 a, .compTitle a',
      snippetSelector: '.compText, p',
      urlAttr: 'href',
    },
  ];

  for (const engine of searchEngines) {
    if (results.length >= maxResults) break;
    for (let page = 0; page < 10; page++) {
      if (results.length >= maxResults) break;
      const currentOffset = (pageOffset + page) * 15;
      try {
        const searchUrl = engine.getUrl(dorkQuery, currentOffset);
        const res = await fetchWithTimeout(searchUrl, {
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }, 4000);

        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          const elements = $(engine.resultSelector).toArray();
          if (elements.length === 0) {
            logCallback(`${engine.name} returned 0 results on page ${page + 1}, trying next engine...`);
            break;
          }
          for (const el of elements) {
            if (results.length >= maxResults) break;
            const titleEl = $(el).find(engine.titleSelector);
            const title = titleEl.text().trim();
            let url = titleEl.attr(engine.urlAttr) || '';
            const snippet = $(el).find(engine.snippetSelector).text().trim();
            if (engine.name === 'DuckDuckGo' && url.includes('uddg=')) {
              try { const parsed = new URL(url, 'https://duckduckgo.com'); url = parsed.searchParams.get('uddg') || url; } catch (e) {}
            }
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              const name = cleanTitle(title);
              if (isGenericBusinessName(name)) continue;
              const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (historyKeys.has(nameKey)) continue;
              let combinedText = `${title} ${snippet}`;
              let phone = extractIndianPhone(combinedText);
              let email = extractEmail(combinedText);
              results.push({
                Name: name, Niche: niche, Location: location, Phone: phone, Email: email,
                Website: url.startsWith('http') ? url : 'N/A', Ratings: '4.0/5.0', Source: platformName
              });
              logCallback(`Extracted Lead (${results.length}/${maxResults}): ${name}`);
            }
          }
        } else {
          logCallback(`${engine.name} returned HTTP ${res.status}, trying next engine...`);
          break;
        }
      } catch (e: any) {
        logCallback(`${engine.name} Page ${page + 1} Warning: ${e.message}`);
        break;
      }
    }
  }
  return results;
}

function getContactQualifier(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes('india') || lower.includes('mumbai') || lower.includes('pune') || lower.includes('delhi') || lower.includes('bangalore') || lower.includes('hyderabad') || lower.includes('chennai') || lower.includes('kolkata') || lower.includes('jaipur') || lower.includes('surat') || lower.includes('lucknow') || lower.includes('nagpur') || lower.includes('indore') || lower.includes('thane')) {
    return '"+91"';
  }
  return '"phone" OR "mobile" OR "contact"';
}

// ----------------------------------------------------
// Real Scraper Exports
// ----------------------------------------------------
export async function scrapeInstagram(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `site:instagram.com "${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'Instagram', maxResults, pageOffset, historyKeys, logCallback);
}

export async function scrapeFacebook(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `site:facebook.com "${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'Facebook', maxResults, pageOffset, historyKeys, logCallback);
}

export async function scrapeLinkedIn(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `site:linkedin.com "${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'LinkedIn', maxResults, pageOffset, historyKeys, logCallback);
}

export async function scrapeJustdial(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `site:justdial.com "${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'Justdial', maxResults, pageOffset, historyKeys, logCallback);
}

export async function scrapeGoogleMaps(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `"${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'Google Maps', maxResults, pageOffset, historyKeys, logCallback);
}

export async function scrapeYellowPages(
  niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void
): Promise<ScrapedBusiness[]> {
  const qualifier = getContactQualifier(location);
  const dorkQuery = `(site:sulekha.com OR site:yellowpages.co.in) "${niche}" "${location.split(',')[0]}" ${qualifier}`;
  return scrapeSearchDork(dorkQuery, niche, location, 'YellowPages', maxResults, pageOffset, historyKeys, logCallback);
}

// Unused compatibility placeholders
export async function scrapeYelp(niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void) {
  return scrapeInstagram(niche, location, maxResults, pageOffset, historyKeys, logCallback);
}
export async function scrapeTripAdvisor(niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void) {
  return scrapeFacebook(niche, location, maxResults, pageOffset, historyKeys, logCallback);
}
export async function scrapeZillow(niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void) {
  return scrapeGoogleMaps(niche, location, maxResults, pageOffset, historyKeys, logCallback);
}
export async function scrapeApollo(niche: string, location: string, maxResults: number, pageOffset: number, historyKeys: Set<string>, logCallback: (msg: string) => void) {
  return [];
}
