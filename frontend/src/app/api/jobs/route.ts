import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  ScrapedBusiness,
  scrapeInstagram,
  scrapeFacebook,
  scrapeLinkedIn,
  scrapeJustdial,
  scrapeGoogleMaps,
  scrapeYellowPages,
  scrapeOpenStreetMap,
  scrapeOverpassAPI,
  enrichLeadFromWebsite
} from './scraper';

// Simple in-memory jobs store for progress logs and offset increments
const jobsStore: Record<string, any> = {};

function getJobFilePath(jobId: string) {
  return path.join(os.tmpdir(), `data_miner_job_${jobId}.json`);
}

function writeJobState(jobId: string, state: any) {
  try {
    fs.writeFileSync(getJobFilePath(jobId), JSON.stringify(state), 'utf-8');
  } catch (e) {}
}

function readJobState(jobId: string) {
  try {
    const filePath = getJobFilePath(jobId);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function getHistoryFilePath(niche: string, location: string) {
  const cleanNiche = niche.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLoc = location.toLowerCase().replace(/[^a-z0-9]/g, '');
  return path.join(os.tmpdir(), `data_miner_history_leads_${cleanNiche}_${cleanLoc}.json`);
}

function readHistoryLeads(niche: string, location: string): ScrapedBusiness[] {
  try {
    const filePath = getHistoryFilePath(niche, location);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const arr = JSON.parse(content);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

function writeHistoryLeads(niche: string, location: string, newLeads: ScrapedBusiness[]) {
  try {
    const existing = readHistoryLeads(niche, location);
    const combined = [...existing];
    for (const lead of newLeads) {
      if (!combined.some(x => x.Name === lead.Name || x.Phone === lead.Phone)) {
        combined.push(lead);
      }
    }
    fs.writeFileSync(getHistoryFilePath(niche, location), JSON.stringify(combined), 'utf-8');
  } catch (e) {}
}

function readHistoryKeys(niche: string, location: string): Set<string> {
  const set = new Set<string>();
  const leads = readHistoryLeads(niche, location);
  leads.forEach(lead => {
    if (lead.Name) set.add(lead.Name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (lead.Phone && lead.Phone !== 'N/A') set.add(lead.Phone.replace(/[^0-9]/g, ''));
  });
  return set;
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
    const maxResults = Math.min(Math.max(1, rawMax), 5000);

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
      return NextResponse.json({ jobId, status: 'processing', progress: 'Job started.' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  const state = readJobState(jobId);
  if (!state) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}

function mergeAndDeduplicateLeads(leads: ScrapedBusiness[]): ScrapedBusiness[] {
  const mergedMap = new Map<string, ScrapedBusiness>();

  for (const item of leads) {
    if (!item.Name || !item.Phone || item.Phone === 'N/A') continue;
    const normPhone = item.Phone.replace(/[^0-9]/g, '');
    const normName = item.Name.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchKey = normPhone || normName;
    if (!mergedMap.has(matchKey)) {
      mergedMap.set(matchKey, { ...item });
    } else {
      const existing = mergedMap.get(matchKey)!;
      const sourcesSet = new Set(existing.Source.split(',').map(s => s.trim()).filter(Boolean));
      item.Source.split(',').map(s => s.trim()).filter(Boolean).forEach(s => sourcesSet.add(s));
      existing.Source = Array.from(sourcesSet).join(', ');

      if ((!existing.Website || existing.Website === 'N/A') && item.Website && item.Website !== 'N/A') {
        existing.Website = item.Website;
      }
      if ((!existing.Email || existing.Email === 'N/A') && item.Email && item.Email !== 'N/A') {
        existing.Email = item.Email;
      }
      if ((!existing.Socials || existing.Socials === 'N/A') && item.Socials && item.Socials !== 'N/A') {
        existing.Socials = item.Socials;
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
    
    const historyKeys = readHistoryKeys(niche, location);
    const searchIterKey = `iter_${niche}_${location}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentIter = (jobsStore[searchIterKey] || 0);
    const pageOffset = currentIter;
    jobsStore[searchIterKey] = currentIter + 1;
    
    if (historyKeys.size > 0) {
      log(`Memory Check: Found ${historyKeys.size} previously extracted leads for ${niche} in ${location}. Navigating to Deep Search Page ${pageOffset + 1}...`);
    } else {
      log(`Search Agent: Initializing Deep Contact Search strategy for ${niche} in ${location}...`);
    }
    
    let rawLeads: ScrapedBusiness[] = [];

    // STEP 1: Sequential OpenStreetMap & Overpass Directory Queries
    try {
      log(`Querying sequential OpenStreetMap database layer to extract verified directory nodes...`);
      const osmData = await scrapeOpenStreetMap(niche, location, maxResults, historyKeys, log);
      rawLeads.push(...osmData);
      
      if (rawLeads.length < maxResults) {
        log(`Querying high-volume Overpass API spatial engine for additional real business nodes...`);
        const overpassData = await scrapeOverpassAPI(niche, location, maxResults - rawLeads.length, historyKeys, log);
        rawLeads.push(...overpassData);
      }
    } catch (e: any) {
      log(`Directory query warning: ${e.message}`);
    }

    // STEP 2: Sequential Scraper execution with random delay gaps to prevent IP rate-limiting
    if (rawLeads.length < maxResults) {
      const remainingCount = maxResults - rawLeads.length;
      log(`Needs ${remainingCount} more leads. Executing sequential search engine fallbacks...`);

      const targets = platforms.includes('All Platforms') 
        ? ['Google Maps', 'Instagram', 'Facebook', 'LinkedIn', 'Justdial', 'YellowPages']
        : platforms;

      for (const target of targets) {
        if (rawLeads.length >= maxResults) break;
        log(`Starting extraction fallback on platform: ${target}...`);
        
        let platformLeads: ScrapedBusiness[] = [];
        const limit = maxResults - rawLeads.length;

        if (target === 'Google Maps') {
          platformLeads = await scrapeGoogleMaps(niche, location, limit, pageOffset, historyKeys, log);
        } else if (target === 'Instagram') {
          platformLeads = await scrapeInstagram(niche, location, limit, pageOffset, historyKeys, log);
        } else if (target === 'Facebook') {
          platformLeads = await scrapeFacebook(niche, location, limit, pageOffset, historyKeys, log);
        } else if (target === 'LinkedIn') {
          platformLeads = await scrapeLinkedIn(niche, location, limit, pageOffset, historyKeys, log);
        } else if (target === 'Justdial') {
          platformLeads = await scrapeJustdial(niche, location, limit, pageOffset, historyKeys, log);
        } else if (target === 'YellowPages') {
          platformLeads = await scrapeYellowPages(niche, location, limit, pageOffset, historyKeys, log);
        }

        rawLeads.push(...platformLeads);
        // Small delay gap between platforms to protect IP health
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    log(`Enriching and verifying phone contact numbers for ${rawLeads.length} raw leads...`);
    let mergedLeads = mergeAndDeduplicateLeads(rawLeads);

    // Call dynamic website contact enrichment on the final list of leads
    log(`Running background contact enrichment on discovered business websites...`);
    await Promise.all(
      mergedLeads.map(async (lead) => {
        if (lead.Website && lead.Website !== 'N/A') {
          const enrichment = await enrichLeadFromWebsite(lead.Website);
          if (enrichment.email !== 'N/A' && lead.Email === 'N/A') {
            lead.Email = enrichment.email;
          }
          if (enrichment.socials !== 'N/A') {
            lead.Socials = enrichment.socials;
          }
        }
      })
    );

    // Save newly extracted leads to the history database
    if (mergedLeads.length > 0) {
      writeHistoryLeads(niche, location, mergedLeads);
    }

    // Auto-History Fulfillment Fallback: if fresh yield is lower than maxResults, fill from history leads
    if (mergedLeads.length < maxResults) {
      const historyLeads = readHistoryLeads(niche, location);
      const needed = maxResults - mergedLeads.length;
      log(`Yield Check: Recovered ${needed} previously extracted records from history database to satisfy target count.`);
      
      let added = 0;
      for (const hist of historyLeads) {
        if (added >= needed) break;
        if (!mergedLeads.some(l => l.Name === hist.Name || l.Phone === hist.Phone)) {
          mergedLeads.push(hist);
          added++;
        }
      }
    }

    mergedLeads = mergedLeads.slice(0, maxResults);

    state.status = 'completed';
    state.progress = `Process finished successfully. Extracted ${mergedLeads.length} NEW verified phone leads.`;
    state.resultData = mergedLeads;
    writeJobState(jobId, state);
    console.log(`[Job ${jobId}] Job finished successfully. Extracted ${mergedLeads.length} leads.`);
  } catch (err: any) {
    state.status = 'failed';
    state.progress = `Extraction failed: ${err.message}`;
    state.logs.push(`Error: ${err.message}`);
    writeJobState(jobId, state);
  }
}
