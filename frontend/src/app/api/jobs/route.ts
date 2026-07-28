import { NextResponse } from 'next/server';
import { scrapeGoogleMaps, scrapeInstagram, scrapeFacebook, scrapeLinkedIn, scrapeJustdial, scrapeYellowPages, ScrapedBusiness } from './scraper';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 60;

export const jobsStore: Record<string, any> = {};

function getJobFilePath(jobId: string) {
  const safeJobId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(os.tmpdir(), `data_miner_job_${safeJobId}.json`);
}

function writeJobState(jobId: string, data: any) {
  jobsStore[jobId] = data;
  try {
    fs.writeFileSync(getJobFilePath(jobId), JSON.stringify(data), 'utf-8');
  } catch (e) {}
}

function readJobState(jobId: string): any {
  if (jobsStore[jobId]) return jobsStore[jobId];
  try {
    const filePath = getJobFilePath(jobId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      jobsStore[jobId] = parsed;
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * Persistent Search History Store per Niche + Location.
 * Ensures previously extracted leads are never repeated in subsequent searches.
 */
function getHistoryFilePath(niche: string, location: string) {
  const cleanNiche = niche.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLoc = location.toLowerCase().replace(/[^a-z0-9]/g, '');
  return path.join(os.tmpdir(), `data_miner_history_${cleanNiche}_${cleanLoc}.json`);
}

function readHistoryKeys(niche: string, location: string): Set<string> {
  const set = new Set<string>();
  try {
    const filePath = getHistoryFilePath(niche, location);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const arr = JSON.parse(content);
      if (Array.isArray(arr)) {
        arr.forEach(k => set.add(k));
      }
    }
  } catch (e) {}
  return set;
}

function writeHistoryKeys(niche: string, location: string, newKeys: string[]) {
  try {
    const existing = Array.from(readHistoryKeys(niche, location));
    const combined = Array.from(new Set([...existing, ...newKeys]));
    fs.writeFileSync(getHistoryFilePath(niche, location), JSON.stringify(combined), 'utf-8');
  } catch (e) {}
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawNiche = (body.niche && String(body.niche).trim()) || 'Businesses';
    const rawLocation = (body.location && String(body.location).trim()) || 'Global';
    
    const niche = rawNiche.replace(/<[^>]*>?/g, '').substring(0, 100);
    const location = rawLocation.replace(/<[^>]*>?/g, '').substring(0, 100);
    
    const allowedPlatformsList = ['All Platforms', 'Google Maps', 'Instagram', 'Facebook', 'LinkedIn', 'Justdial', 'YellowPages'];
    const platforms = Array.isArray(body.platforms) 
      ? body.platforms.filter((p: any) => typeof p === 'string' && allowedPlatformsList.includes(p)) 
      : ['Google Maps'];

    const rawMax = typeof body.maxResults === 'number' && body.maxResults > 0 ? body.maxResults : 50;
    const maxResults = Math.min(Math.max(1, rawMax), 200);

    const jobId = Math.random().toString(36).substring(2, 15);
    
    const initialState = {
      id: jobId,
      status: 'processing',
      progress: 'Initializing deep contact search crew...',
      logs: ['Job initialized successfully.'],
      resultData: null
    };

    writeJobState(jobId, initialState);

    if (process.env.VERCEL) {
      await runAgentCrew(jobId, niche, location, platforms, maxResults);
      const completedState = readJobState(jobId);
      return NextResponse.json({ 
        jobId, 
        status: completedState?.status || 'completed', 
        progress: completedState?.progress || 'Job completed.',
        logs: completedState?.logs || [],
        resultData: completedState?.resultData || [] 
      });
    } else {
      runAgentCrew(jobId, niche, location, platforms, maxResults);
      return NextResponse.json({ jobId, status: 'processing' });
    }
  } catch (error: any) {
    console.error('Error starting job:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize extraction job.' }, { status: 500 });
  }
}

/**
 * Merges lead profiles found across multiple platform scrapers.
 * Groups by normalized business name or phone number, combines missing contact details,
 * and sets the Source field to a multi-source list (e.g., "Google Maps, Instagram, Facebook").
 * Strictly filters out any leads without a valid phone number.
 */
function mergeAndDeduplicateLeads(leads: ScrapedBusiness[]): ScrapedBusiness[] {
  const mergedMap = new Map<string, ScrapedBusiness>();

  for (const item of leads) {
    if (!item || !item.Name || item.Name === 'Unknown Name' || item.Name.length < 3) continue;
    if (!item.Phone || item.Phone === 'N/A') continue; // STRICT FILTER: Require verified phone number!

    const cleanName = item.Name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPhone = item.Phone.replace(/[^0-9]/g, '');
    
    const key = (cleanPhone && cleanPhone.length > 7) ? cleanPhone : cleanName;

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...item });
    } else {
      const existing = mergedMap.get(key)!;

      const sourcesSet = new Set(existing.Source.split(',').map(s => s.trim()).filter(Boolean));
      item.Source.split(',').map(s => s.trim()).filter(Boolean).forEach(s => sourcesSet.add(s));
      existing.Source = Array.from(sourcesSet).join(', ');

      if ((!existing.Website || existing.Website === 'N/A') && item.Website && item.Website !== 'N/A') {
        existing.Website = item.Website;
      }
      if ((!existing.Email || existing.Email === 'N/A') && item.Email && item.Email !== 'N/A') {
        existing.Email = item.Email;
      }
    }
  }

  return Array.from(mergedMap.values());
}

async function runAgentCrew(jobId: string, niche: string, location: string, platforms: string[], maxResults: number) {
  const state = readJobState(jobId) || { id: jobId, logs: [], progress: '' };
  
  const log = (msg: string) => {
    state.logs.push(msg);
    state.progress = msg;
    writeJobState(jobId, state);
    console.log(`[Job ${jobId}] ${msg}`);
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Read history memory for this Niche + Location to calculate page offset and skip previous leads
    const historyKeys = readHistoryKeys(niche, location);
    const searchIterKey = `iter_${niche}_${location}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentIter = (jobsStore[searchIterKey] || 0);
    const pageOffset = currentIter;
    jobsStore[searchIterKey] = currentIter + 1; // Increment page offset for next search run!
    
    if (historyKeys.size > 0) {
      log(`Memory Check: Found ${historyKeys.size} previously extracted leads for ${niche} in ${location}. Navigating to Deep Search Page ${pageOffset + 1}...`);
    } else {
      log(`Search Agent: Initializing Deep Contact Search strategy for ${niche} in ${location}...`);
    }
    
    let rawLeads: ScrapedBusiness[] = [];

    if (platforms.includes('All Platforms')) {
      log(`Triggering search dork agents across Instagram, Facebook, LinkedIn, Justdial, Google Maps, and YellowPages...`);
      
      const [mapsData, instaData, fbData, liData, jdData, ypData] = await Promise.all([
        scrapeGoogleMaps(niche, location, maxResults, pageOffset, historyKeys, log),
        scrapeInstagram(niche, location, maxResults, pageOffset, historyKeys, log),
        scrapeFacebook(niche, location, maxResults, pageOffset, historyKeys, log),
        scrapeLinkedIn(niche, location, maxResults, pageOffset, historyKeys, log),
        scrapeJustdial(niche, location, maxResults, pageOffset, historyKeys, log),
        scrapeYellowPages(niche, location, maxResults, pageOffset, historyKeys, log)
      ]);
      
      rawLeads = [...mapsData, ...instaData, ...fbData, ...liData, ...jdData, ...ypData];
    } else {
      log(`Triggering search dork agents for selected platforms: ${platforms.join(', ')}...`);
      const tasks: Promise<ScrapedBusiness[]>[] = [];
      if (platforms.includes('Google Maps')) tasks.push(scrapeGoogleMaps(niche, location, maxResults, pageOffset, historyKeys, log));
      if (platforms.includes('Instagram')) tasks.push(scrapeInstagram(niche, location, maxResults, pageOffset, historyKeys, log));
      if (platforms.includes('Facebook')) tasks.push(scrapeFacebook(niche, location, maxResults, pageOffset, historyKeys, log));
      if (platforms.includes('LinkedIn')) tasks.push(scrapeLinkedIn(niche, location, maxResults, pageOffset, historyKeys, log));
      if (platforms.includes('Justdial')) tasks.push(scrapeJustdial(niche, location, maxResults, pageOffset, historyKeys, log));
      if (platforms.includes('YellowPages')) tasks.push(scrapeYellowPages(niche, location, maxResults, pageOffset, historyKeys, log));

      const platformResults = await Promise.all(tasks);
      rawLeads = platformResults.flat();
    }

    log(`Enriching and verifying phone contact numbers for ${rawLeads.length} raw leads...`);
    const mergedLeads = mergeAndDeduplicateLeads(rawLeads);

    // Save newly extracted lead keys to history store
    const newKeysToSave: string[] = [];
    mergedLeads.forEach(item => {
      if (item.Name) newKeysToSave.push(item.Name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (item.Phone && item.Phone !== 'N/A') newKeysToSave.push(item.Phone.replace(/[^0-9]/g, ''));
    });
    writeHistoryKeys(niche, location, newKeysToSave);

    state.resultData = mergedLeads;
    state.status = 'completed';
    state.progress = 'Job completed successfully.';
    writeJobState(jobId, state);

    log(`Process finished successfully. Extracted ${mergedLeads.length} NEW verified phone leads.`);

  } catch (error: any) {
    state.status = 'failed';
    state.progress = `Error: ${error.message}`;
    writeJobState(jobId, state);
    log(`Error: ${error.message}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  const job = readJobState(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
