import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ locale: 'en-US', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  const page = await context.newPage();
  
  const href = 'https://www.google.com/maps/place/ICED+infotech/data=!4m7!3m6!1s0x3be04c2e4581eb45:0x40bce4cf2bf9ec0b!8m2!3d21.1877142!4d72.813481!16s%2Fg%2F1tf_ls1j!19sChIJReuBRS5M4DsRC-z5K8_kvEA?authuser=0&hl=en&rclk=1';
  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const h1 = await page.locator('h1').innerText().catch(() => 'no h1');
  console.log('h1:', h1);

  const infoButtons = await page.$$('button[data-item-id]');
  console.log('buttons found:', infoButtons.length);
  for (const btn of infoButtons) {
    console.log(await btn.innerText());
  }
  
  await browser.close();
})();
