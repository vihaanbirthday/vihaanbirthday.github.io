import { setupNameWriting } from './name-writing.js';
import { setupSlideReveals } from './slide-reveals.js';
// One invitation chapter at a time. Native anchors remain a readable fallback.
export function setupInvitationPages() {
  const pages = [...document.querySelectorAll('#main > [data-page]')];
  const hashes = ['#main', '#invitation', '#celebration', '#venue', '#rsvp', '#games'];
  const titles = ['The opening', 'One big adventure', 'The celebration', 'The venue', 'Come celebrate with us', 'A little playtime'];
  const invitationCount = 5;
  const gamesIndex = invitationCount;
  let gamesReturnPage = 0;
  const previous = document.querySelector('#page-back');
  const next = document.querySelector('#page-next');
  const welcome = pages[0];
  let current = -1;
  let historyPosition = 0, restoringHistory = false;
  history.replaceState({ ...history.state, invitationPosition: 0 }, '', location.href);
  const { finish: finishWriting, play: playWriting } = setupNameWriting(welcome, () => current === 0);
  const { finish: finishReveals, play: playReveals } = setupSlideReveals();
  const pageMenu = document.querySelector('#page-menu');
  function showPage(index, { focus = true } = {}) {
    pageMenu.open = false;
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      dialog.dataset.navigationClose = 'true';
      dialog.close();
    });
    if (index === current) {
      if (focus) pages[index].focus({ preventScroll: true });
      return;
    }
    const direction = index < current ? 'backward' : 'forward';
    finishWriting();
    finishReveals();
    if (index === gamesIndex && current >= 0 && current < invitationCount) gamesReturnPage = current;
    current = index;
    pages.forEach((page, i) => {
      page.hidden = i !== index;
      page.inert = i !== index;
      if (i === index) page.scrollTop = 0;
    });
    document.body.dataset.page = pages[index].dataset.page;
    document.body.dataset.pageDirection = direction;
    document.querySelectorAll('[data-section-link]').forEach(link => {
      if (link.hash === hashes[index]) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.hidden = index === 0;
    const isGames = index === gamesIndex;
    const isEnding = index === invitationCount - 1;
    next.querySelector('span').textContent = isGames ? 'Back to invitation' : isEnding ? 'Read again' : 'Next';
    next.setAttribute('aria-label', isGames ? 'Back to invitation' : isEnding ? 'Read invitation again' : `Next: ${titles[index + 1]}`);
    document.querySelector('#page-counter').textContent = isGames ? 'PLAY' : `${String(index + 1).padStart(2, '0')} / 05`;
    document.querySelector('#page-progress-fill').style.width = `${Math.min(index + 1, invitationCount) / invitationCount * 100}%`;
    document.querySelector('#page-status').textContent = titles[index];
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) pages[index].focus({ preventScroll: true });
    if (index === 0) playWriting();
    else playReveals(pages[index]);
  }
  function canNavigate(proceed) {
    return document.dispatchEvent(new CustomEvent('invitation:before-navigate', { cancelable: true, detail: { proceed } }));
  }
  function go(index, confirmed = false) {
    if (index < 0 || index >= pages.length) return;
    if (!confirmed && !canNavigate(() => go(index, true))) return;
    if (location.hash !== hashes[index]) history.pushState({ invitationPosition: ++historyPosition }, '', hashes[index]);
    showPage(index);
  }
  document.addEventListener('click', event => {
    if (!pageMenu.contains(event.target)) pageMenu.open = false;
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    const index = hashes.indexOf(url.hash);
    if (index === -1) return;
    event.preventDefault();
    go(index);
  });
  const followHistory = () => {
    if (restoringHistory) { restoringHistory = false; return; }
    const index = Math.max(0, hashes.indexOf(location.hash || '#main'));
    if (index === current) return;
    const targetPosition = history.state?.invitationPosition;
    const delta = Number.isInteger(targetPosition) ? targetPosition - historyPosition : 0;
    if (!canNavigate(() => go(index, true))) {
      if (delta) { restoringHistory = true; history.go(-delta); }
      else history.replaceState({ invitationPosition: historyPosition }, '', hashes[current]);
      return;
    }
    if (Number.isInteger(targetPosition)) historyPosition = targetPosition;
    showPage(index);
  };
  window.addEventListener('popstate', followHistory);
  window.addEventListener('hashchange', followHistory);
  const previousPage = () => current === gamesIndex ? gamesReturnPage : current - 1;
  previous.addEventListener('click', () => go(previousPage()));
  next.addEventListener('click', () => go(current === gamesIndex ? gamesReturnPage : (current + 1) % invitationCount));
  document.querySelector('#replay-writing').addEventListener('click', playWriting);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pageMenu.open) {
      pageMenu.open = false;
      pageMenu.querySelector('summary').focus();
      return;
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    let index;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') index = current < invitationCount - 1 ? current + 1 : undefined;
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') index = previousPage();
    if (event.key === 'Home') index = 0;
    if (event.key === 'End') index = invitationCount - 1;
    if (index !== undefined) { event.preventDefault(); go(index); }
  });
  let touch;
  const main = document.querySelector('#main');
  main.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 && !event.target.closest('a, button, input, select, textarea')
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  main.addEventListener('touchend', event => {
    if (!touch || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) go(previousPage());
      else if (current < invitationCount - 1) go(current + 1);
    }
    touch = null;
  }, { passive: true });
  main.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  function syncWritingMotion() {
    const paused = document.body.classList.contains('motion-paused');
    document.querySelector('#replay-writing').disabled = paused;
    if (paused) finishWriting();
    if (paused || document.body.classList.contains('motion-dialog')) finishReveals();
  }
  new MutationObserver(syncWritingMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncWritingMotion();
  document.body.classList.add('invitation-ready');
  document.querySelector('#invitation-controls').hidden = false;
  showPage(Math.max(0, hashes.indexOf(location.hash || '#main')), { focus: false });
}
