import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(base) && !/^(data|blob):/.test(request.url())) external.push(request.url()); });
  await page.goto(base + '/#games');
  async function open(game) {
    await page.locator(`[data-game="${game}"]`).tap();
    await page.locator('.game-loading').waitFor({ state: 'detached' });
    return page.frames().find(frame => frame.url().includes(`/games/${game}/`));
  }
  async function share() {
    await page.locator('#result-share-dialog').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#download-result-file').href.startsWith('blob:'));
    await page.locator('#close-result-share').tap();
  }
  for (const game of ['taptaptap', 'hextris', 'ohhi']) {
    const frame = await open(game);
    assert.equal(await frame.evaluate(() => [...document.images].filter(image => image.getAttribute('src')?.startsWith('art/')).every(image => image.complete && image.naturalWidth > 0)), true);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/theme-${game}-phone.png` });
    if (game === 'hextris') assert.deepEqual(await frame.evaluate(() => colors), ['#a46bd5', '#f1b949', '#388dcc', '#35b7ab']);
    if (game === 'ohhi') {
      await frame.locator('#title').tap();
      await frame.locator('#board').waitFor({ state: 'visible' });
      assert((await frame.locator('#board .tile-1 .inner').first().evaluate(el => getComputedStyle(el).backgroundImage)).includes('sail.svg'));
      assert((await frame.locator('#board .tile-2 .inner').first().evaluate(el => getComputedStyle(el).backgroundImage)).includes('heart.svg'));
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'test-results/theme-moana-play.png' });
    }
    await page.locator('#close-game').tap();
  }
  let frame = await open('spiderman');
  await frame.locator('#start').tap();
  await frame.locator('#rooftops').tap({ position: { x: 25, y: 150 } });
  assert.equal(await frame.evaluate(() => rooftopGame.lane), 0);
  await frame.locator('#right').tap();
  assert.equal(await frame.evaluate(() => rooftopGame.lane), 1);
  await frame.locator('#rooftops').press('ArrowRight');
  assert.equal(await frame.evaluate(() => rooftopGame.lane), 2);
  // Place real collectible/hazard sprites immediately ahead of the collision line.
  // The normal animation loop performs collision, scoring and ending transitions.
  await frame.evaluate(() => { rooftopGame.items = [{ lane: 2, y: 299, type: 'web' }]; rooftopGame.spawn = 10; });
  await frame.waitForFunction(() => rooftopGame.webs === 1);
  assert.equal(await frame.evaluate(() => rooftopGame.score), 25);
  await frame.evaluate(() => { rooftopGame.items = [{ lane: 2, y: 299, type: 'pumpkin' }]; });
  await frame.waitForFunction(() => rooftopGame.hearts === 2);
  await frame.locator('#pause').tap();
  const time = await frame.evaluate(() => rooftopGame.time);
  await page.waitForTimeout(250);
  assert.equal(await frame.evaluate(() => rooftopGame.time), time);
  await frame.locator('#resume').tap();
  await frame.evaluate(() => { rooftopGame.webs = 11; rooftopGame.items = [{ lane: 2, y: 299, type: 'web' }]; });
  await frame.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await frame.locator('#result-title').textContent(), 'New York is safe!');
  await frame.locator('#share').tap(); await share();
  await frame.locator('#again').tap();
  assert.equal(await frame.evaluate(() => rooftopGame.score), 0);
  for (let i = 2; i >= 0; i--) {
    await frame.evaluate(() => { rooftopGame.items = [{ lane: rooftopGame.lane, y: 299, type: 'pumpkin' }]; rooftopGame.spawn = 10; });
    await frame.waitForFunction(hearts => rooftopGame.hearts === hearts, i);
  }
  assert.equal(await frame.locator('#result-title').textContent(), 'A brave effort!');
  await frame.locator('#again').tap();
  await frame.evaluate(() => { rooftopGame.time = .01; });
  await frame.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await frame.locator('#result-title').textContent(), 'Time for another swing!');
  await frame.locator('#again').tap();
  await page.screenshot({ path: 'test-results/theme-spiderman-play.png' });
  await page.locator('#close-game').tap();
  frame = await open('toystory'); await frame.locator('#start').tap();
  let deck = await frame.evaluate(() => memoryGame.deck);
  assert.equal(deck.length, 12); assert.equal(new Set(deck).size, 6);
  for (const toy of new Set(deck)) assert.equal(deck.filter(value => value === toy).length, 2);
  const other = deck.findIndex(toy => toy !== deck[0]);
  await frame.locator('.toy-card').nth(0).tap(); await frame.locator('.toy-card').nth(other).tap();
  assert.equal(await frame.locator('.flipped').count(), 2);
  const third = deck.findIndex((_, index) => index !== 0 && index !== other);
  await frame.locator('.toy-card').nth(third).tap();
  assert.equal(await frame.locator('.flipped').count(), 2, 'A third card cannot open while the pair is being compared');
  await frame.waitForFunction(() => memoryGame.open.length === 0);
  assert.equal(await frame.locator('.flipped').count(), 0);
  await frame.locator('#reset').tap();
  assert.equal(await frame.evaluate(() => memoryGame.moves), 0);
  deck = await frame.evaluate(() => memoryGame.deck);
  for (const toy of new Set(deck)) {
    const indices = deck.flatMap((value, i) => value === toy ? [i] : []);
    for (const i of indices) await frame.locator('.toy-card').nth(i).tap();
  }
  await frame.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await frame.evaluate(() => memoryGame.score), 702);
  await frame.locator('#share').tap(); await share();
  await frame.locator('#again').tap();
  assert.equal(await frame.evaluate(() => memoryGame.pairs), 0);
  // Real face artwork is rendered and loaded, including all six toys.
  assert.equal(await frame.locator('.toy-card img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
  await frame.locator('.toy-card').nth(0).tap();
  await page.screenshot({ path: 'test-results/theme-toystory-play.png' });
  await page.locator('#close-game').tap();
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const game of ['spiderman', 'toystory']) {
      frame = await open(game);
      await frame.locator('#start').click();
      assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await frame.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1), false, `${game} fits ${width}×${height}`);
      await page.screenshot({ path: `test-results/${game}-${width}.png` });
      await page.locator('#close-game').click();
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  // The Harry Potter implementation and its SVG files are excluded from edits.
  const hp = await readFile('public/games/flappy/index.html', 'utf8');
  assert(hp.includes('Hogwarts Flyer'));
  console.log('Themes, mobile/desktop layouts, rescue controls/collisions/endings, toy matching/reset, and both result shares passed.');
} finally { await browser.close(); }
