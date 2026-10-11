import { openChapter } from './browser-helpers.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf' };
let mount = '/';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    assert(pathname.startsWith(mount));
    let file = resolve(root, pathname.slice(mount.length) || '.');
    assert(file === root || file.startsWith(root + sep));
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const prefix of ['/', '/Birthday/']) {
    mount = prefix;
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    const page = await browser.newPage(prefix === '/Birthday/' ? { viewport: { width: 390, height: 844 } } : {});
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => failures.push(request.url()));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.locator('#welcome').isVisible(), 'Invitation opens with Vihaan’s name');
    assert.equal(await page.locator('#main > section:visible').count(), 1);
    await page.waitForFunction(() => [...document.querySelectorAll('.safari-home')].length === 5 && [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
    const homes = page.locator('.safari-home');
    assert.equal(await page.locator('.safari-fallback').count(), 0);
    assert.equal(await homes.count(), 5);
    assert.deepEqual(await homes.evaluateAll(homes => homes.map(home => home.dataset.state)), ['walk', 'sleep', 'eat', 'roll', 'play']);
    for (const [id, animal] of [['invitation', 'lion'], ['celebration', 'elephant'], ['venue', 'giraffe'], ['rsvp', 'tiger'], ['games', 'monkey']]) {
      await openChapter(page, `#${id}`);
      await page.waitForFunction(id => document.querySelector(`#${id} .safari-home`)?.dataset.painted === 'true' && document.querySelector(`#${id} .safari-home`)?.dataset.visible === 'true', id);
      const home = page.locator(`#${id} .safari-home`);
      assert.equal(await home.getAttribute('data-animal'), animal);
      const button = home.locator('button');
      const pose = await home.locator('canvas').evaluate(canvas => canvas.toDataURL());
      await page.waitForTimeout(250);
      assert.notEqual(await home.locator('canvas').evaluate(canvas => canvas.toDataURL()), pose, `${animal} visibly animates in its chapter`);
      await button.click();
      assert.equal(await button.getAttribute('data-gesture'), 'hello');
      const box = await home.boundingBox();
      assert(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= page.viewportSize().width);
    }
    assert(await page.locator('.hero-art img').evaluate(img => img.complete && img.naturalWidth > 0));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
    const stillPose = await page.locator('#games canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#games canvas').evaluate(canvas => canvas.toDataURL()), stillPose, 'Reduced motion stops canvas loops');
    assert.equal(await page.locator('#motion-toggle').count(), 0);
    await page.screenshot({ path: `test-results/story-production-${prefix === '/' ? 'desktop' : 'mobile'}.png` });
    if (prefix === '/') {
      const cold = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const requested = new Set();
      let releaseArtwork, assetsRequested;
      const artworkGate = new Promise(resolve => { releaseArtwork = resolve; });
      const allRequests = new Promise(resolve => { assetsRequested = resolve; });
      await cold.route('**/assets/animals/*.webp', async route => {
        requested.add(new URL(route.request().url()).pathname.split('/').pop());
        if (requested.size === 6) assetsRequested();
        await artworkGate;
        await route.continue();
      });
      await cold.goto(base, { waitUntil: 'domcontentloaded' });
      await allRequests;
      assert.equal(requested.size, 6, 'All five sheets and the tiger roll are requested at page open');
      assert.equal(await cold.locator('.safari-fallback').count(), 0, 'No substitute animal faces');
      assert(await cold.locator('.safari-friend').evaluateAll(buttons => buttons.length === 5 && buttons.every(button => button.disabled && getComputedStyle(button).visibility === 'hidden')), 'Unpainted animal controls stay hidden');
      releaseArtwork();
      await cold.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
      assert(await cold.locator('.safari-friend').evaluateAll(buttons => buttons.every(button => !button.disabled)));
      await cold.close();
      const missingArt = await browser.newPage();
      await missingArt.route('**/assets/animals/*.webp', route => route.abort());
      await missingArt.goto(base, { waitUntil: 'networkidle' });
      await missingArt.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === 'unavailable'));
      assert(await missingArt.locator('.safari-friend').evaluateAll(buttons => buttons.every(button => button.disabled && getComputedStyle(button).visibility === 'hidden')), 'Failed assets never introduce substitute faces');
      await openChapter(missingArt, '#rsvp');
      await missingArt.locator('#rsvp-button').click();
      assert(await missingArt.locator('#rsvp-dialog').isVisible(), 'Invitation still works if artwork is unavailable');
      await missingArt.close();
    }
    await page.locator('.gaming-shortcut').click();
    for (const game of ['taptaptap', 'hextris', 'ohhi', 'flappy']) {
      let releaseScript;
      const scriptGate = new Promise(resolve => { releaseScript = resolve; });
      const scriptPattern = `**/games/${game}/**/*.js`;
      await page.route(scriptPattern, async route => { await scriptGate; await route.continue(); });
      const loaded = page.waitForEvent('framenavigated', frame => frame.url() === `${base}games/${game}/index.html`);
      await page.locator(`[data-game="${game}"]`).click();
      await page.locator('.game-loading').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#game-frame-container').getAttribute('aria-busy'), 'true');
      assert(await page.locator('iframe').evaluate(frame => frame.inert));
      // An unrelated window must not be able to dismiss the loading hero.
      await page.evaluate(() => window.postMessage({ type: 'invitation:game-ready' }, '*'));
      assert(await page.locator('.game-loading').isVisible());
      if (game === 'taptaptap' && prefix === '/Birthday/') {
        await page.screenshot({ path: 'test-results/game-loading-mobile.png' });
      }
      releaseScript();
      const frame = await loaded;
      await frame.waitForLoadState('networkidle');
      await page.locator('.game-loading').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#game-frame-container').getAttribute('aria-busy'), null);
      assert.equal(await page.locator('iframe').evaluate(frame => frame.inert), false);
      await page.unroute(scriptPattern);
      assert(frame, `${prefix}: ${game} loaded under the correct path`);
      assert(await page.locator('iframe').isVisible());
      assert(await frame.locator('body').evaluate(body => body.children.length > 0));
      if (game === 'taptaptap') {
        await page.locator('#restart-game').click();
        await page.locator('.game-loading').waitFor({ state: 'visible' });
        await page.locator('.game-loading').waitFor({ state: 'detached' });
        await page.locator('#restart-game').click();
        await page.locator('.game-loading').waitFor({ state: 'visible' });
      }
      await page.locator('#close-game').click();
      await page.waitForFunction(() => !document.querySelector('iframe'));
    }
    await page.locator('#page-menu summary').click();
    await page.locator('.menu-credits').click();
    await page.waitForLoadState('networkidle');
    assert.equal(page.url(), `${base}credits.html`);
    const links = await page.locator('a').evaluateAll(links => links.map(link => link.href));
    for (const url of links.filter(url => url.startsWith(new URL(base).origin))) {
      assert(url.startsWith(base), `Link escapes repository path: ${url}`);
      const response = await page.request.get(url);
      assert(response.ok(), `Broken credits link: ${url}`);
    }
    await page.getByRole('link', { name: '← Back to the invitation' }).click();
    assert.equal(page.url(), base);
    assert.deepEqual(failures, [], `${prefix}: no missing assets or browser errors`);
    await page.close();
    console.log(`${prefix}: invitation, fonts, games, credits and source downloads passed`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
