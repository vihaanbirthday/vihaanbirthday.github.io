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
  { name: 'desktop party', event, viewport: { width: 1440, height: 1000 } },
  { name: 'small phone party', event, viewport: { width: 320, height: 640 } },
];
try {
 for (const test of cases) {
  const context = await browser.newContext({ ...devices['iPhone 13'], ...(test.viewport ? { viewport: test.viewport } : {}), reducedMotion:'reduce', acceptDownloads:true });
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
  });
  await page.goto(base);
  assert.deepEqual(await page.locator('#main > section').evaluateAll(sections => sections.map(s => s.id || 'hero')), ['welcome', 'invitation', 'celebration', 'venue', 'rsvp', 'games']);
  assert.equal(await page.locator('#rsvp-fallback, #rsvp-contact, a[href^="tel:"]').count(), 0, 'No review page or call option');
  assert.equal(await page.locator('#invitation .hero-details').count(), 0, 'Invitation omits repeated event details');
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
   assert((await page.locator('[data-event-recap]').textContent()).includes('Date coming soon'));
   assert.equal(await page.locator('#event-date').textContent(), 'Date coming soon');
   assert.equal(await page.locator('#event-time').textContent(), 'Time coming soon');
  } else {
   assert.equal(await page.locator('#event-date').textContent(),'6 December 2026');
   assert.equal(await page.locator('#event-day').textContent(),'Sunday');
   assert.match(await page.locator('#event-time').textContent(),new RegExp(test.event.time));
   assert(await page.locator('#rsvp-form').isVisible());
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   const inputs = page.locator('#guest-list input');
   const submit = page.locator('#rsvp-form button[type=submit]');
   const add = page.locator('#add-guest');
   assert.equal(await page.locator('#guest-count').count(), 0, 'Headcount is derived from named guests');
   await page.locator('#guest-name').fill('   ');
   await page.locator('#guest-attendance').selectOption('yes');
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined);
   const guest = 'A & B <script>alert(1)</script> 🦁';
   await page.locator('#guest-name').fill(guest);
   assert.equal(await page.locator('#guest-total').textContent(), '1 / 10 guests');
   await submit.tap();
   let reply = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
   assert(reply.includes("*Attendance:* I'll be there"));
   assert(reply.includes('*Total guests:* 1 guest (including me and children)'));
   assert(reply.includes(`*Guest names:*\n1. ${guest}`));
   await add.focus();
   await add.press('Enter');
   assert(await inputs.nth(0).evaluate(el => el === document.activeElement), 'Adding by keyboard focuses the new name');
   await inputs.nth(0).fill('  Léa & Zoë 🐯  ');
   await add.tap();
   assert.equal(await inputs.count(), 2);
   assert(await inputs.nth(1).evaluate(el => el === document.activeElement));
   await page.evaluate(()=>{window.testOpenedURL=undefined});
   await submit.tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'An added guest needs a name');
   await inputs.nth(1).fill('   ');
   await submit.tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Whitespace is not a guest name');
   await inputs.nth(1).fill('Baby Sam');
   if (test.actual) await page.screenshot({path:'test-results/rsvp-accept.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert(await page.locator('#rsvp-form').isVisible(), 'Submitting keeps the form available without a review screen');
   const url=new URL(await page.evaluate(()=>window.testOpenedURL));
   assert.equal(url.origin,'https://wa.me');
   assert.equal(url.pathname,`/${test.event.whatsappNumber}`);
   assert.equal(url.searchParams.get('text'), [
    'Hi Madhav & Urvashee!', '', "*Vihaan's 1st Birthday — RSVP*",
    `*Name:* ${guest}`, "*Attendance:* We'll be there",
    '*Total guests:* 3 guests (including me and children)',
    '*Guest names:*', `1. ${guest}`, '2. Léa & Zoë 🐯', '3. Baby Sam', '',
    'Looking forward to celebrating with you! 🎉',
   ].join('\n'));
   await page.locator('.remove-guest').first().focus();
   await page.locator('.remove-guest').first().press('Enter');
   assert.equal(await inputs.count(), 1);
   assert.equal(await inputs.first().inputValue(), 'Baby Sam', 'Removing one guest preserves the others');
   assert.equal(await page.locator('.guest-card label').first().textContent(), 'Guest 2');
   assert(await inputs.first().evaluate(el => el === document.activeElement), 'Removal restores focus to a nearby guest');
   for (let count = 3; count <= 10; count++) {
    await add.tap();
    await inputs.last().fill(`Friend ${count}`);
   }
   assert.equal(await page.locator('#guest-total').textContent(), '10 / 10 guests');
   assert(await add.isDisabled(), 'Ten people, including the person replying, is the limit');
   assert(await page.locator('#guest-limit').isVisible());
   assert.equal(await inputs.count(), 9);
   assert.equal(await inputs.evaluateAll(fields => new Set(fields.map(el => el.id)).size), 9, 'Labels retain unique IDs after removal and adding');
   await submit.tap();
   reply = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
   assert(reply.includes('*Total guests:* 10 guests'));
   assert(reply.includes('10. Friend 10'));
   // Submission also enforces the limit if the DOM is modified.
   await page.locator('#guest-list').evaluate(list => {
    const extra = list.lastElementChild.cloneNode(true);
    extra.querySelector('input').value = 'Extra person';
    list.append(extra);
   });
   await page.evaluate(()=>{window.testOpenedURL=undefined});
   await submit.tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Reject more than ten guests');
   await page.locator('.guest-card').last().evaluate(row => row.remove());
   await page.locator('#guest-name').fill(guest);
   await page.locator('.remove-guest').last().tap();
   assert(await add.isEnabled(), 'Removing someone at the limit enables adding again');
   assert.equal(await page.locator('#guest-limit').isVisible(), false);
   await add.tap();
   // A decline can be submitted even if a previously added name is blank.
   await page.locator('#guest-attendance').selectOption('no');
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   assert(await inputs.evaluateAll(fields => fields.every(input => input.disabled)));
   if (test.actual) await page.screenshot({path:'test-results/rsvp-decline.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   const decline = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
   assert.equal(decline, [
    'Hi Madhav & Urvashee!', '', "*Vihaan's 1st Birthday — RSVP*",
    `*Name:* ${guest}`, "*Attendance:* Sorry, we can't make it", '',
    'Sending Vihaan lots of love for his big day! 💛',
   ].join('\n'));
   assert(!decline.includes('guests'),'Decline has no headcount');
   await page.locator('#guest-attendance').selectOption('yes');
   assert(await page.locator('#guest-party').isVisible(),'Switching back restores the guest list');
   assert.equal(await inputs.first().inputValue(),'Baby Sam');
   assert(await inputs.evaluateAll(fields => fields.every(input => !input.disabled)));
   await page.evaluate(()=>{window.testOpenedURL=undefined});
   await submit.tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Restoring attendance also restores required-name validation');
   await inputs.last().fill('Final friend');
   await submit.tap();
   assert(new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text').includes('10. Final friend'));
   assert(await page.locator('#rsvp-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), 'Guest cards fit the dialog at every tested width');
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
  console.log(`${test.name}: named guests, ten-person limit, acceptance, decline, calendar and privacy passed`);
  await context.close();
 }
} finally { await browser.close(); }
