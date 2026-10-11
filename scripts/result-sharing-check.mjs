import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { event } from '../event-config.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ ...devices['iPhone 13'], viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => files?.[0]?.type === 'image/png' });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        window.sharedResult = { text: data.text, title: data.title, name: data.files[0].name, size: data.files[0].size, type: data.files[0].type };
      } });
    });
    await page.goto(base + '#games');
    for (const game of ['flappy', 'hextris', 'ohhi']) {
      await page.locator(`[data-game="${game}"]`).tap();
      await page.locator('.game-loading').waitFor({ state: 'detached' });
      const frame = page.frames().find(frame => frame.url().includes(`/games/${game}/`));
      const button = frame.locator('#share-final-score');
      assert(await button.isHidden(), `${game}: no final score button before finishing`);
      let expectedScore, name;
      if (game === 'flappy') {
        name = 'Broomstick Flyer'; expectedScore = 7;
        await frame.locator('[data-character="pip"]').tap();
        await frame.locator('#start-flight').tap();
        await frame.locator('#demo-start').tap();
        await frame.evaluate(() => { score = 7; playerDead(); });
        await frame.locator('#scoreboard').waitFor({ state: 'visible' });
        await page.waitForTimeout(1300);
      } else if (game === 'hextris') {
        name = 'Hextris'; expectedScore = 842;
        await frame.locator('#startBtn').tap();
        await frame.evaluate(() => { gameState = 2; score = 842; highscores = [842]; gameOverDisplay(); });
        await page.waitForTimeout(600);
      } else {
        name = '0h h1'; expectedScore = 16;
        // A valid solved 4×4 board exercises the real puzzle-completion path.
        await frame.evaluate(() => {
          const full = [1,1,2,2, 1,2,1,2, 2,1,2,1, 2,2,1,1];
          Game.startGame({ size: 4, full, empty: full });
          Game.checkForLevelComplete();
        });
        await button.waitFor({ state: 'visible' });
        await page.waitForTimeout(600);
      }
      assert(await button.isVisible(), `${game}: the result has a share control`);
      const box = await button.boundingBox();
      assert(box.height >= 44, `${game}: accessible touch size`);
      if (game === 'ohhi') {
        const score = await frame.locator('#score').boundingBox();
        const back = await frame.locator('#bar [data-action="back"]').boundingBox();
        assert(score.y + score.height <= box.y, 'Logic score stays above the sharing control');
        assert(box.y + box.height <= back.y, 'Logic sharing does not overlap Back');
      }
      await page.screenshot({ path: `test-results/${game}-final-${viewport.width}.png` });
      await button.tap();
      await page.locator('#share-result-file:not([disabled])').waitFor({ state: 'visible' });
      const label = await page.locator('#result-share-preview').getAttribute('aria-label');
      assert(label.includes(`${expectedScore} points`) && label.includes(name), `${game}: image represents the game's final result`);
      const url = new URL(await page.locator('#result-whatsapp').getAttribute('href'));
      assert.equal(url.pathname, `/${event.whatsappNumber}`);
      assert(url.searchParams.get('text').includes(name));
      if (game === 'ohhi') assert(label.includes('4 × 4 puzzle completed'));
      if (game === 'flappy') assert(label.includes('Flown with Pip'), 'The shared result records the selected rider');
      await page.locator('#share-result-file').tap();
      const shared = await page.evaluate(() => window.sharedResult);
      assert.equal(shared.type, 'image/png');
      assert(shared.size > 10000);
      assert.equal(shared.title, `${name} result`);
      assert(shared.text.includes(`${expectedScore} points`));
      await page.locator('#close-result-share').tap();
      // Replay must hide the old final result and its sharing action.
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
      assert(await button.isHidden(), `${game}: replay clears the sharing control`);
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
  console.log('Broomstick Flyer, Hextris and 0h h1: final score buttons, PNG sharing, configured WhatsApp chat and replay passed in portrait and landscape.');
} finally { await browser.close(); }
