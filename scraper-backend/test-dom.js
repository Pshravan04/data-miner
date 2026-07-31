const { chromium } = require('playwright');
const cheerio = require('cheerio');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Example URL from the screenshot "RK Mumbai Realtors"
  await page.goto('https://www.google.com/maps/place/RK+Mumbai+Realtors/@19.458989,72.4976643,10z/data=!4m10!1m2!2m1!1sreal+estate+mumbai!3m6!1s0x3be7c9b0e77d4c89:0x85fc0634ee3c22b9!8m2!3d19.0834393!4d72.8396362!15sChJyZWFsIGVzdGF0ZSBtdW1iYWlaFCIScmVhbCBlc3RhdGUgbXVtYmFpkgEUcmVhbF9lc3RhdGVfYWdlbmN5mgEjQ2haRFNVaE5NRzluUzBWSlEwRm5TVVN0Ym5oWFVIUjNFQUXgAQA!16s%2Fg%2F11b6m6qll7?entry=ttu', { waitUntil: 'domcontentloaded' });
  
  await page.waitForSelector('h1', { timeout: 10000 });
  const html = await page.$eval('div[role="main"]', el => el.innerHTML);
  require('fs').writeFileSync('gm-main.html', html);
  console.log('Saved to gm-main.html');
  await browser.close();
})();
