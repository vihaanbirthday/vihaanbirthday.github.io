// Query only the current isolated frame; no game state or personal data is stored.
export function setupGameExit(gameDialog, gameContainer) {
  const dialog = document.querySelector('#game-exit-dialog');
  let pending, requestId = 0, timer;
  function cancel() {
    clearTimeout(timer);
    pending = null;
  }
  function showConfirmation() {
    if (!pending || !gameDialog.open) return;
    const restart = pending.action === 'restart';
    document.querySelector('#game-exit-title').textContent = restart ? 'Restart this game?' : 'Leave this game?';
    document.querySelector('#game-exit-note').textContent = `Your game is paused. ${restart ? 'Restarting' : 'Leaving'} will discard this round’s progress.`;
    document.querySelector('#discard-game').textContent = restart ? 'Restart game' : 'Leave game';
    pending.frame.contentWindow.postMessage({ type: 'invitation:pause-game' }, '*');
    dialog.showModal();
  }
  function request(proceed, action = 'leave') {
    const frame = gameContainer.querySelector('iframe');
    if (!gameDialog.open || !frame || frame.classList.contains('is-loading')) { proceed(); return; }
    if (pending) return;
    pending = { proceed, action, frame, requestId: ++requestId };
    // A missing response must never silently discard a ready game.
    timer = setTimeout(showConfirmation, 1500);
    frame.contentWindow.postMessage({ type: 'invitation:check-exit', requestId }, '*');
  }
  window.addEventListener('message', event => {
    if (!pending || event.source !== pending.frame.contentWindow || event.data?.type !== 'invitation:exit-state' || event.data.requestId !== pending.requestId || typeof event.data.hasProgress !== 'boolean') return;
    clearTimeout(timer);
    if (event.data.hasProgress) showConfirmation();
    else { const proceed = pending.proceed; cancel(); proceed(); }
  });
  document.querySelector('#keep-playing').addEventListener('click', () => { cancel(); dialog.close(); });
  document.querySelector('#discard-game').addEventListener('click', () => {
    const proceed = pending?.proceed;
    cancel();
    dialog.close();
    proceed?.();
  });
  dialog.addEventListener('cancel', cancel);
  gameDialog.addEventListener('close', () => { cancel(); if (dialog.open) dialog.close(); });
  gameDialog.addEventListener('cancel', event => { event.preventDefault(); request(() => gameDialog.close()); });
  document.addEventListener('invitation:before-navigate', event => {
    if (!gameDialog.open) return;
    event.preventDefault();
    request(event.detail.proceed);
  });
  return request;
}
