const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('gm-main.html', 'utf8');
const $ = cheerio.load(html);

// Find feed cards
$('div.Nv2PK').each((i, el) => {
  console.log('---CARD ' + i + '---');
  
  const lines = $(el).find('div.W4Efsd').map((_, div) => $(div).text()).get();
  
  const website = $(el).find('a').filter((_, a) => {
    const h = $(a).attr('href');
    return h && h.startsWith('http') && !h.includes('google.com');
  }).attr('href') || null;
  
  const name = $(el).find('div.qBF1Pd, div.fontHeadlineSmall').text();
  
  let address = null;
  let category = null;
  if (lines.length > 2) {
    const parts = lines[2].split('·').map(s => s.trim());
    category = parts[0];
    address = parts.slice(1).filter(s => s.length > 1).join(', ');
  }

  const phoneMatch = lines.join(' ').match(/(?:\+?91[-.\s]?)?0?\d{3,5}[-.\s]?\d{5,8}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  let rating = null;
  let reviewCount = null;
  const ratingAria = $(el).find('span[aria-label*="stars"]').attr('aria-label');
  if (ratingAria) {
    const rMatch = ratingAria.match(/([\d\.]+)\s*stars/);
    if (rMatch) rating = parseFloat(rMatch[1]);
    const revMatch = ratingAria.match(/([\d\,]+)\s*Reviews/);
    if (revMatch) reviewCount = parseInt(revMatch[1].replace(/,/g, ''));
  }

  console.log({ name, category, address, phone, website, rating, reviewCount });
});
