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
    'All Platforms', 'Google Maps', 'Instagram', 'Facebook', 'LinkedIn', 'Justdial', 'YellowPages'
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
    <div className="min-h-screen text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Retro Pixel Light Header */}
        <header className="bg-white border-3 border-black p-6 shadow-[5px_5px_0px_#EA580C] flex flex-col md:flex-row items-center justify-between gap-6 relative">
          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 bg-[#EA580C] border-3 border-black flex items-center justify-center shadow-[3px_3px_0px_#FBBF24] shrink-0">
              <Zap className="w-8 h-8 text-[#FBBF24] fill-[#FBBF24]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-pixel text-xl sm:text-2xl md:text-3xl text-[#D97706] tracking-wider drop-shadow-[2px_2px_0px_#000000]">
                  DATA MINER
                </h1>
                <span className="text-[#EA580C] font-pixel text-xs animate-pulse">v2.0</span>
              </div>
              <p className="font-silkscreen text-xs sm:text-sm text-gray-700 mt-1">
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
          
          {/* Pixel Control Panel Light */}
          <div className="lg:col-span-1 space-y-6">
            <form onSubmit={startJob} className="bg-white border-3 border-black p-6 shadow-[5px_5px_0px_#F59E0B] space-y-6">
              
              <div className="flex items-center gap-2 border-b-2 border-dashed border-[#EA580C]/40 pb-3">
                <Database className="w-5 h-5 text-[#EA580C]" />
                <h2 className="font-silkscreen text-base font-bold text-[#D97706]">TARGET CONTROLS</h2>
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-gray-800 mb-2 uppercase">
                  Target Niche / Business Type
                </label>
                <input 
                  type="text"
                  required
                  list="niche-options"
                  placeholder="e.g. Real Estate, Dentists..."
                  className="w-full px-4 py-2.5 bg-[#FFFDF5] border-2 border-black text-gray-900 placeholder-gray-400 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none text-sm font-medium"
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
                <label className="block font-silkscreen text-xs text-gray-800 mb-2 uppercase">
                  Target Location
                </label>
                <input 
                  type="text"
                  required
                  list="location-options"
                  placeholder="e.g. Mumbai, New York, London..."
                  className="w-full px-4 py-2.5 bg-[#FFFDF5] border-2 border-black text-gray-900 placeholder-gray-400 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none text-sm font-medium"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={status === 'processing'}
                />
                <datalist id="location-options">
                  <option value="Mumbai, Maharashtra" />
                  <option value="Delhi NCR" />
                  <option value="Bangalore, Karnataka" />
                  <option value="Hyderabad, Telangana" />
                  <option value="Ahmedabad, Gujarat" />
                  <option value="Chennai, Tamil Nadu" />
                  <option value="Kolkata, West Bengal" />
                  <option value="Pune, Maharashtra" />
                  <option value="Jaipur, Rajasthan" />
                  <option value="Surat, Gujarat" />
                  <option value="Lucknow, Uttar Pradesh" />
                  <option value="Kanpur, Uttar Pradesh" />
                  <option value="Nagpur, Maharashtra" />
                  <option value="Indore, Madhya Pradesh" />
                  <option value="Thane, Maharashtra" />
                  <option value="Bhopal, Madhya Pradesh" />
                  <option value="Visakhapatnam, Andhra Pradesh" />
                  <option value="Vadodara, Gujarat" />
                  <option value="Ghaziabad, Uttar Pradesh" />
                  <option value="Ludhiana, Punjab" />
                  <option value="Agra, Uttar Pradesh" />
                  <option value="Nashik, Maharashtra" />
                  <option value="Faridabad, Haryana" />
                  <option value="Meerut, Uttar Pradesh" />
                  <option value="Rajkot, Gujarat" />
                  <option value="Varanasi, Uttar Pradesh" />
                  <option value="Navi Mumbai, Maharashtra" />
                  <option value="Amritsar, Punjab" />
                  <option value="Allahabad, Uttar Pradesh" />
                  <option value="Ranchi, Jharkhand" />
                  <option value="Coimbatore, Tamil Nadu" />
                  <option value="Jabalpur, Madhya Pradesh" />
                  <option value="Gwalior, Madhya Pradesh" />
                  <option value="Vijayawada, Andhra Pradesh" />
                  <option value="Jodhpur, Rajasthan" />
                  <option value="Madurai, Tamil Nadu" />
                  <option value="Raipur, Chhattisgarh" />
                  <option value="Kota, Rajasthan" />
                  <option value="Guwahati, Assam" />
                  <option value="Chandigarh" />
                </datalist>
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-gray-800 mb-2 uppercase">
                  Max Results Count
                </label>
                <input 
                  type="number"
                  min="10"
                  max="10000"
                  className="w-full px-4 py-2.5 bg-[#FFFDF5] border-2 border-black text-gray-900 focus:border-[#EA580C] outline-none text-sm font-medium"
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                  disabled={status === 'processing'}
                />
              </div>

              <div>
                <label className="block font-silkscreen text-xs text-gray-800 mb-2 uppercase">
                  Select Target Platforms
                </label>
                <p className="text-xs text-gray-500 mb-3 font-silkscreen">Select directories to mine:</p>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map(p => (
                    <button
                      key={p}
                      type="button"
                      disabled={status === 'processing'}
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 text-xs font-silkscreen border-2 border-black transition-all ${
                        selectedPlatforms.includes(p) 
                        ? 'bg-[#FBBF24] text-black shadow-[2px_2px_0px_#EA580C] font-bold' 
                        : 'bg-[#FFFDF5] text-gray-700 border-gray-300 hover:border-[#EA580C]'
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

          {/* Arcade Monitoring & Results Panel Light */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Retro Arcade Terminal Screen */}
            <div className="bg-[#18181B] border-3 border-black shadow-[5px_5px_0px_#EA580C] flex flex-col h-80 relative overflow-hidden">
              <div className="bg-[#27272A] border-b-2 border-black px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#FBBF24]">
                  <TerminalSquare className="w-4 h-4 text-[#F97316]" />
                  <span className="font-silkscreen text-xs font-bold text-[#FBBF24]">AGENT_ACTIVITY.LOG [CRT MODE]</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 bg-red-500 border border-black"></div>
                  <div className="w-3 h-3 bg-yellow-500 border border-black"></div>
                  <div className="w-3 h-3 bg-green-500 border border-black"></div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-2 font-arcade text-lg">
                {logs.length === 0 ? (
                  <p className="text-gray-400">[SYSTEM READY] Enter Niche and Location, then click START EXTRACTION...</p>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className="text-[#FBBF24] tracking-wide flex items-start gap-2">
                      <span className="text-[#F97316] select-none">&gt;&gt;</span>
                      <span>{l}</span>
                    </div>
                  ))
                )}
                {status === 'processing' && (
                  <div className="text-[#F97316] animate-pulse mt-2 flex items-center gap-1 font-pixel text-xs">
                    <span>MINING DATA</span>
                    <span className="inline-block w-2 h-4 bg-[#FBBF24]"></span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Action Banner */}
            {status === 'completed' && (
              <div className="bg-white border-3 border-black p-6 shadow-[5px_5px_0px_#10B981] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-silkscreen font-bold text-emerald-800 text-lg">EXTRACTION COMPLETE!</h3>
                    <p className="font-sans text-xs text-emerald-700 mt-0.5">
                      Successfully extracted and enriched <span className="font-bold text-emerald-900">{resultData?.length || 0}</span> lead profiles.
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
              <div className="bg-red-50 border-3 border-black p-6 shadow-[5px_5px_0px_#EF4444] flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />
                <div>
                  <h3 className="font-silkscreen font-bold text-red-800">EXTRACTION FAILED</h3>
                  <p className="font-sans text-xs text-red-700">{progress}</p>
                </div>
              </div>
            )}

            {/* Extracted Leads Data Grid Table Light */}
            {resultData && resultData.length > 0 && (
              <div className="bg-white border-3 border-black p-6 shadow-[5px_5px_0px_#F59E0B] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-dashed border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#EA580C]" />
                    <h3 className="font-silkscreen font-bold text-gray-900 text-sm">
                      EXTRACTED LEADS GRID ({resultData.length})
                    </h3>
                  </div>
                  <span className="pixel-badge-yellow text-[10px] px-2.5 py-1">
                    VERIFIED
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-800">
                    <thead className="bg-[#FEF3C7] border-b-2 border-black text-gray-900 font-silkscreen text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Business Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Website</th>
                        <th className="px-4 py-3">Rating</th>
                        <th className="px-4 py-3">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {resultData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#FFFBEB] transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900 max-w-[200px] truncate">{item.Name}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-gray-800 font-mono">
                              <Phone className="w-3.5 h-3.5 text-[#EA580C]" />
                              {item.Phone || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[160px] truncate">
                            {item.Website && item.Website !== 'N/A' ? (
                              <a href={item.Website} target="_blank" rel="noreferrer" className="text-[#EA580C] font-semibold hover:underline flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                                {item.Website.replace(/^https?:\/\//, '')}
                              </a>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1 text-[#D97706] font-bold font-mono">
                              <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#D97706]" />
                              {item.Ratings || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="inline-block bg-[#FEF3C7] text-gray-900 font-silkscreen text-[10px] px-2 py-1 border border-black">
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

        {/* Pixel Footer Credit */}
        <footer className="mt-12 pt-6 border-t-2 border-dashed border-gray-300 text-center font-silkscreen text-xs text-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#EA580C] inline-block border border-black"></span>
            <span>DATA MINER B2B ENGINE v2.0</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border-2 border-black px-4 py-2 shadow-[3px_3px_0px_#F59E0B]">
            <span>CRAFTED WITH ⚡ BY</span>
            <a 
              href="https://shravan-phutane-portfolio.netlify.app/" 
              target="_blank" 
              rel="noreferrer"
              className="text-[#EA580C] font-bold underline hover:text-[#D97706] transition-colors ml-1"
            >
              SHRAVAN PHUTANE
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
