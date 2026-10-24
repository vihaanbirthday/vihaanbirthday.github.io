import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ ...devices['iPhone 13'], viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#games');
    for (const game of ['flappy', 'hextris', 'ohhi']) {
      await page.locator(`[data-game="${game}"]`).tap();
      await page.locator('.game-loading').waitFor({ state: 'detached' });
      const frame = page.frames().find(frame => frame.url().includes(`/games/${game}/`));
      const button = frame.locator('#share-final-score');
      assert.equal(await button.count(), 0, `${game}: no score-sharing control before finishing`);
      if (game === 'flappy') {
        await frame.locator('[data-character="pip"]').tap();
        await frame.locator('#start-flight').tap();
        await frame.locator('#demo-start').tap();
        await frame.evaluate(() => { score = 7; playerDead(); });
        await frame.locator('#scoreboard').waitFor({ state: 'visible' });
        await page.waitForTimeout(1300);
      } else if (game === 'hextris') {
        await frame.locator('#startBtn').tap();
        await frame.evaluate(() => { gameState = 2; score = 842; highscores = [842]; gameOverDisplay(); });
        await page.waitForTimeout(600);
      } else {
        // A valid solved 4×4 board exercises the real puzzle-completion path.
        await frame.evaluate(() => {
          const full = [1,1,2,2, 1,2,1,2, 2,1,2,1, 2,2,1,1];
          Game.startGame({ size: 4, full, empty: full });
          Game.checkForLevelComplete();
        });
        await frame.waitForFunction(() => document.querySelector('#chooseSize').classList.contains('show') && !document.querySelector('#menugrid').classList.contains('hidden'));
        await page.waitForTimeout(600);
      }
      assert.equal(await button.count(), 0, `${game}: final results have no score-sharing option`);
      assert.equal(await page.locator('#result-share-dialog').count(), 0, 'No result-sharing dialog');
      if (game === 'flappy') {
        assert.equal(await frame.locator('#currentscore').textContent(), '7');
        assert.equal(await frame.locator('#result-character').textContent(), 'Flown with Pip');
      } else if (game === 'hextris') {
        assert.equal(await frame.locator('#cScore').textContent(), '842');
      } else {
        assert(await frame.locator('#score').isVisible(), 'Puzzle completion retains the score');
        assert(await frame.locator('#bar [data-action="back"]').isVisible(), 'Puzzle completion retains Back');
      }
      await page.screenshot({ path: `test-results/${game}-final-${viewport.width}.png` });
      // Replay still starts another game after the result screen.
      if (game === 'flappy') {
        await frame.locator('#replay').tap();
        await page.waitForTimeout(1200);
      } else if (game === 'hextris') {
        await frame.locator('#restart').tap();
        await page.waitForTimeout(600);
      } else {
        await frame.evaluate(() => {
          const full = [1,1,2,2, 1,2,1,2, 2,1,2,1, 2,2,1,1];
          Game.startGame({ size: 4, full, empty: Array(16).fill(0) });
        });
      }
      assert.equal(await button.count(), 0, `${game}: replay has no score-sharing control`);
      await page.locator('#close-game').tap();
      if (game !== 'flappy') {
        await page.locator('#game-exit-dialog').waitFor({ state: 'visible' });
        await page.locator('#discard-game').tap();
      }
      await page.locator('#game-dialog').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Broomstick Flyer, Hextris and 0h h1: final scores without sharing and replay passed in portrait and landscape.');
} finally { await browser.close(); }
