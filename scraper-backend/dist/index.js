"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const scraper_1 = require("./scraper");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const jobsStore = {};
app.post('/api/jobs', (req, res) => {
    const { niche, location, maxResults } = req.body;
    if (!niche || !location) {
        return res.status(400).json({ error: 'Missing niche or location' });
    }
    const limit = Math.min(Math.max(1, maxResults || 50), 200);
    const jobId = Math.random().toString(36).substring(2, 15);
    jobsStore[jobId] = {
        id: jobId,
        status: 'processing',
        progress: 'Job initialized.',
        logs: ['Job initialized in scraper backend.'],
        resultData: null
    };
    // Run async job
    runExtraction(jobId, niche, location, limit);
    res.json({ jobId, status: 'processing', progress: 'Job started.' });
});
app.get('/api/jobs', (req, res) => {
    const jobId = req.query.jobId;
    if (!jobId)
        return res.status(400).json({ error: 'Missing jobId' });
    const state = jobsStore[jobId];
    if (!state)
        return res.status(404).json({ error: 'Job not found' });
    res.json(state);
});
async function runExtraction(jobId, niche, location, limit) {
    const state = jobsStore[jobId];
    const logCallback = (msg) => {
        state.logs.push(msg);
        state.progress = msg;
        console.log(`[Job ${jobId}] ${msg}`);
    };
    try {
        const rawLeads = await (0, scraper_1.scrapeGoogleMaps)(niche, location, limit, logCallback);
        // Map to the frontend's expected capitalized schema
        const leads = rawLeads.map(lead => ({
            Name: lead.name,
            Niche: niche,
            Location: location,
            Phone: lead.phone || 'N/A',
            Email: 'N/A', // We can add email scraping later if needed
            Website: lead.website || 'N/A',
            Ratings: lead.rating ? `${lead.rating} (${lead.reviewCount})` : 'N/A',
            Source: 'Google Maps Playwright',
            Socials: [lead.social.instagram, lead.social.facebook, lead.social.linkedin, lead.social.twitter].filter(Boolean).join(', ') || 'N/A'
        }));
        state.status = 'completed';
        state.progress = `Extraction complete. Found ${leads.length} leads.`;
        state.resultData = leads;
    }
    catch (err) {
        state.status = 'failed';
        state.progress = `Failed: ${err.message}`;
        state.logs.push(`Error: ${err.message}`);
    }
}
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Scraper backend running on port ${PORT}`);
});
