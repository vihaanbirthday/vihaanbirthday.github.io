import { openChapter } from './browser-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { event } from '../event-config.js';
import { getEventDate } from '../event-details.js';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const cases = [
  { name: 'confirmed party details', event, actual: true },
  { name: 'pending details', event: { date:null, time:null, utcOffset:'+04:00', whatsappNumber:'', venue:'Paps Restaurant' } },
  { name: 'configured details', event: { date:'2026-12-06', time:'12:30', utcOffset:'+04:00', whatsappNumber:'23000000000', venue:'Paps Restaurant, Vacoas-Phoenix' } },
];
try {
 for (const test of cases) {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion:'reduce', acceptDownloads:true });
  const page = await context.newPage();
  const errors = [], blocked = [];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if (!test.actual && url.pathname==='/event-config.js') return route.fulfill({contentType:'text/javascript',body:`export const event = ${JSON.stringify(test.event)};`});
   if (url.origin!==base) { blocked.push(url.href); return route.abort(); }
   return route.continue();
  });
  // Test doubles: never contact WhatsApp or send any messages.
  await page.addInitScript(()=>{
   window.open=(url)=>{window.testOpenedURL=url;return null};
   Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testCopiedText=text}},configurable:true});
  });
  await page.goto(base);
  assert.deepEqual(await page.locator('#main > section').evaluateAll(sections => sections.map(s => s.id || 'hero')), ['welcome', 'invitation', 'celebration', 'venue', 'rsvp', 'games']);
  for (const trigger of await page.locator('#main [data-rsvp]').all()) {
   await openChapter(page, `#${await trigger.evaluate(el => el.closest('[data-page]').id)}`);
   if (!(await trigger.isVisible())) continue;
   await trigger.tap();
   assert(await page.locator('#rsvp-dialog').isVisible());
   await page.locator('#close-rsvp').tap();
   assert(await trigger.evaluate(el => document.activeElement === el));
  }
  await page.locator('.rsvp-shortcut').tap();
  assert(await page.locator('#rsvp-dialog').isVisible());
  await page.locator('#close-rsvp').tap();
  assert(await page.locator('.rsvp-shortcut').evaluate(el => document.activeElement === el));
  await openChapter(page, '#rsvp');
  await page.locator('#rsvp-button').tap();
  assert(await page.locator('#rsvp-dialog').isVisible());
  if (!test.event.whatsappNumber) {
   assert(await page.locator('#rsvp-unavailable').isVisible());
   assert.equal(await page.locator('#rsvp-form').isVisible(),false);
   assert.equal(await page.locator('#countdown').isVisible(),false);
   assert.equal(await page.locator('#hero-date').textContent(), 'Date coming soon');
   assert.equal(await page.locator('#event-date').textContent(), 'Date coming soon');
   assert.equal(await page.locator('#event-time').textContent(), 'Time coming soon');
  } else {
   assert.equal(await page.locator('#event-date').textContent(),'6 December 2026');
   assert.equal(await page.locator('#event-day').textContent(),'Sunday');
   assert.match(await page.locator('#event-time').textContent(),new RegExp(test.event.time));
   assert(await page.locator('#rsvp-form').isVisible());
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   assert.deepEqual(await page.locator('#guest-count option').evaluateAll(options => options.map(option => option.value)), ['1', '2', '3', '4']);
   assert.equal(await page.locator('#guest-total').count(), 0);
   await page.locator('#guest-name').fill('   ');
   await page.locator('#guest-attendance').selectOption('yes');
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined);
   const guest = 'A & B <script>alert(1)</script> 🦁';
   await page.locator('#guest-name').fill(guest);
   await page.locator('#guest-count').selectOption('3');
   if (test.actual) await page.screenshot({path:'test-results/rsvp-accept.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Review does not open WhatsApp before the guest chooses it');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'rsvp-status','Focus moves to the prepared reply');
   assert(await page.locator('#copy-rsvp').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight),'Copy is visible without scrolling');
   await page.locator('#open-rsvp-whatsapp').tap();
   const url=new URL(await page.evaluate(()=>window.testOpenedURL));
   assert.equal(url.origin,'https://wa.me');
   assert.equal(url.pathname,`/${test.event.whatsappNumber}`);
   assert.equal(url.searchParams.get('text'), [
    'Hi Madhav & Urvashee!', '', "*Vihaan's 1st Birthday — RSVP*",
    `*Name:* ${guest}`, "*Attendance:* We'll be there",
    '*Total guests:* 3 guests (including me and children)', '',
    'Looking forward to celebrating with you! 🎉',
   ].join('\n'));
   if (test.actual) await page.screenshot({path:'test-results/rsvp-message.png'});
   assert((await page.locator('#rsvp-status').textContent()).includes('Send your message in WhatsApp'));
   assert(await page.locator('#rsvp-fallback').isVisible());
   assert.equal(await page.locator('#rsvp-message').inputValue(), url.searchParams.get('text'));
   await page.locator('#copy-rsvp').tap();
   assert.equal(await page.evaluate(() => window.testCopiedText), url.searchParams.get('text'));
   await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); }; });
   await page.locator('#copy-rsvp').tap();
   assert((await page.locator('#copy-status').textContent()).includes('Select and copy'));
   assert.equal(await page.evaluate(() => document.activeElement.id), 'rsvp-message');
   for (const count of ['1', '2', '4']) {
    await page.locator('#edit-rsvp').tap();
    await page.locator('#guest-count').selectOption(count);
    await page.locator('#rsvp-form button[type=submit]').tap();
    await page.locator('#open-rsvp-whatsapp').tap();
    const reply = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
    assert(reply.includes(`*Total guests:* ${count} ${count === '1' ? 'guest' : 'guests'} (including me and children)`));
    assert(reply.includes(`*Attendance:* ${count === '1' ? "I'll be there" : "We'll be there"}`));
   }
   await page.locator('#edit-rsvp').tap();
   // Even a modified dropdown must not generate a reply above the limit.
   await page.locator('#guest-count').evaluate(select => select.add(new Option('5 guests', '5')));
   await page.locator('#guest-count').selectOption('5');
   await page.evaluate(()=>{window.testOpenedURL=undefined});
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Reject more than four guests');
   assert.equal(await page.locator('#rsvp-fallback').isVisible(),false);
   await page.locator('#guest-count').selectOption('4');
   await page.locator('#guest-count option[value="5"]').evaluate(option => option.remove());
   await page.locator('#rsvp-form button[type=submit]').tap();
   await page.locator('#open-rsvp-whatsapp').tap();
   assert(new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text').includes('4 guests'),'Four guests are accepted after correcting an invalid count');
   await page.locator('#edit-rsvp').tap();
   await page.locator('#guest-attendance').selectOption('no');
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   assert.equal(await page.locator('#rsvp-fallback').isVisible(),false,'Changing the answer clears the stale prepared reply');
   assert(await page.locator('#guest-count').isDisabled());
   if (test.actual) await page.screenshot({path:'test-results/rsvp-decline.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   await page.locator('#open-rsvp-whatsapp').tap();
   const decline = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
   assert.equal(decline, [
    'Hi Madhav & Urvashee!', '', "*Vihaan's 1st Birthday — RSVP*",
    `*Name:* ${guest}`, "*Attendance:* Sorry, we can't make it", '',
    'Sending Vihaan lots of love for his big day! 💛',
   ].join('\n'));
   assert(!decline.includes('guests'),'Decline has no headcount');
   await page.locator('#edit-rsvp').tap();
   await page.locator('#guest-attendance').selectOption('yes');
   assert(await page.locator('#guest-count').isVisible(),'Switching back restores the guest count');
   assert.equal(await page.locator('#guest-count').inputValue(),'4');
   assert.equal(await page.evaluate(()=>localStorage.length),0);
  }
  await page.locator('#close-rsvp').tap();
  if(test.event.date) {
   for (const button of await page.locator('[data-calendar]').all()) {
    await openChapter(page, `#${await button.evaluate(el => el.closest('[data-page]').id)}`);
    if (!(await button.isVisible())) continue;
    const downloadPromise=page.waitForEvent('download');
    await button.tap();
    const download=await downloadPromise;
    const ics=await readFile(await download.path(),'utf8');
    const start=getEventDate(test.event).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    assert(ics.includes(`DTSTART:${start}`),'Calendar uses Mauritius UTC+04:00');
    assert(ics.includes('LOCATION:Paps'));
    assert(!ics.includes('DTEND'),'No fabricated ending time');
   }
  }
  assert.equal(await page.locator('#share-button').count(),0);
  assert.deepEqual(blocked,[],'No external requests');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`${test.name}: acceptance, decline, headcounts, calendar and privacy passed`);
  await context.close();
 }
} finally { await browser.close(); }
