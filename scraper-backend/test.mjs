fetch('http://localhost:4000/api/jobs', { 
  method: 'POST', 
  headers: {'Content-Type': 'application/json'}, 
  body: JSON.stringify({ niche: 'Interior Designers', location: 'Pune, Maharashtra', maxResults: 10 }) 
}).then(r => r.json()).then(res => {
  console.log('Job Started:', res);
  const interval = setInterval(async () => {
    const r = await fetch('http://localhost:4000/api/jobs?jobId=' + res.jobId);
    const data = await r.json();
    console.log(data.progress);
    if (data.status !== 'processing') {
      console.log('FINAL DATA:', JSON.stringify(data.resultData, null, 2));
      clearInterval(interval);
    }
  }, 2000);
});
