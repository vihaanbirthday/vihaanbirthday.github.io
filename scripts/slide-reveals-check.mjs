import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function assertSettled(id) {
    assert.equal(await page.locator(`#${id}.is-revealing, #${id}.is-slide-revealing`).count(), 0, `${id}: skipping ends the text sequence`);
    const selector = id === 'welcome' ? '.opening-kicker, .opening-title, .opening-afterword, .opening-note, .opening-button, .opening-dedication' : `#${id} [data-slide-reveal]`;
    assert(await page.locator(selector).evaluateAll(elements => elements.filter(el => !el.closest('[hidden]')).every(el => !el.inert && getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity === '1')), `${id}: skipping immediately reveals and unlocks all content`);
    assert.equal(await page.locator(`${id === 'welcome' ? '.opening-button' : '#page-next'}.is-sequence-ready`).count(), 1, `${id}: skipping starts the next-action shine`);
  }
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
    assert(await page.locator('#page-next').evaluate(el => {
      const animation = el.getAnimations().find(animation => animation.animationName === 'next-breathe');
      if (!animation) return false;
      animation.pause();
      animation.currentTime = 0;
      const small = parseFloat(getComputedStyle(el).scale);
      animation.currentTime = 1200;
      const large = parseFloat(getComputedStyle(el).scale);
      animation.play();
      return small === 1 && large > 1.06;
    }), `${id}: the completed next action visibly grows and shrinks`);
    await page.locator('#page-next').click({ force: true });
    assert.equal(await page.locator('#main > section:visible').getAttribute('id'), ({ invitation: 'celebration', celebration: 'venue', venue: 'rsvp', rsvp: 'welcome', games: 'welcome' })[id], `${id}: a completed sequence advances on one click`);
    console.log(`${id}: automatic reading order and future-control focus passed`);
  }
  for (const id of ['welcome', 'invitation', 'celebration', 'venue', 'rsvp', 'games']) {
    const url = `${base}/${id === 'welcome' ? '' : `#${id}`}`;
    await page.goto(url);
    await page.waitForFunction(id => document.querySelector(`#${id}`).matches('.is-revealing, .is-slide-revealing'), id);
    const before = await page.evaluate(() => ({ url: location.href, historyLength: history.length }));
    const forward = page.locator(id === 'welcome' ? '.opening-button' : '#page-next');
    await forward.click();
    assert.equal(await page.locator('#main > section:visible').getAttribute('id'), id, `${id}: the first forward press skips without navigating`);
    assert.deepEqual(await page.evaluate(() => ({ url: location.href, historyLength: history.length })), before, `${id}: skipping does not add browser history`);
    await assertSettled(id);
    await forward.click({ force: true });
    assert.notEqual(await page.locator('#main > section:visible').getAttribute('id'), id, `${id}: the second press advances`);

    await page.goto(url);
    await page.waitForFunction(id => document.querySelector(`#${id}`).matches('.is-revealing, .is-slide-revealing'), id);
    // Tap where a future line will appear. Hidden/inert content lets the blank
    // space receive the tap without activating the future control beneath it.
    const blank = await page.evaluate(id => {
      const selector = id === 'welcome' ? '.opening-dedication' : '[data-slide-reveal]';
      const section = document.querySelector(`#${id}`);
      for (const element of [...section.querySelectorAll(selector)].reverse()) {
        const rect = element.getBoundingClientRect();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit && section.contains(hit) && !hit.closest('a, button, input, select, textarea, summary, [role="button"]') && getComputedStyle(element).visibility === 'hidden') return { x, y };
      }
      throw new Error(`No blank future-content space found on ${id}`);
    }, id);
    await page.touchscreen.tap(blank.x, blank.y);
    assert.equal(await page.locator('#main > section:visible').getAttribute('id'), id, `${id}: a blank-space tap stays on the current slide`);
    await assertSettled(id);
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
  assert.equal(await page.locator('#page-next').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion does not pulse the button size');
  assert(await page.locator('#rsvp [data-slide-reveal]').evaluateAll(elements => elements.every(el => !el.inert && getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity === '1')));
  assert.deepEqual(errors, []);
  console.log('Forward-button skips, blank-space touch skips, stronger breathing next actions, quick navigation, dialog interruption and reduced motion passed.');
} finally { await browser.close(); }
