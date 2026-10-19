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
      const distance = 22 + Math.random() * 16;
      const dx = Math.cos(angle) * distance;
      const rotation = Math.random() * 360;
      const duration = quiet ? 320 : 2400 + Math.random() * 700;
      const speed = 150 + Math.random() * 120;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 70;
      const fallSpeed = 125 + Math.random() * 25;
      const drag = 1.8;
      const flutterPhase = Math.random() * Math.PI * 2;
      const spin = (Math.random() < .5 ? -1 : 1) * (70 + Math.random() * 80);
      const frames = quiet ? [
        { transform: `translate(${dx}px, ${Math.sin(angle) * distance}px) rotate(${rotation}deg)`, opacity: .9 },
        { transform: `translate(${dx}px, ${Math.sin(angle) * distance}px) rotate(${rotation}deg)`, opacity: 0 },
      ] : Array.from({ length: 41 }, (_, step) => {
        const progress = step / 40;
        const time = progress * duration / 1000;
        // Air resistance slows the burst; gravity settles paper into a gentle fall.
        const travel = (1 - Math.exp(-drag * time)) / drag;
        const flutter = Math.min(1, time * 2) * Math.sin(time * 5 + flutterPhase);
        const x = vx * travel + flutter * 9;
        const y = fallSpeed * time + (vy - fallSpeed) * travel;
        return {
          transform: `translate(${x}px, ${y}px) rotate(${rotation + spin * time}deg) rotateY(${flutter * 55}deg) scale(${Math.min(1, .3 + time * 6)})`,
          opacity: progress < .78 ? 1 : (1 - progress) / .22,
          offset: progress,
        };
      });
      return particle.animate(frames, { duration, easing: quiet ? 'ease-out' : 'linear', fill: 'both' });
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
