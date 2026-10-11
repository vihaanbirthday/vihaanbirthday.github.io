import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    const desktop = viewport.width === 1440;
    const page = await browser.newPage({ ...(desktop ? {} : devices['iPhone 13']), viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(base + '#games');
    await page.locator('[data-game="flappy"]').click();
    await page.locator('.game-loading').waitFor({ state: 'detached' });
    const frame = page.frames().find(frame => frame.url().includes('/games/flappy/'));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    assert.equal(await frame.locator('.character-option').count(), 3);
    assert(await frame.locator('#start-flight').isDisabled());
    await frame.locator('h1').click();
    await page.keyboard.press('Space');
    await frame.evaluate(() => { startGame(); selectCharacter('unknown'); });
    assert.equal(await frame.evaluate(() => currentstate), 0, 'No takeoff before an explicit choice');
    assert.equal(await frame.evaluate(() => selectedCharacter), null);
    for (const [character, name] of [['nova', 'Nova'], ['pip', 'Pip'], ['lumi', 'Lumi']]) {
      const option = frame.locator(`[data-character="${character}"]`);
      if (desktop) {
        await option.focus();
        await page.keyboard.press('Space');
      } else await option.tap();
      await page.clock.runFor(250);
      assert.equal(await frame.evaluate(() => currentstate), 0, 'Choosing never starts flight');
      assert.equal(await option.getAttribute('aria-pressed'), 'true');
      assert.equal(await frame.locator('[aria-pressed="true"]').count(), 1);
      assert.equal(await frame.locator('#player img').getAttribute('src'), `art/${character}.svg`);
      assert((await frame.locator('#start-flight').textContent()).includes(name));
      assert(await frame.locator('.character-option img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), 'All character artwork loaded');
      const bounds = await frame.locator('#start-flight').boundingBox();
      const area = await frame.locator('#flyarea').boundingBox();
      assert(bounds.height >= 44 && bounds.y >= area.y && bounds.y + bounds.height <= area.y + area.height, 'Takeoff fits the play area');
      assert(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, 'Takeoff is visible within the device screen');
      assert.equal(await page.locator('#game-dialog').evaluate(dialog => dialog.scrollHeight > dialog.clientHeight), false, 'The game dialog fits the device screen');
      const layout = await frame.evaluate(() => ({ width: innerWidth, scroll: document.querySelector('#splash').scrollWidth, height: document.querySelector('#splash').clientHeight, content: document.querySelector('#splash').scrollHeight }));
      assert(layout.scroll <= layout.width && layout.content <= layout.height, `Selection fits at ${viewport.width}px: ${JSON.stringify(layout)}`);
      await page.screenshot({ path: `test-results/sky-garden-${character}-${viewport.width}.png` });
      if (desktop) {
        await frame.locator('#start-flight').focus();
        await page.keyboard.press('Enter');
      } else await frame.locator('#start-flight').tap();
      assert.equal(await frame.evaluate(() => currentstate), 1);
      assert.equal(await frame.evaluate(() => velocity), -4.6);
      assert(await frame.locator('#splash').isHidden());
      assert.equal(await frame.locator('#rider-name').textContent(), name);
      await page.clock.runFor(64);
      if (desktop) await page.keyboard.press('Space');
      else await frame.locator('#flyarea').tap({ position: { x: 20, y: 90 } });
      assert.equal(await frame.evaluate(() => velocity), -4.6, 'Flight input supplies lift');
      // Pass a real generated tower, then hit the next one to verify scoring and collision with the larger rider.
      const scored = await frame.evaluate(() => {
        updatePipes();
        pipes[0].css({ left: '-30px', animation: 'none' });
        pipes[0].find('.pipe_upper').height(40);
        pipes[0].find('.pipe_lower').height(flyArea - pipeheight - 40);
        position = 55; velocity = 0; rotation = 0;
        gameloop(0);
        return { score, state: currentstate };
      });
      assert.deepEqual(scored, { score: 1, state: 1 }, 'Clearing a tower earns one point');
      await frame.evaluate(() => {
        updatePipes();
        pipes[0].css({ left: '60px', animation: 'none' });
        pipes[0].find('.pipe_upper').height(100);
        position = 10; velocity = 0; rotation = 0;
        gameloop(0);
      });
      await page.clock.runFor(1400);
      assert.equal(await frame.evaluate(() => currentstate), 2, 'Tower collision ends the flight');
      assert.equal(await frame.locator('#currentscore').textContent(), '1');
      assert.equal(await frame.locator('#result-character').textContent(), `Flown with ${name}`);
      if (character === 'lumi') await page.screenshot({ path: `test-results/sky-garden-result-${viewport.width}.png` });
      await frame.locator('#replay').click();
      await page.clock.runFor(1200);
      assert.equal(await frame.evaluate(() => currentstate), 0);
      assert(await frame.locator('#splash').isVisible(), 'Replay offers character selection');
      assert(await frame.locator('#share-final-score').isHidden());
    }
    await page.clock.resume();
    await page.locator('#restart-game').click();
    await page.locator('.game-loading').waitFor({ state: 'detached' });
    const restarted = page.frames().find(frame => frame.url().includes('/games/flappy/'));
    assert(await restarted.locator('#start-flight').isDisabled(), 'Restart requires a fresh choice');
    await page.locator('#close-game').click();
    await page.waitForFunction(() => !document.querySelector('iframe'));
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Broomstick Flyer: all three riders, required selection, touch/keyboard flight, tower scoring/collision, replay, restart and responsive layouts passed.');
} finally { await browser.close(); }
