import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { openChapter } from './browser-helpers.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#celebration');
    await page.evaluate(() => document.fonts.ready);
    const cards = page.locator('[data-party-press]');
    assert.equal(await cards.count(), 3);
    const details = await cards.allTextContents();
    for (const card of await cards.all()) {
      assert.equal(await card.evaluate(el => el.tagName), 'BUTTON');
      await card.tap();
      assert(await card.evaluate(el => el.getAnimations().some(animation => animation.effect.getKeyframes().some(frame => frame.transform?.includes('scale')))), 'Tapping each card starts a spring animation');
      await card.evaluate(el => el.getAnimations().forEach(animation => animation.finish()));
      await card.focus();
      await page.keyboard.press('Space');
      assert(await card.evaluate(el => el.getAnimations().length > 0), 'Cards also respond to keyboard activation');
    }
    assert.deepEqual(await cards.allTextContents(), details, 'Pressing preserves the event details');

    for (const hash of ['#invitation', '#celebration', '#venue', '#rsvp', '#games']) {
      await openChapter(page, hash);
      await page.locator(hash).evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      const word = page.locator(`${hash} .confetti-word`);
      assert.equal(await word.count(), 1);
      await word.evaluate(button => button.addEventListener('click', event => { window.testTap = { x: event.clientX, y: event.clientY }; }, { once: true }));
      const rect = await word.boundingBox();
      await word.tap({ position: { x: rect.width / 3, y: rect.height / 2 } });
      const particles = page.locator('.party-confetti i');
      assert.equal(await page.locator('.party-confetti').count(), 1);
      const origin = await particles.first().evaluate(el => ({ x: parseFloat(el.style.left) + 4, y: parseFloat(el.style.top) + 6 }));
      const tap = await page.evaluate(() => window.testTap);
      assert(Math.abs(origin.x - tap.x) < 2 && Math.abs(origin.y - tap.y) < 2, `Confetti originates at the tap: ${JSON.stringify({ hash, origin, tap })}`);
      const movement = await particles.first().evaluate(el => {
        const animation = el.getAnimations()[0];
        animation.pause();
        animation.currentTime = 0;
        const start = el.getBoundingClientRect();
        animation.currentTime = 400;
        const finish = el.getBoundingClientRect();
        animation.play();
        return Math.hypot(finish.x - start.x, finish.y - start.y);
      });
      assert(movement > 10, 'Confetti visibly travels outwards');
      if (hash === '#venue') {
        await particles.evaluateAll(elements => elements.forEach(el => el.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 350; })));
        await page.screenshot({ path: `test-results/confetti-${width}.png` });
      }
      await word.evaluate(button => { button.click(); button.click(); button.click(); });
      assert.equal(await page.locator('.party-confetti').count(), 4, 'Every rapid repeat creates a fresh burst');
      await page.locator('.party-confetti i').evaluateAll(elements => elements.forEach(el => el.getAnimations().forEach(animation => animation.play())));
      await page.waitForFunction(() => !document.querySelector('.party-confetti'));
      await word.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.party-confetti').count(), 1, 'Red words support keyboard confetti');
      await openChapter(page, '#main');
      assert.equal(await page.locator('.party-confetti').count(), 0, 'Changing slides clears active confetti');
    }

    await page.locator('.rsvp-shortcut').click();
    await page.locator('#rsvp-title .confetti-word').click();
    assert.equal(await page.locator('#rsvp-dialog .party-confetti').count(), 1, 'Dialog confetti appears in the dialog top layer');
    assert.equal(await page.locator('.party-confetti').evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Confetti never blocks subsequent taps');
    await page.locator('#close-rsvp').click();
    await page.waitForFunction(() => !document.querySelector('.party-confetti'));
    assert.equal(await page.locator('.party-confetti').count(), 0, 'Closing a dialog clears its confetti');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openChapter(page, '#celebration');
    await cards.first().tap();
    assert(await cards.first().evaluate(el => el.getAnimations().every(animation => animation.effect.getKeyframes().every(frame => !frame.transform))), 'Reduced-motion presses avoid scaling');
    await page.locator('#celebration .confetti-word').tap();
    assert(await page.locator('.party-confetti i').evaluateAll(elements => elements.every(el => {
      const frames = el.getAnimations()[0].effect.getKeyframes();
      return frames[0].transform === frames.at(-1).transform;
    })), 'Reduced-motion confetti fades without travelling');
    await page.waitForFunction(() => !document.querySelector('.party-confetti'));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Celebration card presses, touch/keyboard confetti, rapid repeats, tap positions, cleanup, dialog layering and reduced motion passed on phone and desktop.');
} finally { await browser.close(); }
