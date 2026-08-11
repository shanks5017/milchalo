import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://erail.in/trains/belagavi-BGM/ksr-bengaluru-SBC', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const test = await page.evaluate(() => {
     const tds = document.querySelectorAll('td');
     for(let i=0; i<tds.length; i++){
        if (tds[i].getAttribute('onmouseover') && tds[i].getAttribute('onmouseover').includes('sTT')) {
           return tds[i].getAttribute('onmouseover');
        }
     }
     return 'No tooltip found';
  });
  console.log('Tooltip func:', test);
  await browser.close();
})();
