import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ScrapedBusiness, scrapeGoogleMaps, enrichLeadFromWebsite } from './scraper';

// ──────────────────────────────────────────────
// Job State Management (file-based for Vercel)
// ──────────────────────────────────────────────

function getJobFilePath(jobId: string) {
  return path.join(os.tmpdir(), `data_miner_job_${jobId}.json`);
}

function writeJobState(jobId: string, state: any) {
  try { fs.writeFileSync(getJobFilePath(jobId), JSON.stringify(state), 'utf-8'); } catch (e) {}
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

// ──────────────────────────────────────────────
// POST /api/jobs — Start a new extraction job
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const niche = (body.niche && String(body.niche).trim()).replace(/<[^>]*>?/g, '').substring(0, 100) || 'Businesses';
    const location = (body.location && String(body.location).trim()).replace(/<[^>]*>?/g, '').substring(0, 100) || 'India';
    const rawMax = typeof body.maxResults === 'number' && body.maxResults > 0 ? body.maxResults : 50;
    const maxResults = Math.min(Math.max(1, rawMax), 200);

    const jobId = Math.random().toString(36).substring(2, 15);
    
    const initialState = {
      id: jobId,
      status: 'processing',
      progress: 'Initializing Google Maps search...',
      logs: ['Job initialized.'],
      resultData: null
    };
    writeJobState(jobId, initialState);

    // On Vercel: run synchronously (serverless functions must return before timeout)
    // Locally: run in background
    if (process.env.VERCEL) {
      await runExtraction(jobId, niche, location, maxResults);
      const completedState = readJobState(jobId);
      return NextResponse.json({ 
        jobId, 
        status: completedState?.status || 'completed', 
        progress: completedState?.progress || 'Done.',
        logs: completedState?.logs || [],
        resultData: completedState?.resultData || [] 
      });
    } else {
      runExtraction(jobId, niche, location, maxResults);
      return NextResponse.json({ jobId, status: 'processing', progress: 'Job started.' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// GET /api/jobs?jobId=xxx — Poll job status
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Deduplication — by normalized business name
// ──────────────────────────────────────────────

function deduplicateLeads(leads: ScrapedBusiness[]): ScrapedBusiness[] {
  const seen = new Map<string, ScrapedBusiness>();
  const seenPhones = new Set<string>();

  for (const lead of leads) {
    if (!lead.Name) continue;
    const normName = lead.Name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normName) continue;

    // Skip if phone already seen (prevent different-name same-phone dupes)
    const normPhone = (lead.Phone && lead.Phone !== 'N/A') ? lead.Phone.replace(/[^0-9]/g, '') : '';
    if (normPhone && seenPhones.has(normPhone)) continue;

    if (!seen.has(normName)) {
      seen.set(normName, { ...lead });
      if (normPhone) seenPhones.add(normPhone);
    }
  }

  return Array.from(seen.values());
}

// ──────────────────────────────────────────────
// Core Extraction Pipeline
// ──────────────────────────────────────────────

async function runExtraction(jobId: string, niche: string, location: string, maxResults: number) {
  const state = readJobState(jobId) || { id: jobId, logs: [], progress: '' };
  
  const log = (msg: string) => {
    state.logs.push(msg);
    state.progress = msg;
    writeJobState(jobId, state);
    console.log(`[Job ${jobId}] ${msg}`);
  };

  try {
    // STEP 1: Google Maps Search via Serper.dev
    log(`🚀 Starting Google Maps extraction for "${niche}" in "${location}" (max: ${maxResults})...`);
    
    const rawLeads = await scrapeGoogleMaps(niche, location, maxResults, log);
    log(`📊 Raw leads from Google Maps: ${rawLeads.length}`);

    // STEP 2: Deduplicate
    let leads = deduplicateLeads(rawLeads);
    log(`🔄 After deduplication: ${leads.length} unique leads`);

    // STEP 3: Enrich leads from their websites (email, phone, socials)
    if (leads.length > 0) {
      log(`🌐 Enriching ${leads.length} leads from business websites...`);
      
      // Process in batches of 5 to avoid overwhelming servers
      const batchSize = 5;
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (lead) => {
            if (lead.Website && lead.Website !== 'N/A' && !lead.Website.includes('google.com/maps')) {
              try {
                const enrichment = await enrichLeadFromWebsite(lead.Website);
                if (enrichment.email !== 'N/A' && lead.Email === 'N/A') {
                  lead.Email = enrichment.email;
                }
                if (enrichment.phone !== 'N/A' && lead.Phone === 'N/A') {
                  lead.Phone = enrichment.phone;
                }
                if (enrichment.socials !== 'N/A') {
                  lead.Socials = enrichment.socials;
                }
              } catch (e) {}
            }
          })
        );
        
        if (i + batchSize < leads.length) {
          log(`🌐 Enriched ${Math.min(i + batchSize, leads.length)}/${leads.length} leads...`);
        }
      }
    }

    // STEP 4: Final slice and return
    leads = leads.slice(0, maxResults);

    state.status = 'completed';
    state.progress = `✅ Extraction complete! Found ${leads.length} leads.`;
    state.resultData = leads;
    writeJobState(jobId, state);
    log(`✅ Job finished. Extracted ${leads.length} leads.`);

  } catch (err: any) {
    state.status = 'failed';
    state.progress = `❌ Extraction failed: ${err.message}`;
    state.logs.push(`Error: ${err.message}`);
    writeJobState(jobId, state);
  }
}
