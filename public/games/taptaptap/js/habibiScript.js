/* Birthday challenge adaptation of Tap Tap Tap by Mahdi Al-Farra (MIT).
   Eight designed rounds, fair non-overlapping targets, hearts, streaks and bonuses.
   All progress lives in memory and disappears when the frame is closed. */
'use strict';
const $ = id => document.getElementById(id);
const levels = [
  { name: 'Find your rhythm', goal: 12, time: 30, reds: 1 },
  { name: 'Double the fun', goal: 16, time: 30, reds: 2 },
  { name: 'Follow the sparkle', goal: 20, time: 30, reds: 2 },
  { name: 'On a roll', goal: 24, time: 32, reds: 3 },
  { name: 'Quick fingers', goal: 28, time: 32, reds: 3 },
  { name: 'Keep your cool', goal: 32, time: 34, reds: 4 },
  { name: 'Almost there', goal: 36, time: 34, reds: 4 },
  { name: 'The grand finale', goal: 42, time: 38, reds: 5 },
];
const gameEngine = { score: 0, levelNum: 1, tapNum: 0, tapsGoal: 12, lives: 3, streak: 0, state: 'menu', timeLeft: 30 };
let tick = 0, countdown = 0, previousTime = 0, roundScore = 0, pendingStar = false, best = 0, resumeState = 'playing';
function show(id) {
  document.querySelectorAll('.page-cont').forEach(page => { page.hidden = page.id !== id; page.inert = page.hidden; });
}
function stopClock() { cancelAnimationFrame(tick); tick = 0; clearTimeout(countdown); }
function updateStats() {
  const level = levels[gameEngine.levelNum - 1];
  $('gmStatsLvlNumb').textContent = `LEVEL ${gameEngine.levelNum} OF ${levels.length}`;
  $('levelName').textContent = level.name;
  $('gmStatsScore').textContent = gameEngine.score;
  $('gmStatsCurrentTapCount').textContent = gameEngine.tapNum;
  $('gmStatsTotalTapCount').textContent = `/${level.goal}`;
  $('timeLeft').textContent = `${Math.ceil(gameEngine.timeLeft)}s`;
  $('gmStatsTimeProgress').style.width = `${Math.min(100, Math.max(0, gameEngine.timeLeft / level.time * 100))}%`;
  $('hearts').textContent = '♥'.repeat(gameEngine.lives) + '♡'.repeat(3 - gameEngine.lives);
  $('hearts').setAttribute('aria-label', `${gameEngine.lives} hearts remaining`);
  const multiplier = Math.min(3, 1 + Math.floor(gameEngine.streak / 5));
  $('combo').textContent = gameEngine.streak ? `${gameEngine.streak} streak · ${multiplier}× points` : 'Find your rhythm';
  $('levelProgress').textContent = `${gameEngine.levelNum} / ${levels.length}`;
}
function clock(now) {
  if (gameEngine.state !== 'playing') return;
  gameEngine.timeLeft = Math.max(0, gameEngine.timeLeft - (now - previousTime) / 1000);
  previousTime = now;
  updateStats();
  if (gameEngine.timeLeft <= 0) lose('Time’s up.');
  else tick = requestAnimationFrame(clock);
}
function runClock() { previousTime = performance.now(); tick = requestAnimationFrame(clock); }
function announce(text) { $('feedback').textContent = text; }
function targets() {
  const space = $('gameSpace');
  space.replaceChildren();
  const level = levels[gameEngine.levelNum - 1];
  // A grid guarantees that targets never overlap, even on a small phone.
  const columns = Math.max(2, Math.floor(space.clientWidth / 88));
  const rows = Math.max(1, Math.floor(space.clientHeight / 88));
  const cells = Array.from({ length: columns * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const blues = Math.min(2, cells.length - (pendingStar ? 1 : 0));
  const types = [...Array(blues).fill('good'), ...(pendingStar ? ['bonus'] : []), ...Array(Math.min(level.reds, cells.length - blues - (pendingStar ? 1 : 0))).fill('evil')];
  const cellWidth = space.clientWidth / columns, cellHeight = space.clientHeight / rows;
  const size = Math.min(gameEngine.levelNum > 5 ? 62 : 70, cellWidth - 12, cellHeight - 12);
  types.forEach((type, index) => {
    const cell = cells[index], button = document.createElement('button');
    button.className = `tpbl-circle ${type}-circle ${type === 'good' ? 'blue' : type === 'evil' ? 'red' : 'gold'}`;
    button.textContent = type === 'good' ? '+' : type === 'evil' ? '×' : '★';
    button.setAttribute('aria-label', type === 'good' ? 'Blue target' : type === 'evil' ? 'Red hazard' : 'Gold bonus star');
    button.style.setProperty('--target-size', `${size}px`);
    const jitterX = Math.random() * Math.max(0, cellWidth - size - 12), jitterY = Math.random() * Math.max(0, cellHeight - size - 12);
    button.style.left = `${(cell % columns) * cellWidth + 6 + jitterX}px`;
    button.style.top = `${Math.floor(cell / columns) * cellHeight + 6 + jitterY}px`;
    button.addEventListener('click', () => tap(type));
    space.append(button);
  });
}
function tap(type) {
  if (gameEngine.state !== 'playing') return;
  if (type === 'evil') {
    gameEngine.lives--;
    gameEngine.streak = 0;
    gameEngine.timeLeft = Math.max(0, gameEngine.timeLeft - 3);
    announce('Red caught you! −1 heart · −3 seconds');
    updateStats();
    if (!gameEngine.lives || !gameEngine.timeLeft) { lose(gameEngine.lives ? 'Time’s up.' : 'Out of hearts.'); return; }
  } else if (type === 'bonus') {
    pendingStar = false;
    gameEngine.timeLeft += 3;
    gameEngine.score += 50;
    announce('Golden catch! +3 seconds · +50 points');
  } else {
    gameEngine.tapNum++;
    gameEngine.streak++;
    gameEngine.score += 10 * Math.min(3, 1 + Math.floor(gameEngine.streak / 5));
    if (gameEngine.tapNum >= gameEngine.tapsGoal) { pass(); return; }
    if (gameEngine.tapNum % 5 === 0) { pendingStar = true; announce('A gold star appeared! Catch it for extra time.'); }
    else announce(gameEngine.streak >= 5 ? 'Keep that streak going!' : 'Nice tap. Keep going!');
  }
  updateStats(); targets();
}
function beginRound() {
  stopClock();
  const level = levels[gameEngine.levelNum - 1];
  roundScore = gameEngine.score;
  gameEngine.tapNum = 0; gameEngine.tapsGoal = level.goal; gameEngine.timeLeft = level.time;
  pendingStar = false;
  gameEngine.state = 'countdown';
  $('countdownLevel').textContent = `LEVEL ${gameEngine.levelNum} OF ${levels.length}`;
  $('countdownName').textContent = level.name;
  $('countdownGoal').textContent = `${level.goal} blue taps · ${level.time} seconds`;
  show('pagePlayDelay');
  let number = 3;
  function step() {
    if (gameEngine.state !== 'countdown') return;
    if (!number) {
      gameEngine.state = 'playing'; show('pagePlayArea');
      updateStats(); targets(); announce('Tap blue + · Avoid red × · Catch gold ★'); runClock(); return;
    }
    $('playDelayNum').textContent = number--;
    countdown = setTimeout(step, 400);
  }
  step();
}
function newRun() {
  stopClock();
  Object.assign(gameEngine, { score: 0, levelNum: 1, lives: 3, streak: 0, state: 'tutorial' });
  show('pageTutorial');
}
function pass() {
  stopClock(); gameEngine.state = 'between';
  const bonus = Math.ceil(gameEngine.timeLeft) * 5;
  gameEngine.score += bonus;
  best = Math.max(best, gameEngine.score);
  const finished = gameEngine.levelNum === levels.length;
  $('lvlPssdTtl').textContent = `LEVEL ${gameEngine.levelNum} COMPLETE`;
  $('passedHeading').textContent = finished ? 'You lit up the party!' : 'Beautifully done.';
  $('levelSummary').textContent = finished ? `Eight levels cleared · Session best: ${best}` : `Next: ${levels[gameEngine.levelNum].name} · ${levels[gameEngine.levelNum].goal} taps`;
  $('lvlPssdScore').textContent = gameEngine.score;
  $('lvlPssdBonusScore').textContent = `Time bonus +${bonus} · ${gameEngine.lives} heart${gameEngine.lives === 1 ? '' : 's'} left`;
  $('completedJourney').replaceChildren(...levels.map((_, index) => {
    const dot = document.createElement('i'); dot.classList.toggle('done', index < gameEngine.levelNum); return dot;
  }));
  $('completedJourney').setAttribute('aria-label', `${gameEngine.levelNum} of ${levels.length} levels completed`);
  $('lvlPssdContinueNextLvlBtn').hidden = finished;
  $('playAgainBtn').hidden = !finished;
  show('pageLevelPassed');
}
function lose(reason) {
  stopClock(); gameEngine.state = 'lost';
  best = Math.max(best, gameEngine.score);
  $('lvlLostTtl').textContent = reason;
  $('lostSummary').textContent = `Level ${gameEngine.levelNum} · ${gameEngine.tapNum}/${gameEngine.tapsGoal} taps. Your earlier points are safe.`;
  $('lvlLostScore').textContent = gameEngine.score;
  show('pageYouLost');
}
function pause() {
  if (!['playing', 'countdown'].includes(gameEngine.state)) return;
  resumeState = gameEngine.state;
  stopClock(); gameEngine.state = 'paused';
  $('lvlPausedScore').textContent = gameEngine.score; show('pagePauseMenu');
}
function shareResult() {
  if (!['between', 'lost'].includes(gameEngine.state)) return;
  const passed = gameEngine.state === 'between';
  window.invitationShareResult({
    score: gameEngine.score, level: gameEngine.levelNum, taps: gameEngine.tapNum,
    goal: gameEngine.tapsGoal, hearts: gameEngine.lives, passed,
    heading: passed ? $('passedHeading').textContent : $('lvlLostTtl').textContent,
    detail: passed ? $('lvlPssdBonusScore').textContent : `${gameEngine.tapNum}/${gameEngine.tapsGoal} taps`,
  });
}
document.querySelectorAll('[data-share-result]').forEach(button => button.addEventListener('click', shareResult));
$('newGameBtn').addEventListener('click', newRun);
$('tutPgStartGameBtn').addEventListener('click', beginRound);
$('gmStatsPauseBtn').addEventListener('click', pause);
$('pmCntnuGmBtn').addEventListener('click', () => {
  if (gameEngine.state !== 'paused') return;
  if (resumeState === 'countdown') { beginRound(); return; }
  gameEngine.state = 'playing'; show('pagePlayArea'); runClock();
});
$('pmRstrtLvlBtn').addEventListener('click', newRun);
$('lvlPssdContinueNextLvlBtn').addEventListener('click', () => {
  if (gameEngine.state !== 'between' || gameEngine.levelNum >= levels.length) return;
  gameEngine.levelNum++; beginRound();
});
$('playAgainBtn').addEventListener('click', newRun);
$('lvlLostTryAgainBtn').addEventListener('click', newRun);
$('retryLevelBtn').addEventListener('click', () => {
  if (gameEngine.state !== 'lost') return;
  gameEngine.score = roundScore; gameEngine.lives = 3; gameEngine.streak = 0; beginRound();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => { if (gameEngine.state === 'playing') targets(); });
show('pageGameMenu');
window.invitationRegisterSession({
  hasProgress: () => ['countdown', 'playing', 'paused'].includes(gameEngine.state) || (gameEngine.state === 'between' && gameEngine.levelNum < levels.length),
  pause,
});
window.invitationGameReady?.();
