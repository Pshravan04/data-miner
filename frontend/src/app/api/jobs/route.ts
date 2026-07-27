import { NextResponse } from 'next/server';
import { scrapeGoogleMaps, scrapeYellowPages, scrapeYelp, scrapeTripAdvisor, scrapeZillow, scrapeLinkedIn, scrapeApollo, ScrapedBusiness } from './scraper';

export const maxDuration = 60;

export const jobsStore: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const niche = (body.niche && String(body.niche).trim()) || 'Businesses';
    const location = (body.location && String(body.location).trim()) || 'Global';
    const platforms = Array.isArray(body.platforms) && body.platforms.length > 0 ? body.platforms : ['Google Maps'];
    const maxResults = typeof body.maxResults === 'number' && body.maxResults > 0 ? body.maxResults : 50;

    const jobId = Math.random().toString(36).substring(2, 15);
    
    jobsStore[jobId] = {
      id: jobId,
      status: 'processing',
      progress: 'Initializing agent crew...',
      logs: ['Job initialized successfully.'],
      resultData: null
    };

    // Run scraping in background
    runAgentCrew(jobId, niche, location, platforms, maxResults);

    return NextResponse.json({ jobId, status: 'processing' });
  } catch (error: any) {
    console.error('Error starting job:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize extraction job.' }, { status: 500 });
  }
}

/**
 * Merges lead profiles found across multiple platform scrapers.
 * Groups by normalized business name or phone number, combines missing contact details,
 * and sets the Source field to a multi-source list (e.g., "Google Maps, YellowPages, Yelp").
 */
function mergeAndDeduplicateLeads(leads: ScrapedBusiness[]): ScrapedBusiness[] {
  const mergedMap = new Map<string, ScrapedBusiness>();

  for (const item of leads) {
    if (!item || !item.Name || item.Name === 'Unknown Name') continue;

    // Create clean key for deduplication
    const cleanName = item.Name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPhone = item.Phone && item.Phone !== 'N/A' ? item.Phone.replace(/[^0-9]/g, '') : '';
    
    const key = (cleanPhone && cleanPhone.length > 7) ? cleanPhone : cleanName;

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...item });
    } else {
      const existing = mergedMap.get(key)!;

      // Combine unique sources (e.g., "Google Maps, YellowPages, Yelp")
      const sourcesSet = new Set(existing.Source.split(',').map(s => s.trim()).filter(Boolean));
      item.Source.split(',').map(s => s.trim()).filter(Boolean).forEach(s => sourcesSet.add(s));
      existing.Source = Array.from(sourcesSet).join(', ');

      // Fill in missing contact data from alternate platforms
      if ((!existing.Phone || existing.Phone === 'N/A') && item.Phone && item.Phone !== 'N/A') {
        existing.Phone = item.Phone;
      }
      if ((!existing.Website || existing.Website === 'N/A') && item.Website && item.Website !== 'N/A') {
        existing.Website = item.Website;
      }
      if ((!existing.Email || existing.Email === 'N/A') && item.Email && item.Email !== 'N/A') {
        existing.Email = item.Email;
      }
      if ((!existing.Ratings || existing.Ratings === 'N/A') && item.Ratings && item.Ratings !== 'N/A') {
        existing.Ratings = item.Ratings;
      }
    }
  }

  return Array.from(mergedMap.values());
}

async function runAgentCrew(jobId: string, niche: string, location: string, platforms: string[], maxResults: number) {
  const log = (msg: string) => {
    if (jobsStore[jobId]) {
      jobsStore[jobId].logs.push(msg);
      jobsStore[jobId].progress = msg;
    }
    console.log(`[Job ${jobId}] ${msg}`);
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 300));
    log(`Search Agent: Formulating multi-source search strategy for ${niche} in ${location}...`);
    
    let rawLeads: ScrapedBusiness[] = [];

    if (platforms.includes('All Platforms')) {
      log(`Triggering scrapers across all supported platforms in parallel...`);
      
      const [mapsData, ypData, yelpData, taData, zillowData, liData, apolloData] = await Promise.all([
        scrapeGoogleMaps(niche, location, maxResults, log),
        scrapeYellowPages(niche, location, maxResults, log),
        scrapeYelp(niche, location, maxResults, log),
        scrapeTripAdvisor(niche, location, maxResults, log),
        scrapeZillow(niche, location, maxResults, log),
        scrapeLinkedIn(niche, location, maxResults, log),
        scrapeApollo(niche, location, maxResults, log)
      ]);
      
      rawLeads = [
        ...mapsData, 
        ...ypData, 
        ...yelpData, 
        ...taData, 
        ...zillowData, 
        ...liData, 
        ...apolloData
      ];
    } else {
      log(`Triggering scrapers for selected platforms: ${platforms.join(', ')}...`);
      const tasks: Promise<ScrapedBusiness[]>[] = [];
      if (platforms.includes('Google Maps')) tasks.push(scrapeGoogleMaps(niche, location, maxResults, log));
      if (platforms.includes('YellowPages')) tasks.push(scrapeYellowPages(niche, location, maxResults, log));
      if (platforms.includes('Yelp')) tasks.push(scrapeYelp(niche, location, maxResults, log));
      if (platforms.includes('TripAdvisor')) tasks.push(scrapeTripAdvisor(niche, location, maxResults, log));
      if (platforms.includes('Zillow')) tasks.push(scrapeZillow(niche, location, maxResults, log));
      if (platforms.includes('LinkedIn')) tasks.push(scrapeLinkedIn(niche, location, maxResults, log));
      if (platforms.includes('Apollo')) tasks.push(scrapeApollo(niche, location, maxResults, log));

      const platformResults = await Promise.all(tasks);
      rawLeads = platformResults.flat();
    }

    log(`Deduplicating and merging sources for ${rawLeads.length} raw leads...`);
    const mergedLeads = mergeAndDeduplicateLeads(rawLeads);

    if (jobsStore[jobId]) {
      jobsStore[jobId].resultData = mergedLeads;
      jobsStore[jobId].status = 'completed';
      jobsStore[jobId].progress = 'Job completed successfully.';
    }
    log(`Process finished successfully. Extracted ${mergedLeads.length} unique enriched leads with full source mapping.`);

  } catch (error: any) {
    if (jobsStore[jobId]) {
      jobsStore[jobId].status = 'failed';
      jobsStore[jobId].progress = `Error: ${error.message}`;
    }
    log(`Error: ${error.message}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId || !jobsStore[jobId]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(jobsStore[jobId]);
}
