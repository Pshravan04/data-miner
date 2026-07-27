'use client';

import React, { useState, useEffect } from 'react';
import { Download, Play, CheckCircle2, AlertCircle, TerminalSquare } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Home() {
  // Form State
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  
  // Platform selection (Supporting 20-30 platforms eventually)
  const availablePlatforms = [
    'Google Maps', 'Apollo', 'Yelp', 'Zillow', 'LinkedIn', 'YellowPages', 'TripAdvisor'
  ];
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Google Maps', 'Apollo']);

  // Job State
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [resultData, setResultData] = useState<any[] | null>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const startJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) return alert("Select at least one platform");
    
    setStatus('processing');
    setLogs([]);
    setProgress('Starting job...');
    setResultData(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location, platforms: selectedPlatforms, maxResults })
      });
      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
      }
    } catch (err) {
      console.error(err);
      setStatus('failed');
      setProgress('Failed to start job.');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobId && status === 'processing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs?jobId=${jobId}`);
          const data = await res.json();
          if (data.status) {
            setStatus(data.status);
            setProgress(data.progress || '');
            setLogs(data.logs || []);
            if (data.resultData) {
              setResultData(data.resultData);
            }
          }
        } catch (err) {
          console.error("Error fetching job status", err);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const downloadExcel = () => {
    if (!resultData) return;
    const worksheet = XLSX.utils.json_to_sheet(resultData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `Leads_${niche}_${location}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Multi-Agent Lead Scraper</h1>
            <p className="text-gray-500 mt-2">Extract enriched data from 20+ platforms simultaneously using AI agents.</p>
          </div>
          <div className="hidden md:flex gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">Bypass Anti-Bot</span>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">AI Enriched</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            <form onSubmit={startJob} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              
              <div>
                <label className="block text-sm font-semibold mb-2">Target Niche / Business Type</label>
                <input 
                  type="text"
                  required
                  list="niche-options"
                  placeholder="Type to search or enter custom..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  disabled={status === 'processing'}
                />
                <datalist id="niche-options">
                  <option value="Interior Designers" />
                  <option value="Architects" />
                  <option value="Real Estate Agents" />
                  <option value="Property Managers" />
                  <option value="Construction Companies" />
                  <option value="Software Development" />
                  <option value="Marketing Agencies" />
                  <option value="SEO Agencies" />
                  <option value="Law Firms" />
                  <option value="Accounting Firms" />
                  <option value="Financial Advisors" />
                  <option value="Dentists" />
                  <option value="Chiropractors" />
                  <option value="Plumbers" />
                  <option value="Electricians" />
                  <option value="Roofing Contractors" />
                  <option value="Landscaping Services" />
                  <option value="HVAC Services" />
                  <option value="Restaurants" />
                  <option value="Coffee Shops" />
                  <option value="Hotels" />
                  <option value="Logistics Companies" />
                  <option value="Manufacturing" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Location</label>
                <input 
                  type="text"
                  required
                  list="location-options"
                  placeholder="Type to search or enter custom..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={status === 'processing'}
                />
                <datalist id="location-options">
                  <option value="Global (Worldwide)" />
                  <option value="North America" />
                  <option value="Europe" />
                  <option value="Asia" />
                  <option value="South America" />
                  <option value="Oceania" />
                  <option value="New York, NY" />
                  <option value="Los Angeles, CA" />
                  <option value="Chicago, IL" />
                  <option value="Houston, TX" />
                  <option value="Austin, TX" />
                  <option value="Miami, FL" />
                  <option value="San Francisco, CA" />
                  <option value="Seattle, WA" />
                  <option value="Denver, CO" />
                  <option value="Boston, MA" />
                  <option value="Toronto, ON" />
                  <option value="Vancouver, BC" />
                  <option value="London, UK" />
                  <option value="Manchester, UK" />
                  <option value="Berlin, Germany" />
                  <option value="Munich, Germany" />
                  <option value="Paris, France" />
                  <option value="Madrid, Spain" />
                  <option value="Barcelona, Spain" />
                  <option value="Rome, Italy" />
                  <option value="Amsterdam, Netherlands" />
                  <option value="Dubai, UAE" />
                  <option value="Riyadh, Saudi Arabia" />
                  <option value="Mumbai, India" />
                  <option value="Delhi, India" />
                  <option value="Bangalore, India" />
                  <option value="Singapore" />
                  <option value="Tokyo, Japan" />
                  <option value="Seoul, South Korea" />
                  <option value="Hong Kong" />
                  <option value="Sydney, Australia" />
                  <option value="Melbourne, Australia" />
                  <option value="Auckland, New Zealand" />
                  <option value="Cape Town, South Africa" />
                  <option value="Sao Paulo, Brazil" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Max Results</label>
                <input 
                  type="number"
                  min="10"
                  max="10000"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                  disabled={status === 'processing'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Select Target Platforms</label>
                <p className="text-xs text-gray-500 mb-3">Agents will navigate these sources to merge contact profiles.</p>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map(p => (
                    <button
                      key={p}
                      type="button"
                      disabled={status === 'processing'}
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                        selectedPlatforms.includes(p) 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'processing'}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <span className="animate-pulse">Agents Working...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Extraction
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Monitoring & Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Terminal */}
            <div className="bg-gray-900 rounded-2xl p-6 shadow-sm flex flex-col h-80">
              <div className="flex items-center gap-2 text-gray-400 mb-4 border-b border-gray-800 pb-4">
                <TerminalSquare className="w-5 h-5" />
                <h3 className="font-semibold tracking-wide uppercase text-sm">Agent Activity Log</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-gray-600">Waiting for job to start...</p>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className="text-green-400">
                      <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {l}
                    </div>
                  ))
                )}
                {status === 'processing' && (
                  <div className="text-blue-400 animate-pulse mt-2">_</div>
                )}
              </div>
            </div>

            {/* Results Actions */}
            {status === 'completed' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 text-green-700">
                  <CheckCircle2 className="w-8 h-8" />
                  <div>
                    <h3 className="font-bold text-lg">Extraction Complete!</h3>
                    <p className="text-sm opacity-80">Successfully extracted and enriched {resultData?.length} leads.</p>
                  </div>
                </div>
                <button
                  onClick={downloadExcel}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all shrink-0"
                >
                  <Download className="w-5 h-5" />
                  Download Excel
                </button>
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 text-red-700 rounded-2xl p-6 shadow-sm border border-red-100 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold">Extraction Failed</h3>
                  <p className="text-sm">{progress}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
