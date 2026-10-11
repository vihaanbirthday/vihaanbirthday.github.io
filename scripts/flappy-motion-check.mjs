import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ ...devices['iPhone 13'] });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#games');
  await page.locator('[data-game="flappy"]').tap();
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  const frame = page.frames().find(frame => frame.url().includes('/games/flappy/'));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await frame.locator('[data-character="harry"]').tap();
  await frame.locator('#start-flight').tap();
  const pose = () => frame.evaluate(() => {
    const matrix = new DOMMatrix(getComputedStyle(document.getElementById('player')).transform);
    return { rotation, rendered: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, position, velocity, state: currentstate };
  });
  // Put the bird in a steep dive with room to recover, then use a real touch.
  await frame.evaluate(() => {
    velocity = 10; rotation = 90; position = 100;
    updatePlayer($('#player'), 0);
  });
  const before = await pose();
  await frame.locator('#flyarea').tap({ position: { x: 100, y: 180 } });
  const tapped = await pose();
  assert.equal(tapped.velocity, -4.6, 'A tap applies lift immediately');
  assert.equal(tapped.rendered, before.rendered, 'A tap does not snap the rendered nose angle');
  const samples = [tapped];
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(16);
    samples.push(await pose());
  }
  assert(samples.every(pose => pose.state === 1), 'The bird survives the recovery');
  assert(samples.slice(1).every((pose, i) => Math.abs(pose.rendered - samples[i].rendered) < 30), 'The dive-to-climb turn progresses without a large angle jump');
  assert(samples[1].position < tapped.position, 'The bird starts climbing on the next frame');
  assert(samples.at(-1).rendered < 0, 'The nose reaches an upward angle during the climb');
  await page.screenshot({ path: 'test-results/flappy-smooth-recovery.png' });
  // Compare equal elapsed time at 60 Hz and 120 Hz, including flight distance.
  const rates = await frame.evaluate(() => {
    cancelAnimationFrame(loopGameloop);
    clearInterval(loopPipeloop);
    pipes = [];
    $('.pipe').remove();
    function simulate(steps, count) {
      rotation = 90; velocity = jump; position = 100;
      for (let i = 0; i < count; i++) gameloop(steps);
      return { rotation, velocity, position };
    }
    return [simulate(1, 12), simulate(.5, 24)];
  });
  assert(Math.abs(rates[0].rotation - rates[1].rotation) < 1, 'Turning takes the same time at 60 and 120 Hz');
  assert(Math.abs(rates[0].position - rates[1].position) < 0.001, 'Refresh rate does not change flight distance');
  await frame.evaluate(() => { playerDead(); });
  await page.clock.runFor(1500);
  assert.equal((await pose()).state, 2);
  assert(await frame.locator('#share-final-score').isVisible(), 'Game over still offers final score sharing');
  await frame.locator('#replay').tap();
  await page.clock.runFor(1200);
  assert.equal((await pose()).state, 0);
  assert(Math.abs((await pose()).rendered) < 0.001, 'Replay resets the bird to a level pose');
  assert.deepEqual(errors, []);
  console.log('Hogwarts Flyer: gradual rendered dive-to-climb turn, immediate lift, refresh-rate consistency, game over, sharing and replay passed.');
} finally { await browser.close(); }
