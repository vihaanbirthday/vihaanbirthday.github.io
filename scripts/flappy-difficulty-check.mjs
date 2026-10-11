import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ ...devices['iPhone 13'], viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#games');
    await page.locator('[data-game="flappy"]').tap();
    await page.locator('.game-loading').waitFor({ state: 'detached' });
    const frame = page.frames().find(frame => frame.url().includes('/games/flappy/'));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await frame.locator('[data-character="pip"]').tap();
    await frame.locator('#start-flight').tap();
    const pose = () => frame.locator('#demo-rider').evaluate(el => ({ top: el.style.top, transform: el.style.transform }));
    const initial = await pose();
    await page.clock.runFor(800);
    assert.deepEqual(await pose(), initial, 'Reduced-motion demo uses still poses, not continuous movement');
    await page.clock.runFor(1400);
    assert.notDeepEqual(await pose(), initial, 'Still poses advance with the instructional steps');
    await frame.locator('#demo-start').tap();
    const samples = await frame.evaluate(() => {
      cancelAnimationFrame(loopGameloop);
      const values = [];
      for (const target of [0, 10, 20, 40, 400]) {
        score = target;
        updateDifficulty();
        $('.pipe').remove(); pipes = [];
        const difficulty = getDifficulty(score);
        for (let i = 0; i < 80; i++) updatePipes();
        const gaps = pipes.map(pipe => ({ gap: Number(pipe.attr('data-gap')), upper: pipe.children('.pipe_upper').outerHeight(), lower: pipe.children('.pipe_lower').outerHeight() }));
        values.push({ score, ...difficulty, gaps, area: flyArea });
      }
      $('.pipe').remove(); pipes = [];
      return values;
    });
    for (const sample of samples) {
      assert(sample.gap >= 82, 'Even the hardest gap fits the rider with clearance');
      for (let i = 0; i < sample.gaps.length; i++) {
        const tower = sample.gaps[i];
        assert(Math.abs(tower.upper + tower.lower + tower.gap - sample.area) < 1, 'Rendered tower heights match the collision gap');
        if (i) assert(Math.abs(tower.upper - sample.gaps[i - 1].upper) <= Math.min(65, sample.area * .2) + 1, 'Consecutive gaps remain reachable');
      }
    }
    for (let i = 1; i < 4; i++) {
      assert(samples[i].speed > samples[i - 1].speed, 'Higher scores increase tower speed');
      assert(samples[i].gap < samples[i - 1].gap, 'Higher scores narrow new gaps');
    }
    assert.equal(samples[3].gap, samples[4].gap, 'Gap difficulty is capped');
    assert.equal(samples[3].speed, samples[4].speed, 'Speed difficulty is capped');
    const movement = await frame.evaluate(() => {
      function travel(points, steps, count) {
        score = points; updateDifficulty(); towerElapsedMs = 0;
        $('.pipe').remove(); pipes = []; updatePipes();
        pipes[0].css('left', '900px');
        for (let i = 0; i < count; i++) {
          position = flyArea * .4; velocity = 0; rotation = 0;
          gameloop(steps);
        }
        return 900 - parseFloat(pipes[0][0].style.left);
      }
      const distances = [travel(0, 1, 60), travel(40, 1, 60), travel(40, .5, 120)];
      score = 0; updateDifficulty(); $('.pipe').remove(); pipes = []; updatePipes();
      const firstGap = Number(pipes[0].attr('data-gap'));
      for (let i = 0; i < 40; i++) playerScore();
      const keptGap = Number(pipes[0].attr('data-gap'));
      updatePipes();
      return { distances, firstGap, keptGap, nextGap: Number(pipes[1].attr('data-gap')) };
    });
    assert(Math.abs(movement.distances[0] - 110) < .01, 'Opening towers travel at the intended gentle speed');
    assert(Math.abs(movement.distances[1] - 170) < .01, 'High scores increase actual rendered movement');
    assert(Math.abs(movement.distances[1] - movement.distances[2]) < .01, 'Tower speed is independent of refresh rate');
    assert.equal(movement.firstGap, movement.keptGap, 'Scoring never shrinks a visible gap');
    assert(movement.nextGap < movement.firstGap, 'Subsequent towers use the increased difficulty');
    await frame.evaluate(() => playerDead());
    await page.clock.runFor(1500);
    assert.equal(await frame.locator('#currentscore').textContent(), '40');
    await frame.locator('#replay').tap();
    await page.clock.runFor(1200);
    assert.deepEqual(await frame.evaluate(() => ({ score, gap: pipeheight, initial: baseGap, elapsed: towerElapsedMs })), { score: 0, gap: samples[0].gap, initial: samples[0].gap, elapsed: 0 }, 'Replay resets difficulty and tower scheduling');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Broomstick Flyer: reduced-motion demo, increasing difficulty, reachable gaps, fixed visible gaps, capped speed, refresh-rate consistency and replay reset passed.');
} finally { await browser.close(); }
