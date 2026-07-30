import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ──────────────────────────────────────────────
// POST /api/jobs — Start a new extraction job
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const niche = body.niche || 'Businesses';
    const location = body.location || 'India';
    const maxResults = body.maxResults || 50;
    
    const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:4000';

    const res = await fetch(`${scraperUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, location, maxResults })
    });

    if (!res.ok) {
      throw new Error(`Scraper backend returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
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

  const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:4000';

  try {
    const res = await fetch(`${scraperUrl}/api/jobs?jobId=${jobId}`);
    if (!res.ok) {
      throw new Error(`Scraper backend returned ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

