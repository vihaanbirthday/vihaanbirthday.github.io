import { openChapter } from './browser-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  // Inspect the actual rendered ink across the timeline. Unstarted letters
  // must be invisible, including their rounded stroke endpoints.
  const result = await page.locator('.name-stroke').evaluateAll(paths => {
    const animations = paths.map(path => path.getAnimations()[0]);
    const order = paths.map((path, index) => ({ path, animation: animations[index] })).sort((a, b) => a.animation.effect.getTiming().delay - b.animation.effect.getTiming().delay);
    animations.forEach(animation => { animation.pause(); animation.currentTime = 0; });
    const cleanStart = paths.every(path => parseFloat(getComputedStyle(path).opacity) === 0);
    const samples = order.map(({ path, animation }, index) => {
      const { delay, duration } = animation.effect.getTiming();
      animations.forEach(item => { item.currentTime = delay + duration / 2; });
      return {
        active: parseFloat(getComputedStyle(path).opacity) === 1 && parseFloat(getComputedStyle(path).strokeDashoffset) > 0 && parseFloat(getComputedStyle(path).strokeDashoffset) < path.getTotalLength(),
        past: order.slice(0, index).every(({ path }) => Math.abs(parseFloat(getComputedStyle(path).strokeDashoffset)) < 0.001),
        future: order.slice(index + 1).every(({ path }) => parseFloat(getComputedStyle(path).opacity) === 0),
        messageHidden: [...document.querySelectorAll('.opening-afterword, .opening-note')].every(el => getComputedStyle(el).visibility === 'hidden'),
      };
    });
    animations.forEach(animation => animation.finish());
    return { cleanStart, samples, completed: paths.every(path => Math.abs(parseFloat(getComputedStyle(path).strokeDashoffset)) < 0.001 && parseFloat(getComputedStyle(path).opacity) === 1) };
  });
  assert(result.cleanStart, 'No dots or round caps are visible before writing begins');
  assert(result.samples.every(sample => sample.active && sample.past && sample.future), 'Each stroke draws smoothly while future strokes remain invisible');
  assert(result.samples.every(sample => sample.messageHidden), 'The text below the name stays hidden through every stroke, including the last flourish');
  assert(result.completed, 'The completed name remains fully readable');
  await page.waitForFunction(() => document.querySelector('#welcome').classList.contains('has-written'));
  assert(await page.locator('.opening-afterword').isVisible(), 'The birthday text appears after the complete name');
  assert(await page.locator('.opening-note').isVisible(), 'The invitation note appears after the complete name');
  assert.equal(await page.locator('.writing-fireworks').count(), 1, 'A single spark canvas follows the writing');
  assert.equal(await page.locator('#motion-toggle').count(), 0, 'No header pause option');
  await page.locator('#replay-writing').click();
  assert(await page.locator('.opening-afterword').isHidden(), 'Replay hides the birthday text again');
  assert(await page.locator('.opening-note').isHidden(), 'Replay hides the invitation note again');
  await page.waitForTimeout(650);
  assert(await page.locator('.writing-fireworks').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)), 'Live fireworks follow the active stroke');
  await page.waitForFunction(() => !document.querySelector('#welcome').classList.contains('is-writing'));
  assert(await page.locator('.writing-fireworks').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.every((value, index) => index % 4 !== 3 || value === 0)), 'Sparks stop and clear after the writing finishes');
  await page.locator('#replay-writing').click();
  assert.equal(await page.locator('.stroke-script').evaluate(el => parseFloat(getComputedStyle(el).opacity)), 0, 'Replay hides strokes until their turn');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  assert(await page.locator('.name-stroke').evaluateAll(paths => paths.every(path => Math.abs(parseFloat(getComputedStyle(path).strokeDashoffset)) < 0.001)), 'Pausing shows the complete name');
  assert(await page.locator('#replay-writing').isDisabled());
  assert(await page.locator('.writing-fireworks').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.every((value, index) => index % 4 !== 3 || value === 0)), 'Reduced motion clears all spark particles immediately');
  assert(await page.locator('.opening-button').isVisible());
  assert(await page.locator('.opening-afterword').isVisible(), 'Reduced motion shows the birthday text immediately');
  assert(await page.locator('.opening-note').isVisible(), 'Reduced motion shows the invitation note immediately');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
  await page.locator('.opening-button').click();
  await page.waitForFunction(() => document.querySelector('.hero .safari-home')?.dataset.painted === 'true');
  assert.equal(await page.locator('#hero-title em,.word-accent').evaluateAll(words => words.filter(word => getComputedStyle(word).animationName !== 'none').length), 0, 'Reading text stays still');
  const friend = page.locator('.hero .safari-friend');
  await friend.focus();
  await page.keyboard.press('Enter');
  assert.equal(await friend.getAttribute('data-gesture'), 'hello', 'Animal greeting works by keyboard');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  const pausedPose = await friend.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(200);
  assert.equal(await friend.locator('canvas').evaluate(canvas => canvas.toDataURL()), pausedPose, 'Canvas movement stops while paused');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
  await openChapter(page, '#rsvp');
  await page.locator('#rsvp-button').click();
  await page.waitForFunction(() => document.body.classList.contains('motion-dialog'));
  assert.equal(await page.locator('#rsvp .safari-stop').getAttribute('data-paused'), 'true', 'Dialog pauses animal movement');
  await page.locator('#close-rsvp').click();
  await page.waitForFunction(() => !document.body.classList.contains('motion-dialog'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  await openChapter(page, '#main');
  assert(await page.locator('.name-stroke').evaluateAll(paths => paths.every(path => Math.abs(parseFloat(getComputedStyle(path).strokeDashoffset)) < 0.001)), 'Reduced motion shows the entire name immediately');
  assert.equal(await page.locator('#motion-toggle').count(), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
  assert.deepEqual(errors, []);
  console.log('Left-to-right handwriting, text after the final stroke, replay, complete paused lettering, stable reading text, keyboard greetings, reduced motion and dialog motion passed.');
} finally { await browser.close(); }
