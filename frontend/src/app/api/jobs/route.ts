import { NextResponse } from 'next/server';
import { scrapeGoogleMaps, scrapeYellowPages, scrapeYelp, scrapeTripAdvisor, scrapeZillow, scrapeLinkedIn, scrapeApollo } from './scraper';

const jobsStore: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { niche, location, platforms, maxResults } = body;

    const jobId = Math.random().toString(36).substring(2, 15);
    
    jobsStore[jobId] = {
      id: jobId,
      status: 'processing',
      progress: 'Initializing agent crew...',
      logs: ['Job started'],
      resultData: null
    };

    runAgentCrew(jobId, niche, location, platforms, maxResults);

    return NextResponse.json({ jobId, status: 'processing' });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

async function runAgentCrew(jobId: string, niche: string, location: string, platforms: string[], maxResults: number) {
  const log = (msg: string) => {
    jobsStore[jobId].logs.push(msg);
    jobsStore[jobId].progress = msg;
    console.log(`[Job ${jobId}] ${msg}`);
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    log(`Search Agent: Formulating search strategy for ${niche} in ${location}...`);
    
    if (platforms.includes('All Platforms')) {
      log(`Triggering headless Playwright browsers to scrape multiple platforms in parallel...`);
      
      const [mapsData, ypData, yelpData, taData, zillowData, liData, apolloData] = await Promise.all([
        scrapeGoogleMaps(niche, location, maxResults, log),
        scrapeYellowPages(niche, location, maxResults, log),
        scrapeYelp(niche, location, maxResults, log),
        scrapeTripAdvisor(niche, location, maxResults, log),
        scrapeZillow(niche, location, maxResults, log),
        scrapeLinkedIn(niche, location, maxResults, log),
        scrapeApollo(niche, location, maxResults, log)
      ]);
      
      // Interleave results (1 from each platform, repeat)
      const interleaved = [];
      const maxLength = Math.max(mapsData.length, ypData.length, yelpData.length, taData.length, zillowData.length, liData.length, apolloData.length);
      for (let i = 0; i < maxLength; i++) {
        if (mapsData[i]) interleaved.push(mapsData[i]);
        if (ypData[i]) interleaved.push(ypData[i]);
        if (yelpData[i]) interleaved.push(yelpData[i]);
        if (taData[i]) interleaved.push(taData[i]);
        if (zillowData[i]) interleaved.push(zillowData[i]);
        if (liData[i]) interleaved.push(liData[i]);
        if (apolloData[i]) interleaved.push(apolloData[i]);
      }
      
      jobsStore[jobId].resultData = interleaved;
    } else if (platforms.includes('Google Maps')) {
      log(`Triggering headless Playwright browser to scrape Google Maps...`);
      const scrapedData = await scrapeGoogleMaps(niche, location, maxResults, log);
      jobsStore[jobId].resultData = scrapedData;
    } else if (platforms.includes('YellowPages')) {
      log(`Triggering headless Playwright browser to scrape YellowPages...`);
      const scrapedData = await scrapeYellowPages(niche, location, maxResults, log);
      jobsStore[jobId].resultData = scrapedData;
    } else {
      log(`Fallback: Only Google Maps is implemented for the free local scraper right now.`);
      jobsStore[jobId].resultData = [];
    }

    jobsStore[jobId].status = 'completed';
    jobsStore[jobId].progress = 'Job completed successfully.';
    log('Process finished successfully.');

  } catch (error: any) {
    jobsStore[jobId].status = 'failed';
    jobsStore[jobId].progress = `Error: ${error.message}`;
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
