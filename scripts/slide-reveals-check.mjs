import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const id of ['invitation', 'celebration', 'venue', 'rsvp', 'games']) {
    await page.goto(`${base}/#${id}`);
    await page.waitForFunction(id => document.body.dataset.page === id && document.querySelector(`#${id}`).classList.contains('is-slide-revealing'), id);
    assert.equal(await page.locator('#page-next.is-sequence-ready').count(), 0, `${id}: Next does not shine while content is appearing`);
    const controls = page.locator(`#${id} [data-slide-reveal]:is(a, button), #${id} [data-slide-reveal] button`);
    if (await controls.count()) {
      await controls.last().focus();
      assert(await controls.last().evaluate(el => document.activeElement !== el), `${id}: future controls cannot receive focus`);
    }
    const records = await page.locator(`#${id}`).evaluate(section => new Promise(resolve => {
      const targets = [...section.querySelectorAll('[data-slide-reveal]')].filter(el => !el.closest('[hidden]'));
      const seen = new Set(), records = [];
      function observe() {
        targets.forEach((element, index) => {
          const style = getComputedStyle(element);
          if (seen.has(index) || style.visibility === 'hidden' || parseFloat(style.opacity) < .05) return;
          const previous = records.at(-1);
          records.push({ index, previousComplete: !previous || parseFloat(getComputedStyle(targets[previous.index]).opacity) >= .99 });
          seen.add(index);
        });
        if (seen.size === targets.length) resolve(records);
        else requestAnimationFrame(observe);
      }
      observe();
    }));
    assert.deepEqual(records.map(record => record.index), records.map((_, index) => index), `${id}: content appears automatically in reading order`);
    assert(records.every(record => record.previousComplete), `${id}: each line settles before the next begins`);
    await page.waitForFunction(id => !document.querySelector(`#${id}`).classList.contains('is-slide-revealing'), id);
    await page.waitForFunction(() => document.querySelector('#page-next').classList.contains('is-sequence-ready'));
    assert(await page.locator(`#${id} [data-slide-reveal]`).evaluateAll(elements => elements.every(el => !el.inert)), `${id}: controls unlock after the reveal`);
    if (await controls.count()) {
      await controls.last().focus();
      assert(await controls.last().evaluate(el => document.activeElement === el), `${id}: the revealed control is keyboard accessible`);
    }
    await page.screenshot({ path: `test-results/revealed-${id}.png` });
    console.log(`${id}: automatic reading order and future-control focus passed`);
  }
  await page.goto(`${base}/#celebration`);
  await page.waitForFunction(() => document.querySelector('#celebration').classList.contains('is-slide-revealing'));
  await page.locator('.gaming-shortcut').click();
  assert.equal(await page.locator('#page-next.is-sequence-ready').count(), 0, 'The shine resets when a new slide starts');
  assert.equal(await page.locator('#celebration.is-slide-revealing').count(), 0, 'Quick navigation cancels the previous sequence');
  assert(await page.locator('#celebration [data-slide-reveal]').evaluateAll(elements => elements.every(el => !el.inert)), 'Cancelled reveals release their controls');
  await page.locator('.rsvp-shortcut').click();
  await page.waitForFunction(() => document.body.classList.contains('motion-dialog'));
  assert.equal(await page.locator('.is-slide-revealing').count(), 0, 'An open dialog settles the background slide');
  await page.locator('#close-rsvp').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  await page.goto(`${base}/#rsvp`);
  assert.equal(await page.locator('.is-slide-revealing').count(), 0, 'Reduced motion shows the complete slide immediately');
  assert.equal(await page.locator('#page-next.is-sequence-ready').count(), 1, 'Reduced motion gives the completed slide its static glass highlight');
  assert.equal(await page.locator('#page-next').evaluate(el => getComputedStyle(el, '::after').animationName), 'none', 'Reduced motion does not sweep the shine');
  assert(await page.locator('#rsvp [data-slide-reveal]').evaluateAll(elements => elements.every(el => !el.inert && getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity === '1')));
  assert.deepEqual(errors, []);
  console.log('Quick navigation, dialog interruption and reduced motion passed.');
} finally { await browser.close(); }
