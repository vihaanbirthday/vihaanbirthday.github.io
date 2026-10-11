import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
const page = await context.newPage();
const failures = [], external = [];
page.on('pageerror', e => {failures.push(e.message); console.log('ERROR',e.message)});
page.on('console', m => { if (m.type() === 'error') failures.push(m.text()); });
page.on('request', r => { if (!r.url().startsWith(base) && !/^(data|blob):/.test(r.url())) external.push(r.url()); });
await page.goto(base + '#games');
await page.locator('[data-game="taptaptap"]').scrollIntoViewIfNeeded();
assert.equal(await page.locator('[data-game]').count(), 4);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
for (const game of ['taptaptap', 'hextris', 'ohhi', 'flappy']) {
  const loaded = page.waitForEvent('framenavigated', frame => frame.url().includes(`/games/${game}/`));
  await page.locator(`[data-game="${game}"]`).tap();
  const frame = await loaded;
  await frame.waitForLoadState('load');
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  assert(frame, `${game}: iframe loaded`);
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  assert.equal(await frame.evaluate(() => { try { void parent.document.body; return false; } catch { return true; } }), true, `${game}: cannot read parent document`);
  if (game === 'taptaptap') {
    await frame.locator('#newGameBtn').tap();
    await frame.locator('#tutPgStartGameBtn').tap();
    await page.waitForTimeout(1800);
    const before = await frame.evaluate(() => gameEngine.score);
    await frame.locator('#gameSpace .good-circle').first().tap();
    assert((await frame.evaluate(() => gameEngine.score)) > before, 'Tap score increases with touch');
    await frame.locator('#gmStatsPauseBtn').tap();
    assert(await frame.locator('#pagePauseMenu').isVisible(), 'Tap pause works');
    await frame.locator('#pmCntnuGmBtn').tap();
  } else if (game === 'hextris') {
    await frame.locator('#startBtn').tap();
    await page.waitForTimeout(300);
    assert.equal(await frame.evaluate(() => gameState), 1, 'Hextris starts with touch');
    const position = await frame.evaluate(() => MainHex.position);
    await frame.locator('#canvas').tap({ position: { x: 35, y: 300 } });
    assert.notEqual(await frame.evaluate(() => MainHex.position), position, 'Hextris rotates with touch');
  } else if (game === 'ohhi') {
    await frame.locator('#title').tap();
    await frame.locator('#board').waitFor({ state: 'visible' });
    assert(await frame.locator('#board').isVisible(), 'Logic tutorial opens immediately');
    const tile = frame.locator('#board .tile:not(.tile-1):not(.tile-2)').first();
    console.log('Oh hi board tiles', await frame.locator('#board .tile').count());
    if (await tile.count()) { const before = await tile.getAttribute('class'); await tile.tap(); assert.notEqual(await tile.getAttribute('class'), before, 'Logic tile responds to touch'); }
  } else {
    await frame.locator('[data-character="lumi"]').tap();
    await frame.locator('#start-flight').tap();
    await frame.locator('#demo-start').tap();
    await frame.locator('#flyarea').tap({ position: { x: 100, y: 180 } });
    assert.equal(await frame.evaluate(() => currentstate), 1, 'Broomstick starts with touch');
    await page.waitForTimeout(250);
    await frame.locator('#flyarea').tap({ position: { x: 100, y: 180 } });
    assert((await frame.evaluate(() => velocity)) < 0, 'Broomstick lifts on touch');
    await page.waitForTimeout(3000);
    assert.equal(await frame.evaluate(() => currentstate), 2, 'Broomstick reaches game over');
    await frame.locator('#replay').tap();
    await page.waitForTimeout(1200);
    assert.equal(await frame.evaluate(() => currentstate), 0, 'Broomstick replay returns to ready screen');
  }
  await page.waitForTimeout(650);
  await page.screenshot({ path: `test-results/${game}.png` });
  await page.locator('#restart-game').tap();
  await page.waitForTimeout(300);
  await page.locator('#close-game').tap();
  await page.waitForFunction(() => !document.querySelector('iframe'));
  assert.equal(await page.locator('iframe').count(), 0, 'Closing unloads game');
  console.log(`${game}: touch gameplay, isolation, restart and close passed`);
}
await page.locator('#games').scrollIntoViewIfNeeded();
await page.screenshot({ path: 'test-results/four-games-mobile.png', fullPage: true });
for (const width of [320, 768, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No horizontal overflow at ${width}px`);
}
await page.screenshot({ path: 'test-results/four-games-desktop.png', fullPage: true });
await browser.close();
assert.deepEqual(external, [], 'No external requests');
assert.deepEqual(failures, [], 'No browser errors');
console.log('All four games passed production mobile browser tests.');
