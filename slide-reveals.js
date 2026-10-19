// Reveal reading content without moving the layout or exposing future controls.
export function setupSlideReveals() {
  let activePage, frame = 0, generation = 0, targets = [], animations = [];
  function finish() {
    generation++;
    cancelAnimationFrame(frame);
    frame = 0;
    animations.forEach(animation => animation.cancel());
    targets.forEach(element => { element.inert = false; });
    activePage?.classList.remove('is-slide-revealing');
    activePage = undefined;
    targets = [];
    animations = [];
  }
  function play(page) {
    finish();
    if (document.body.classList.contains('motion-paused')) return;
    activePage = page;
    page.classList.add('is-slide-revealing');
    targets = [...page.querySelectorAll('[data-slide-reveal]')];
    targets.forEach(element => { element.inert = true; });
    const current = generation;
    // Event recap lines and animated companions are populated during startup.
    frame = requestAnimationFrame(() => {
      frame = 0;
      targets = [...page.querySelectorAll('[data-slide-reveal]')];
      animations = targets.filter(element => !element.closest('[hidden]')).map((element, index) => {
        element.inert = true;
        const animation = element.animate([
          { opacity: 0, translate: '0 8px', visibility: 'hidden' },
          { opacity: 1, translate: '0 0', visibility: 'visible' },
        ], { duration: 450, delay: 100 + index * 600, easing: 'ease-out', fill: 'both' });
        animation.finished.then(() => {
          if (generation === current) element.inert = false;
        }).catch(() => { /* Navigation or reduced motion settles the slide. */ });
        return animation;
      });
      Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (generation === current) finish();
      });
    });
  }
  return { play, finish };
}
