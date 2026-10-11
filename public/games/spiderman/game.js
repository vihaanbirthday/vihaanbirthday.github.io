'use strict';
const $ = id => document.getElementById(id);
const canvas = $('rooftops'), ctx = canvas.getContext('2d');
const rooftopGame = { state: 'menu', lane: 1, webs: 0, hearts: 3, score: 0, time: 45, items: [], elapsed: 0, spawn: 0 };
const art = {};
let frame = 0, previous = 0, best = 0;
function show(id) {
  for (const section of document.querySelectorAll('main > section')) { section.hidden = section.id !== id; section.inert = section.hidden; }
}
function stats() {
  $('progress').textContent = `${rooftopGame.webs} / 12 webs`;
  $('score').textContent = `${rooftopGame.score} points`;
  $('time').textContent = `${Math.ceil(rooftopGame.time)}s`;
  $('hearts').textContent = '♥'.repeat(rooftopGame.hearts) + '♡'.repeat(3 - rooftopGame.hearts);
  $('hearts').setAttribute('aria-label', `${rooftopGame.hearts} hearts remaining`);
}
function draw() {
  // Match the canvas backing ratio to its CSS box so sprites stay in proportion.
  const box = canvas.getBoundingClientRect();
  const height = Math.max(140, Math.round(360 * box.height / box.width));
  if (canvas.height !== height) canvas.height = height;
  ctx.clearRect(0, 0, 360, height);
  ctx.drawImage(art.city, 0, 0, 360, height);
  ctx.fillStyle = '#13213bad'; ctx.fillRect(0, 0, 360, height);
  for (let lane = 0; lane < 3; lane++) {
    ctx.fillStyle = lane === rooftopGame.lane ? '#6598cc35' : '#273c5c55';
    ctx.fillRect(lane * 120 + 5, 0, 110, height);
    ctx.strokeStyle = '#c7e4ff35'; ctx.setLineDash([6, 12]); ctx.beginPath(); ctx.moveTo(lane * 120, 0); ctx.lineTo(lane * 120, height); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const item of rooftopGame.items) ctx.drawImage(art[item.type], item.lane * 120 + 35, item.y / 400 * height - 25, 50, 50);
  const size = Math.min(112, height * .4), center = rooftopGame.lane * 120 + 60;
  ctx.drawImage(art.hero, center - size / 2, height * .78 - size / 2, size, size);
  ctx.strokeStyle = '#e4f4ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(center, height * .78 - size * .22); ctx.lineTo(center + 25, height * .78 - size * .65); ctx.stroke();
}
function move(lane) {
  if (rooftopGame.state !== 'playing') return;
  rooftopGame.lane = Math.max(0, Math.min(2, lane)); draw();
}
function finish() {
  rooftopGame.state = 'result'; cancelAnimationFrame(frame);
  const won = rooftopGame.webs === 12;
  if (won) rooftopGame.score += Math.ceil(rooftopGame.time) * 5;
  best = Math.max(best, rooftopGame.score);
  $('result-title').textContent = won ? 'New York is safe!' : rooftopGame.hearts ? 'Time for another swing!' : 'A brave effort!';
  $('result-detail').textContent = `${rooftopGame.webs}/12 webs collected · Best this visit: ${best}`;
  $('result-score').textContent = `${rooftopGame.score} points`;
  show('result'); $('again').focus();
}
function update(delta) {
  rooftopGame.elapsed += delta; rooftopGame.time = Math.max(0, rooftopGame.time - delta); rooftopGame.spawn -= delta;
  if (rooftopGame.spawn <= 0) {
    // Each wave leaves a safe lane, and its web and bomb never share a lane.
    const webLane = Math.floor(Math.random() * 3);
    const bombLane = (webLane + 1 + Math.floor(Math.random() * 2)) % 3;
    rooftopGame.items.push({ lane: webLane, y: -25, type: 'web' }, { lane: bombLane, y: -25, type: 'pumpkin' });
    rooftopGame.spawn = Math.max(.95, 1.5 - rooftopGame.elapsed / 90);
  }
  const speed = 100 + Math.min(65, rooftopGame.elapsed * 2);
  for (const item of rooftopGame.items) {
    const before = item.y; item.y += speed * delta;
    if (!item.caught && before < 324 && item.y >= 300 && item.lane === rooftopGame.lane) {
      item.caught = true;
      if (item.type === 'web') { rooftopGame.webs++; rooftopGame.score += 25; $('feedback').textContent = 'Web collected! +25 points'; }
      else { rooftopGame.hearts--; $('feedback').textContent = 'Pumpkin bomb! −1 heart. Try another lane.'; }
      if (!rooftopGame.hearts || rooftopGame.webs === 12) { finish(); return; }
    }
  }
  rooftopGame.items = rooftopGame.items.filter(item => !item.caught && item.y < 430);
  stats();
  if (!rooftopGame.time) finish();
}
function loop(now) {
  if (rooftopGame.state !== 'playing') return;
  update(Math.min(.05, (now - previous) / 1000)); previous = now; draw();
  if (rooftopGame.state === 'playing') frame = requestAnimationFrame(loop);
}
function start() {
  cancelAnimationFrame(frame);
  Object.assign(rooftopGame, { state: 'playing', lane: 1, webs: 0, hearts: 3, score: 0, time: 45, items: [], elapsed: 0, spawn: .8 });
  show('play'); stats(); draw(); $('feedback').textContent = 'Collect blue webs. Avoid orange bombs.'; canvas.focus();
  previous = performance.now(); frame = requestAnimationFrame(loop);
}
function pause() {
  if (rooftopGame.state !== 'playing') return;
  rooftopGame.state = 'paused'; cancelAnimationFrame(frame); show('paused'); $('resume').focus();
}
$('start').addEventListener('click', start); $('again').addEventListener('click', start);
$('left').addEventListener('click', () => move(rooftopGame.lane - 1)); $('right').addEventListener('click', () => move(rooftopGame.lane + 1));
canvas.addEventListener('pointerdown', event => { event.preventDefault(); const box = canvas.getBoundingClientRect(); move(Math.floor((event.clientX - box.left) / (box.width / 3))); });
document.addEventListener('keydown', event => {
  if (rooftopGame.state !== 'playing') return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(rooftopGame.lane + (event.key === 'ArrowLeft' ? -1 : 1)); }
  if (event.key.toLowerCase() === 'p') pause();
});
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', () => { if (rooftopGame.state !== 'paused') return; rooftopGame.state = 'playing'; show('play'); canvas.focus(); previous = performance.now(); frame = requestAnimationFrame(loop); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('share').addEventListener('click', () => { if (rooftopGame.state === 'result') window.invitationShareResult({ score: rooftopGame.score, best, webs: rooftopGame.webs, won: rooftopGame.webs === 12 }); });
Promise.all(['city', 'hero', 'web', 'pumpkin'].map(name => new Promise((resolve, reject) => { const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = `art/${name}.svg`; art[name] = img; }))).then(() => { show('menu'); window.invitationGameReady(); });
