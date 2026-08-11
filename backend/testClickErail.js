import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('request', req => {
    if (req.url().includes('FARE') || req.url().includes('data.aspx')) console.log('REQ:', req.url());
  });
  page.on('response', async res => {
    if (res.url().includes('Action=FARE')) {
       console.log('RES FARE:', await res.text());
    }
  });
  await page.goto('https://erail.in/trains/belagavi-BGM/ksr-bengaluru-SBC', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const tds = document.querySelectorAll('td');
    for(let i=0; i<tds.length; i++){
       if(tds[i].innerText.includes('Get')) { tds[i].click(); break; }
    }
  });
  await page.waitForTimeout(3000);
  await browser.close();
})();
