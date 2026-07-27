from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
from agents import ScraperCrew
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Multi-Agent Data Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store job statuses in memory (for production use Redis/DB)
jobs = {}

class JobRequest(BaseModel):
    niche: str
    location: str
    platforms: List[str]
    max_results: int = 50

class JobResponse(BaseModel):
    job_id: str
    status: str

@app.post("/api/jobs", response_model=JobResponse)
async def start_job(request: JobRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "progress": "Initializing agents...",
        "result_file": None,
        "logs": []
    }
    
    background_tasks.add_task(run_scraper_crew, job_id, request)
    
    return JobResponse(job_id=job_id, status="processing")

def run_scraper_crew(job_id: str, request: JobRequest):
    try:
        crew = ScraperCrew(job_id=job_id, request=request, jobs_store=jobs)
        result = crew.run()
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = "Job completed successfully."
        jobs[job_id]["result_file"] = result
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["progress"] = f"Error: {str(e)}"

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        return {"error": "Job not found"}
    return jobs[job_id]
