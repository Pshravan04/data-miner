import * as cheerio from 'cheerio';


function extractIndianPhone(text) {
  if (!text) return 'N/A';
  
  const phoneRegex = /(?:\+?91[\s\.-]?)?(?:0)?([6-9]\d{4}[\s\.-]?\d{5}|[6-9]\d{9}|[6-9]\d{2}[\s\.-]?\d{3}[\s\.-]?\d{4})/g;
  const matches = text.match(phoneRegex);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      const digits = match.replace(/[^0-9]/g, '');
      const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
      if (tenDigits.length === 10 && /^[6-9]/.test(tenDigits)) {
        return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
      }
    }
  }
  return 'N/A';
}

async function testEnrich() {
  const query = `Random Business New York phone contact mobile number`;
  const url = `https://search.yahoo.com/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const text = $('body').text();
  const phone = extractIndianPhone(text);
  console.log("Yahoo phone:", phone);

  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const bRes = await fetch(bingUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html'
    }
  });
  const bHtml = await bRes.text();
  const b$ = cheerio.load(bHtml);
  const bText = b$('body').text();
  const bPhone = extractIndianPhone(bText);
  console.log("Bing phone:", bPhone);
}

testEnrich();
