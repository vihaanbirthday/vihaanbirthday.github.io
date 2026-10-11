import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { event } from '../event-config.js';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#games');
  await page.locator('[data-game="taptaptap"]').tap();
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const frame = page.frames().find(frame => frame.url().includes('/games/taptaptap/'));
  const menuFits = id => frame.locator(id).evaluate(el => el.scrollHeight <= el.clientHeight + 1);
  assert(await menuFits('#pageGameMenu'), 'The phone start screen fits without scrolling');
  await frame.locator('#newGameBtn').tap();
  assert(await menuFits('#pageTutorial'), 'The phone instructions fit without scrolling');
  await frame.locator('#tutPgStartGameBtn').tap();
  await page.clock.runFor(1250);
  await frame.locator('#pagePlayArea').waitFor({ state: 'visible' });
  async function state() { return frame.evaluate(() => ({ ...gameEngine })); }
  async function tapBlue() { await frame.locator('.good-circle').first().tap(); }
  async function openResultShare(screen) {
    await frame.locator(`${screen} [data-share-result]`).tap();
    await page.locator('#download-result-file[href]').waitFor({ state: 'visible' });
    const result = await state();
    const label = await page.locator('#result-share-preview').getAttribute('aria-label');
    assert(label.includes(`${result.score} points`), 'The result image carries the current score');
    const url = new URL(await page.locator('#result-whatsapp').getAttribute('href'));
    assert.equal(url.hostname, 'wa.me');
    assert.equal(url.pathname, `/${event.whatsappNumber}`, 'Sharing uses the configured contact');
    assert(url.searchParams.get('text').includes(`${result.score} points`));
    const image = await page.locator('#result-share-preview').evaluate(canvas => ({
      width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png').slice(0, 30),
    }));
    assert.equal(image.width, 720);
    assert.equal(image.height, 800);
    assert(image.png.startsWith('data:image/png;base64,iVBOR'));
  }
  function assertBoard(boxes) {
    assert(boxes.every(box => box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.right <= box.areaWidth + 1 && box.bottom <= box.areaHeight + 1), 'All targets fit and have accessible touch sizes');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'Targets never overlap');
    }
  }
  const board = () => frame.locator('#gameSpace button').evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect(), area = button.parentElement.getBoundingClientRect();
    return { x: box.x - area.x, y: box.y - area.y, right: box.right - area.x, bottom: box.bottom - area.y, width: box.width, height: box.height, areaWidth: area.width, areaHeight: area.height };
  }));
  assertBoard(await board());
  await tapBlue();
  assert.equal((await state()).tapNum, 1, 'A touch counts once');
  await frame.locator('#gmStatsPauseBtn').tap();
  const timeBeforePause = (await state()).timeLeft;
  await page.clock.runFor(5000);
  assert.equal((await state()).timeLeft, timeBeforePause, 'Pause freezes time');
  await frame.locator('#pmCntnuGmBtn').tap();
  await page.clock.runFor(1000);
  assert((await state()).timeLeft < timeBeforePause, 'Continue resumes the clock');
  await frame.locator('.evil-circle').first().tap();
  assert.equal((await state()).lives, 2, 'Red costs one heart');
  assert.equal((await state()).streak, 0, 'Red resets the combo');
  for (let i = 0; i < 4; i++) await tapBlue();
  assert(await frame.locator('.bonus-circle').isVisible(), 'A star appears after five taps');
  const beforeStar = await state();
  await frame.locator('.bonus-circle').tap();
  const afterStar = await state();
  assert.equal(afterStar.score, beforeStar.score + 50, 'Gold gives bonus points');
  assert.equal(afterStar.timeLeft, beforeStar.timeLeft + 3, 'Gold adds time');
  const beforeCombo = (await state()).score;
  await tapBlue();
  assert.equal((await state()).score, beforeCombo + 20, 'Five clean taps activate double points');
  const passedScores = [];
  for (let level = 1; level <= 8; level++) {
    assert.equal((await state()).levelNum, level);
    assertBoard(await board());
    await page.screenshot({ path: `test-results/taptaptap-level-${level}.png` });
    while ((await state()).state === 'playing') await tapBlue();
    assert(await frame.locator('#pageLevelPassed').isVisible(), `Level ${level} has a clear completion screen`);
    assert.equal((await state()).tapNum, (await state()).tapsGoal);
    assert(await menuFits('#pageLevelPassed'), 'Completion and next/replay controls fit without scrolling');
    passedScores.push((await state()).score);
    if (level === 1) {
      await page.evaluate(() => window.postMessage({ type: 'invitation:share-result', result: {} }, '*'));
      assert.equal(await page.locator('#result-share-dialog').evaluate(el => el.open), false, 'Ignore unrelated windows');
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
      });
      await openResultShare('#pageLevelPassed');
      assert(await page.locator('#share-result-file').isHidden(), 'Unsupported browsers offer an image download');
      const downloaded = page.waitForEvent('download');
      await page.locator('#download-result-file').tap();
      assert.equal((await downloaded).suggestedFilename(), `tap-tap-tap-${(await state()).score}-points.png`);
      await page.locator('#close-result-share').tap();
    }
    if (level < 8) {
      await frame.locator('#lvlPssdContinueNextLvlBtn').tap();
      await page.clock.runFor(1250);
      if (level === 1) {
        const banked = (await state()).score;
        await tapBlue();
        await frame.locator('.evil-circle').first().tap();
        await frame.locator('.evil-circle').first().tap();
        assert(await menuFits('#pageYouLost'), 'Retry controls fit without scrolling');
        assert(await frame.locator('#pageYouLost').isVisible(), 'Running out of hearts ends the round');
        await openResultShare('#pageYouLost');
        assert((await page.locator('#result-share-preview').getAttribute('aria-label')).includes('1/8 levels cleared'), 'Lost result counts only completed levels');
        await page.locator('#close-result-share').tap();
        await frame.locator('#retryLevelBtn').tap();
        await page.clock.runFor(1250);
        assert.equal((await state()).score, banked, 'Retry restores the score at the start of this level');
        assert.equal((await state()).levelNum, 2, 'Retry keeps the failed level');
        assert.equal((await state()).lives, 3, 'Retry restores hearts');
      }
    }
  }
  assert(passedScores.every((score, i) => !i || score > passedScores[i - 1]), 'Score carries forward through all eight rounds');
  assert(await frame.locator('#lvlPssdContinueNextLvlBtn').isHidden(), 'No nonexistent ninth level');
  assert(await frame.locator('#playAgainBtn').isVisible(), 'Final celebration offers replay');
  assert.equal(await frame.locator('#completedJourney .done').count(), 8);
  await page.screenshot({ path: 'test-results/taptaptap-completed.png' });
  await page.evaluate(() => {
    window.shareBehavior = 'success';
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files?.[0]?.type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.sharedResult = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size, text: data.text };
      if (window.shareBehavior === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (window.shareBehavior === 'error') throw new DOMException('Unavailable', 'NotAllowedError');
    } });
  });
  await openResultShare('#pageLevelPassed');
  assert(await page.locator('#share-result-file').isEnabled());
  await page.screenshot({ path: 'test-results/taptaptap-share-mobile.png' });
  await page.locator('#share-result-file').tap();
  const shared = await page.evaluate(() => window.sharedResult);
  assert.equal(shared.type, 'image/png');
  assert(shared.size > 10000, 'Share sheet receives a real image file');
  assert(shared.text.includes('8/8 levels cleared'));
  assert(shared.text.includes(`${(await state()).score} points`));
  await page.evaluate(() => { window.shareBehavior = 'cancel'; });
  await page.locator('#share-result-file').tap();
  assert(await page.locator('#share-result-file').isEnabled(), 'Cancelling allows sharing again');
  assert.equal(await page.locator('#result-share-status').textContent(), '');
  await page.evaluate(() => { window.shareBehavior = 'error'; });
  await page.locator('#share-result-file').tap();
  assert(await page.locator('#share-result-file').isHidden(), 'Rejected sharing falls back to download and directed chat');
  assert(await page.locator('#download-result-file').isVisible());
  await page.locator('#close-result-share').tap();
  await frame.locator('#playAgainBtn').tap();
  await frame.locator('#tutPgStartGameBtn').tap();
  await page.clock.runFor(1250);
  assert.equal((await state()).score, 0, 'Replay starts a fresh run');
  await page.clock.runFor(31000);
  assert(await frame.locator('#pageYouLost').isVisible(), 'Time expiry ends the round');
  assert.equal(await frame.locator('#lvlLostTtl').textContent(), 'Time’s up.');
  assert.deepEqual(errors, []);
  console.log('Tap Tap Tap: gameplay through eight levels, PNG result sharing, configured WhatsApp contact, download fallback, cancellation and share failure passed.');
} finally { await browser.close(); }
