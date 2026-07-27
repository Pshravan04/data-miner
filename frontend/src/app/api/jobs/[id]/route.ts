import { NextResponse } from 'next/server';
import { jobsStore } from '../store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  if (!jobId || !jobsStore[jobId]) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(jobsStore[jobId]);
}
