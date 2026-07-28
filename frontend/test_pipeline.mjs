import fs from 'fs';

async function run() {
  const req = {
    niche: "Plumbers",
    location: "Mumbai",
    platforms: ["All Platforms"],
    maxResults: 10
  };

  const res = await fetch('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });

  const data = await res.json();
  console.log("INITIAL JOB RES:", data);

  if (data.jobId) {
    let status = 'processing';
    while (status === 'processing') {
      const poll = await fetch(`http://localhost:3000/api/jobs?jobId=${data.jobId}`);
      const pollData = await poll.json();
      status = pollData.status;
      if (status === 'completed' || status === 'error') {
        console.log("FINAL STATUS:", pollData.status);
        console.log("LOGS:", pollData.logs.join('\n'));
        console.log("FINAL RESULTS COUNT:", pollData.resultData ? pollData.resultData.length : 0);
        fs.writeFileSync('output_results.json', JSON.stringify(pollData.resultData, null, 2));
        console.log("Wrote raw JSON to output_results.json");
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

run();
