document.getElementById('share-final-score').addEventListener('click', function(event) {
  event.stopPropagation();
  if (gameState !== 2) return;
  window.invitationShareResult({ score: score, best: Math.max(score, highscores[0] || 0) });
});
// The original body input handlers consume touch and mouse presses. Keep the
// result button independent so sharing never rotates or restarts the board.
['touchstart', 'mousedown'].forEach(function(type) {
  document.getElementById('share-final-score').addEventListener(type, function(event) {
    event.stopPropagation();
  });
});
