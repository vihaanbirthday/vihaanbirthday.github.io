'use strict';
const $ = id => document.getElementById(id);
const toys = { woody: 'Woody', buzz: 'Buzz Lightyear', alien: 'Little alien', rex: 'Rex', hamm: 'Hamm', ball: 'Pixar ball' };
const memoryGame = { state: 'menu', deck: [], open: [], pairs: 0, moves: 0, score: 0 };
let flipTimer = 0;
function show(id) {
  for (const section of document.querySelectorAll('main > section')) { section.hidden = section.id !== id; section.inert = section.hidden; }
}
function start() {
  clearTimeout(flipTimer);
  const deck = [...Object.keys(toys), ...Object.keys(toys)];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  Object.assign(memoryGame, { state: 'playing', deck, open: [], pairs: 0, moves: 0, score: 0 });
  $('cards').replaceChildren(...deck.map((toy, index) => {
    const button = document.createElement('button'); button.className = 'toy-card';
    button.setAttribute('aria-label', `Card ${index + 1}, face down`);
    const image = document.createElement('img'); image.src = `art/${toy}.svg`; image.alt = '';
    const back = document.createElement('span'); back.className = 'back'; back.textContent = '★'; back.setAttribute('aria-hidden', 'true');
    button.append(image, back); button.addEventListener('click', () => turn(index)); return button;
  }));
  stats(); $('feedback').textContent = 'Pick any two cards.'; show('play'); $('cards').firstElementChild.focus();
}
function stats() {
  $('moves').textContent = `${memoryGame.moves} move${memoryGame.moves === 1 ? '' : 's'}`;
  $('pairs').textContent = `${memoryGame.pairs} / 6 pairs`;
}
function turn(index) {
  const card = $('cards').children[index];
  if (memoryGame.state !== 'playing' || memoryGame.open.length === 2 || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  card.classList.add('flipped'); card.setAttribute('aria-label', `Card ${index + 1}, ${toys[memoryGame.deck[index]]}`);
  memoryGame.open.push(index);
  if (memoryGame.open.length < 2) { $('feedback').textContent = `${toys[memoryGame.deck[index]]}! Find their friend.`; return; }
  memoryGame.moves++; stats();
  const [a, b] = memoryGame.open;
  if (memoryGame.deck[a] === memoryGame.deck[b]) {
    memoryGame.pairs++; memoryGame.score = memoryGame.pairs * 100;
    for (const n of [a, b]) { const el = $('cards').children[n]; el.classList.add('matched'); el.setAttribute('aria-label', `${toys[memoryGame.deck[n]]}, matched`); el.setAttribute('aria-disabled', 'true'); }
    memoryGame.open = []; $('feedback').textContent = `${toys[memoryGame.deck[a]]} found a friend!`; stats();
    if (memoryGame.pairs === 6) {
      memoryGame.state = 'result'; memoryGame.score += Math.max(0, 120 - memoryGame.moves * 3);
      $('result-detail').textContent = `All 6 pairs in ${memoryGame.moves} moves.`;
      $('result-score').textContent = `${memoryGame.score} points`;
      show('result'); $('again').focus();
    }
  } else {
    $('feedback').textContent = 'Remember these toys. Try another pair.';
    flipTimer = setTimeout(() => {
      for (const n of [a, b]) { const el = $('cards').children[n]; el.classList.remove('flipped'); el.setAttribute('aria-label', `Card ${n + 1}, face down`); }
      memoryGame.open = [];
    }, 900);
  }
}
$('start').addEventListener('click', start); $('reset').addEventListener('click', start); $('again').addEventListener('click', start);
$('share').addEventListener('click', () => { if (memoryGame.state === 'result') window.invitationShareResult({ score: memoryGame.score, moves: memoryGame.moves, pairs: memoryGame.pairs }); });
show('menu'); window.invitationGameReady();
