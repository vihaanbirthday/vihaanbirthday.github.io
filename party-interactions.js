// Every activation gets its own local burst; fast taps never wait for a cooldown.
export function setupPartyInteractions() {
  const colors = ['#dc7c91', '#e7b94d', '#80b6d3', '#a595cf', '#8ab495', '#eeaa78'];
  const bursts = new Set();
  const presses = new Map();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motionPreference.matches;

  function press(button) {
    presses.get(button)?.cancel();
    const animation = button.animate(reducedMotion() ? [
      { opacity: .65 }, { opacity: 1 },
    ] : [
      { transform: 'scale(.94)', offset: 0 },
      { transform: 'scale(1.035)', offset: .45 },
      { transform: 'scale(.99)', offset: .75 },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: reducedMotion() ? 160 : 360, easing: 'ease-out' });
    presses.set(button, animation);
    animation.finished.catch(() => {}).finally(() => {
      if (presses.get(button) === animation) presses.delete(button);
    });
  }

  function confetti(button, event) {
    const rect = button.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    const layer = document.createElement('span');
    layer.className = 'party-confetti';
    layer.setAttribute('aria-hidden', 'true');
    // Dialog effects belong in the top layer so they appear above the backdrop.
    (button.closest('dialog') || document.body).append(layer);
    const quiet = reducedMotion();
    const animations = Array.from({ length: quiet ? 12 : 28 }, (_, i) => {
      const particle = document.createElement('i');
      particle.style.left = `${x - 4}px`;
      particle.style.top = `${y - 6}px`;
      particle.style.backgroundColor = colors[i % colors.length];
      layer.append(particle);
      const angle = Math.PI * 2 * i / (quiet ? 12 : 28) + (Math.random() - .5) * .2;
      const distance = quiet ? 22 + Math.random() * 16 : 65 + Math.random() * 105;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 45;
      const rotation = Math.random() * 360;
      return particle.animate(quiet ? [
        { transform: `translate(${dx}px, ${Math.sin(angle) * distance}px) rotate(${rotation}deg)`, opacity: .9 },
        { transform: `translate(${dx}px, ${Math.sin(angle) * distance}px) rotate(${rotation}deg)`, opacity: 0 },
      ] : [
        { transform: `translate(0, 0) rotate(${rotation}deg) scale(.3)`, opacity: 1 },
        { transform: `translate(${dx * .65}px, ${dy * .7 - 15}px) rotate(${rotation + 140}deg)`, opacity: 1, offset: .4 },
        { transform: `translate(${dx}px, ${dy + 85}px) rotate(${rotation + 320}deg) scale(.65)`, opacity: 0 },
      ], { duration: quiet ? 320 : 850 + Math.random() * 300, easing: 'cubic-bezier(.12,.55,.45,1)', fill: 'both' });
    });
    const dispose = () => {
      animations.forEach(animation => animation.cancel());
      layer.remove();
      bursts.delete(dispose);
    };
    bursts.add(dispose);
    Promise.allSettled(animations.map(animation => animation.finished)).then(dispose);
  }

  document.querySelectorAll('[data-party-press]').forEach(button => {
    button.addEventListener('click', () => press(button));
  });
  document.querySelectorAll('#main h2 em, #rsvp-title em').forEach(accent => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'confetti-word';
    button.textContent = accent.textContent;
    button.setAttribute('aria-label', `${accent.textContent.replace(/[.!]/g, '')} — confetti`);
    accent.replaceChildren(button);
    button.addEventListener('click', event => {
      press(button);
      confetti(button, event);
    });
  });

  function clearEffects() {
    bursts.forEach(dispose => dispose());
    presses.forEach(animation => animation.cancel());
    presses.clear();
  }
  new MutationObserver(clearEffects).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
  motionPreference.addEventListener('change', clearEffects);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearEffects(); });
  document.addEventListener('close', clearEffects, true);
}
