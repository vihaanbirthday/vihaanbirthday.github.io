import { openChapter } from './browser-helpers.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const chapters = [['Opening', '#main', 'welcome'], ['Invitation', '#invitation', 'invitation'], ['Celebration', '#celebration', 'celebration'], ['Venue', '#venue', 'venue'], ['RSVP', '#rsvp', 'rsvp'], ['Gaming', '#games', 'games']];
await mkdir('test-results', { recursive: true });
try {
  for (const [width, height] of [[320, 740], [390, 844], [768, 844], [1440, 900], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    const nav = page.locator('.site-header .section-nav');
    async function checkChapter(index) {
      const [, hash, id] = chapters[index];
      assert.equal(await page.locator('#main > section:visible').count(), 1, 'Only the selected invitation page is visible');
      assert.equal(await page.locator('#main > section:visible').getAttribute('id'), id);
      assert(await page.locator('#main > section').evaluateAll(pages => pages.every(page => page.hidden === page.inert)), 'Inactive chapters are outside the focus order');
      assert.equal(await nav.locator('a[aria-current]').getAttribute('href'), hash);
      assert.equal(await page.locator('#page-counter').textContent(), index === 5 ? 'PLAY' : `0${index + 1} / 05`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), `${width}×${height}: the document does not scroll`);
      assert(await page.locator('.header-actions > .gaming-shortcut, #page-menu summary').evaluateAll(controls => controls.every(control => {
        const box = control.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth && box.width >= 44 && box.height >= 44;
      })), 'Header controls stay visible with accessible touch targets');
      const active = page.locator(`#${id}`);
      assert(await active.evaluate(el => el.scrollWidth <= el.clientWidth), `${width}px: ${id} has no horizontal overflow`);
      if (height >= 740) assert(await active.evaluate(el => el.scrollHeight <= el.clientHeight + 1), `${width}px: ${id} fits without scrolling`);
      if (index === 0) assert(await page.locator('#page-next').isHidden(), 'Opening has only Open invitation');
      else assert(await page.locator('#page-next').evaluate(el => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), 'Next stays visible and clickable on information pages');
    }
    await checkChapter(0);
    assert.equal(await page.locator('#motion-toggle').count(), 0, 'No top pause control');
    assert(await page.locator('.hero-description, .detail p, .venue-address, #rsvp > p, .game-content p').evaluateAll(elements => elements.every(el => parseFloat(getComputedStyle(el).fontSize) >= 15)), 'Invitation reading text remains comfortably sized');
    assert(await page.locator('#page-next, .gaming-shortcut').evaluateAll(elements => elements.every(el => parseFloat(getComputedStyle(el).fontSize) >= 15)), 'Primary controls have readable labels');
    await page.locator('#page-menu summary').click();
    assert(await nav.isVisible());
    assert(await nav.locator('a').evaluateAll(links => links.every(link => parseFloat(getComputedStyle(link).fontSize) >= 14)), 'The menu uses readable text');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#page-menu').evaluate(el => el.open), false);
    assert(await page.locator('#page-back').isDisabled());
    for (let index = 1; index < 5; index++) {
      await page.locator(index === 1 ? '.opening-button' : '#page-next').click();
      await checkChapter(index);
      assert.equal(await page.evaluate(() => document.activeElement.id), chapters[index][2], 'Focus follows the new page');
      await page.waitForFunction(id => document.querySelector(`#${id} .safari-home`)?.dataset.painted === 'true', chapters[index][2]);
      if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/sequence-${width}-${chapters[index][2]}.png` });
    }
    assert.equal(await page.locator('#page-next span').textContent(), 'Read again', 'The invitation ends without requiring games');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    await checkChapter(4);
    await page.locator('#main').evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 3, target: el, clientX: 240, clientY: 250 })] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 3, target: el, clientX: 80, clientY: 260 })] }));
    });
    await checkChapter(4);
    await page.locator('.ending-games a').click();
    await checkChapter(5);
    await page.goBack();
    await checkChapter(4);
    await page.goForward();
    await checkChapter(5);
    await page.locator('[data-game="taptaptap"]').click();
    await page.locator('.game-tabs a[href="#games"]').click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !document.querySelector('iframe'));
    await checkChapter(5);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'games', 'Returning to the current chapter closes the game and focuses its page');
    await page.locator('[data-game="taptaptap"]').click();
    assert(await page.locator('#game-dialog').isVisible());
    await page.locator('.game-tabs a[href="#rsvp"]').click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !document.querySelector('iframe'));
    await checkChapter(4);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'rsvp');
    await page.locator('#page-back').click();
    await checkChapter(3);
    await page.keyboard.press('ArrowLeft');
    await checkChapter(2);
    await page.keyboard.press('ArrowRight');
    await checkChapter(3);
    await page.keyboard.press('Home');
    await checkChapter(0);
    await page.keyboard.press('End');
    await checkChapter(4);
    await page.locator('#page-next').click();
    await checkChapter(0);
    // The Gaming shortcut works immediately; returning resumes the same invitation page.
    await page.locator('.gaming-shortcut').click();
    await checkChapter(5);
    await page.locator('#page-next').click();
    await checkChapter(0);
    await openChapter(page, '#venue');
    await page.locator('.gaming-shortcut').click();
    await checkChapter(5);
    await page.locator('#page-back').click();
    await checkChapter(3);
    await page.keyboard.press('Home');
    // Horizontal swipes change chapter; vertical reading gestures do not.
    await page.locator('#main').evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: el, clientX: 240, clientY: 250 })] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: 80, clientY: 260 })] }));
    });
    await checkChapter(1);
    await page.locator('#main').evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 2, target: el, clientX: 180, clientY: 200 })] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 2, target: el, clientX: 170, clientY: 400 })] }));
    });
    await checkChapter(1);
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const [, hash, id] of chapters) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(base + hash);
    assert.equal(await page.locator('#main > section:visible').getAttribute('id'), id, 'Direct links open their chapter');
    await page.reload();
    assert.equal(await page.locator('#main > section:visible').getAttribute('id'), id, 'Reload retains the selected chapter');
    if (id === 'games') {
      await page.locator('#page-next').click();
      assert(await page.locator('#welcome').isVisible(), 'A direct games link returns to the opening');
    }
    await page.close();
  }
  const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await plain.goto(base);
  assert.equal(await plain.locator('#main > section:visible').count(), 6, 'Without JavaScript every chapter is readable');
  await openChapter(plain, '#venue');
  assert.equal(new URL(plain.url()).hash, '#venue');
  await plain.close();
  console.log('Sequential invitation pages, optional games at the end, immediate Gaming shortcuts, return to the launching page, responsive layouts, focus, history, keyboard, swipe and no-JS fallback passed.');
} finally { await browser.close(); }
