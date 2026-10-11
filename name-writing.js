// One connected lowercase stroke, with sparks emitted only at the moving pen.
export function setupNameWriting(welcome, isOpening) {
  const strokes = [...welcome.querySelectorAll('.name-stroke')];
  const canvas = welcome.querySelector('.writing-fireworks');
  const svg = welcome.querySelector('.name-writing');
  const ctx = canvas.getContext('2d');
  let animations = [], frame = 0, particles = [], last = 0;
  function clearSparks() {
    cancelAnimationFrame(frame);
    frame = 0;
    particles = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function finish() {
    clearSparks();
    animations.forEach(animation => animation.cancel());
    animations = [];
    strokes.forEach(path => { path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = '0'; path.style.opacity = '1'; });
    welcome.classList.remove('is-writing');
    welcome.classList.add('has-written');
  }
  function play() {
    finish();
    if (document.body.classList.contains('motion-paused') || !isOpening()) return;
    welcome.classList.add('is-writing');
    welcome.classList.remove('has-written');
    let delay = 100;
    const timeline = strokes.map(path => {
      const length = path.getTotalLength();
      const duration = Math.max(90, length / 0.62);
      const hiddenOffset = length + Math.min(6, length * 0.05);
      path.style.strokeDasharray = `${length} ${length + 12}`;
      path.style.strokeDashoffset = String(hiddenOffset);
      path.style.opacity = '0';
      const animation = path.animate([
        { strokeDashoffset: hiddenOffset, opacity: 0 },
        { strokeDashoffset: hiddenOffset, opacity: 1, offset: 0.001 },
        { strokeDashoffset: 0, opacity: 1 },
      ], { duration, delay, easing: 'linear', fill: 'both' });
      const segment = { path, animation, delay, duration, length, hiddenOffset };
      animations.push(animation);
      delay += duration;
      return segment;
    });
    let emission = 0;
    last = performance.now();
    function draw(now) {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      const rect = svg.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / 640, height / 280);
      ctx.setTransform(scale, 0, 0, scale, (width - 640 * scale) / 2 - 60 * scale, (height - 280 * scale) / 2 - 60 * scale);
      const active = timeline.find(s => s.animation.playState === 'running' && s.animation.currentTime >= s.delay && s.animation.currentTime < s.delay + s.duration);
      if (active) {
        const progress = (active.animation.currentTime - active.delay) / active.duration;
        const distance = Math.max(0, active.length - active.hiddenOffset * (1 - progress));
        const point = active.path.getPointAtLength(distance);
        // Emission follows elapsed time, so high refresh displays don't create more sparks.
        emission += dt * 130;
        const count = Math.floor(emission);
        emission -= count;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 110;
          const life = 0.3 + Math.random() * 0.3;
          particles.push({ x: point.x, y: point.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life });
        }
        ctx.shadowColor = '#d5a057'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#b47838'; ctx.beginPath(); ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 5;
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.strokeStyle = '#bd8548'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      const writing = timeline.some(s => s.animation.playState !== 'finished');
      // Reveal the birthday message only once the final ink stroke is complete.
      if (!writing) welcome.classList.add('has-written');
      if (writing || particles.length) frame = requestAnimationFrame(draw);
      else { clearSparks(); welcome.classList.remove('is-writing'); }
    }
    frame = requestAnimationFrame(draw);
  }
  return { finish, play };
}
