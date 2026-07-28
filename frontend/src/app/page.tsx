'use client';

import React, { useState, useEffect } from 'react';
import { Download, Play, CheckCircle2, AlertCircle, TerminalSquare, Globe, Phone, Star, Layers, Zap, Cpu, Sparkles, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Home() {
  // Form State
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  
  // Platform selection
  const availablePlatforms = [
    'All Platforms', 'Google Maps', 'YellowPages', 'Yelp', 'TripAdvisor', 'Zillow', 'LinkedIn', 'Apollo'
  ];
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['All Platforms']);

  // Job State
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [resultData, setResultData] = useState<any[] | null>(null);

  const togglePlatform = (p: string) => {
    if (p === 'All Platforms') {
      setSelectedPlatforms(['All Platforms']);
      return;
    }

    setSelectedPlatforms(prev => {
      const filtered = prev.filter(x => x !== 'All Platforms');
      return filtered.includes(p) 
        ? filtered.filter(x => x !== p) 
        : [...filtered, p];
    });
  };

  const startJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) return alert("Select at least one platform");
    
    setStatus('processing');
    setLogs(['[SYSTEM] Initializing 8-bit scraper crew...']);
    setProgress('Starting job...');
    setResultData(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          niche: niche.trim() || 'Businesses', 
          location: location.trim() || 'Global', 
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['Google Maps'], 
          maxResults: maxResults || 50 
        })
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        if (data.status) setStatus(data.status);
        if (data.progress) setProgress(data.progress);
        if (data.logs) setLogs(data.logs);
        if (data.resultData && Array.isArray(data.resultData)) {
          setResultData(data.resultData);
        }
      } else {
        setStatus('failed');
        setProgress(data.error || 'Server error starting extraction job.');
      }
    } catch (err: any) {
      console.error('Job submission error:', err);
      setStatus('failed');
      setProgress(`Failed to start job: ${err.message || 'Network error'}`);
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
            if (data.resultData && Array.isArray(data.resultData)) {
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
    if (!resultData || resultData.length === 0) return alert("No lead data available to download.");
    
    const formattedData = resultData.map(item => ({
      'Business Name': item.Name || 'N/A',
      'Target Niche': item.Niche || niche || 'N/A',
      'Location': item.Location || location || 'N/A',
      'Phone Number': item.Phone || 'N/A',
      'Email Address': item.Email || 'N/A',
      'Website': item.Website || 'N/A',
      'Rating': item.Ratings || 'N/A',
      'Source Platforms': item.Source || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Enriched Leads");
    
    const cleanNiche = (niche || 'Leads').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanLoc = (location || 'Global').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `DATA_MINER_${cleanNiche}_${cleanLoc}.xlsx`);
  };

  return (
    <div className="min-h-screen text-gray-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Retro Pixel Arcade Header */}
        <header className="bg-[#181510] border-4 border-[#FFC700] rounded-none p-6 shadow-[6px_6px_0px_#000000] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 bg-[#FF5500] border-3 border-black flex items-center justify-center shadow-[3px_3px_0px_#FFC700] shrink-0">
              <Zap className="w-8 h-8 text-[#FFC700] fill-[#FFC700]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-pixel text-xl sm:text-2xl md:text-3xl text-[#FFC700] drop-shadow-[2px_2px_0px_#FF5500] tracking-wider">
                  DATA MINER
                </h1>
                <span className="text-[#FF5500] font-pixel text-xs animate-pulse">v2.0</span>
              </div>
              <p className="font-silkscreen text-xs sm:text-sm text-yellow-500/90 mt-1">
                Multi-Platform 8-Bit B2B Lead Extraction Engine
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 z-10">
            <span className="pixel-badge-yellow text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-black" />
              STEALTH BOT
            </span>
            <span className="pixel-badge-orange text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              AI ENRICHED
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Pixel Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <form onSubmit={startJob} className="bg-[#181510] border-3 border-[#FF5500] p-6 shadow-[6px_6px_0px_#000000] space-y-6">
              
              <div className="flex items-center gap-2 border-b-2 border-dashed border-[#FF5500]/40 pb-3">
                <Database className="w-5 h-5 text-[#FFC700]" />
                <h2 className="font-silkscreen text-base font-bold text-[#FFC700]">TARGET CONTROLS</h2>
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-[#FFC700] mb-2 uppercase">
                  Target Niche / Business Type
                </label>
                <input 
                  type="text"
                  required
                  list="niche-options"
                  placeholder="e.g. Real Estate, Dentists..."
                  className="w-full px-4 py-2.5 bg-[#0D0C0A] border-2 border-[#FF5500] text-yellow-300 placeholder-yellow-700/60 focus:border-[#FFC700] focus:ring-1 focus:ring-[#FFC700] outline-none text-sm font-medium"
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
                <label className="block font-silkscreen text-xs text-[#FFC700] mb-2 uppercase">
                  Target Location
                </label>
                <input 
                  type="text"
                  required
                  list="location-options"
                  placeholder="e.g. Mumbai, New York, London..."
                  className="w-full px-4 py-2.5 bg-[#0D0C0A] border-2 border-[#FF5500] text-yellow-300 placeholder-yellow-700/60 focus:border-[#FFC700] focus:ring-1 focus:ring-[#FFC700] outline-none text-sm font-medium"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={status === 'processing'}
                />
                <datalist id="location-options">
                  <option value="Global (Worldwide)" />
                  <option value="North America" />
                  <option value="Europe" />
                  <option value="Asia" />
                  <option value="Mumbai, India" />
                  <option value="Delhi, India" />
                  <option value="Bangalore, India" />
                  <option value="New York, NY" />
                  <option value="Los Angeles, CA" />
                  <option value="Chicago, IL" />
                  <option value="Houston, TX" />
                  <option value="Austin, TX" />
                  <option value="Miami, FL" />
                  <option value="San Francisco, CA" />
                  <option value="London, UK" />
                  <option value="Berlin, Germany" />
                  <option value="Paris, France" />
                  <option value="Dubai, UAE" />
                  <option value="Singapore" />
                  <option value="Tokyo, Japan" />
                  <option value="Sydney, Australia" />
                </datalist>
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-[#FFC700] mb-2 uppercase">
                  Max Results Count
                </label>
                <input 
                  type="number"
                  min="10"
                  max="10000"
                  className="w-full px-4 py-2.5 bg-[#0D0C0A] border-2 border-[#FF5500] text-yellow-300 focus:border-[#FFC700] outline-none text-sm font-medium"
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                  disabled={status === 'processing'}
                />
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-[#FFC700] mb-2 uppercase">
                  Select Target Platforms
                </label>
                <p className="text-xs text-yellow-500/70 mb-3 font-silkscreen">Select directories to mine:</p>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map(p => (
                    <button
                      key={p}
                      type="button"
                      disabled={status === 'processing'}
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 text-xs font-silkscreen border-2 border-black transition-all ${
                        selectedPlatforms.includes(p) 
                        ? 'bg-[#FFC700] text-black shadow-[2px_2px_0px_#FF5500] font-bold' 
                        : 'bg-[#0D0C0A] text-yellow-500/80 border-[#FF5500]/50 hover:border-[#FFC700]'
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
                className="w-full py-3.5 pixel-button-yellow text-sm flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <Zap className="w-4 h-4 text-black animate-spin" /> BOTS MINING...
                  </span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" /> START EXTRACTION
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Arcade Monitoring & Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Retro Arcade CRT Terminal */}
            <div className="bg-[#0D0C0A] border-3 border-[#FF5500] shadow-[6px_6px_0px_#000000] flex flex-col h-80 relative overflow-hidden">
              <div className="bg-[#181510] border-b-2 border-[#FF5500] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#FFC700]">
                  <TerminalSquare className="w-4 h-4 text-[#FF5500]" />
                  <span className="font-silkscreen text-xs font-bold text-[#FFC700]">AGENT_ACTIVITY.LOG [CRT MODE]</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 bg-[#FF5500] border border-black"></div>
                  <div className="w-3 h-3 bg-[#FFC700] border border-black"></div>
                  <div className="w-3 h-3 bg-green-500 border border-black"></div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-2 font-arcade text-lg scanlines">
                {logs.length === 0 ? (
                  <p className="text-yellow-700/60">[SYSTEM READY] Enter Niche and Location, then click START EXTRACTION...</p>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className="text-[#FFC700] tracking-wide flex items-start gap-2">
                      <span className="text-[#FF5500] select-none">&gt;&gt;</span>
                      <span>{l}</span>
                    </div>
                  ))
                )}
                {status === 'processing' && (
                  <div className="text-[#FF5500] animate-pulse mt-2 flex items-center gap-1 font-pixel text-xs">
                    <span>MINING DATA</span>
                    <span className="inline-block w-2 h-4 bg-[#FFC700]"></span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Action Banner */}
            {status === 'completed' && (
              <div className="bg-[#181510] border-3 border-[#FFC700] p-6 shadow-[6px_6px_0px_#000000] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-[#FFC700] shrink-0" />
                  <div>
                    <h3 className="font-silkscreen font-bold text-[#FFC700] text-lg">EXTRACTION COMPLETE!</h3>
                    <p className="font-sans text-xs text-yellow-400/80 mt-0.5">
                      Successfully extracted and enriched <span className="font-bold text-[#FFC700]">{resultData?.length || 0}</span> lead profiles.
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadExcel}
                  className="px-6 py-3.5 pixel-button-orange text-xs flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD EXCEL (.XLSX)
                </button>
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-[#1D100C] border-3 border-red-500 p-6 shadow-[6px_6px_0px_#000000] flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <h3 className="font-silkscreen font-bold text-red-400">EXTRACTION FAILED</h3>
                  <p className="font-sans text-xs text-red-300">{progress}</p>
                </div>
              </div>
            )}

            {/* Extracted Leads Data Grid Table */}
            {resultData && resultData.length > 0 && (
              <div className="bg-[#181510] border-3 border-[#FFC700] p-6 shadow-[6px_6px_0px_#000000] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-dashed border-[#FFC700]/30 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#FF5500]" />
                    <h3 className="font-silkscreen font-bold text-[#FFC700] text-sm">
                      EXTRACTED LEADS GRID ({resultData.length})
                    </h3>
                  </div>
                  <span className="pixel-badge-yellow text-[10px] px-2 py-0.5">
                    VERIFIED
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-200">
                    <thead className="bg-[#0D0C0A] border-b-2 border-[#FF5500] text-[#FFC700] font-silkscreen text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Business Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Website</th>
                        <th className="px-4 py-3">Rating</th>
                        <th className="px-4 py-3">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-900/20 font-sans">
                      {resultData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#241E15] transition-colors">
                          <td className="px-4 py-3 font-semibold text-yellow-300 max-w-[200px] truncate">{item.Name}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-yellow-400/90 font-mono">
                              <Phone className="w-3.5 h-3.5 text-[#FF5500]" />
                              {item.Phone || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[160px] truncate">
                            {item.Website && item.Website !== 'N/A' ? (
                              <a href={item.Website} target="_blank" rel="noreferrer" className="text-[#FFC700] hover:underline flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                                {item.Website.replace(/^https?:\/\//, '')}
                              </a>
                            ) : (
                              <span className="text-yellow-700/60">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1 text-[#FFC700] font-bold font-mono">
                              <Star className="w-3.5 h-3.5 fill-[#FFC700] text-[#FFC700]" />
                              {item.Ratings || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="inline-block bg-[#0D0C0A] text-[#FFC700] font-silkscreen text-[10px] px-2 py-1 border border-[#FF5500]">
                              {item.Source || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
