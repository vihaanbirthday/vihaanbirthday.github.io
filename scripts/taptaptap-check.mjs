import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
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
    assert.equal(await frame.locator('[data-share-result]').count(), 0, 'Results have no score-sharing options');
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
  await frame.locator('#playAgainBtn').tap();
  await frame.locator('#tutPgStartGameBtn').tap();
  await page.clock.runFor(1250);
  assert.equal((await state()).score, 0, 'Replay starts a fresh run');
  await page.clock.runFor(31000);
  assert(await frame.locator('#pageYouLost').isVisible(), 'Time expiry ends the round');
  assert.equal(await frame.locator('#lvlLostTtl').textContent(), 'Time’s up.');
  assert.deepEqual(errors, []);
  console.log('Tap Tap Tap: gameplay through eight levels, results without sharing, retries and replay passed.');
} finally { await browser.close(); }
