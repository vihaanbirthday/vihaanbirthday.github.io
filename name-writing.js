// One connected lowercase stroke, with sparks emitted only at the moving pen.
export function setupNameWriting(welcome, isOpening) {
  const strokes = [...welcome.querySelectorAll('.name-stroke')];
  const canvas = welcome.querySelector('.writing-fireworks');
  const svg = welcome.querySelector('.name-writing');
  const kicker = welcome.querySelector('.opening-kicker');
  const title = welcome.querySelector('.opening-title');
  const closingLines = ['.opening-afterword', '.opening-note', '.opening-button', '.opening-dedication'].map(selector => welcome.querySelector(selector));
  const ctx = canvas.getContext('2d');
  const sparkColors = ['#d69b36', '#e8b84f', '#b77d29', '#fff0b8'];
  let inkAnimations = [], textAnimations = [], frame = 0, particles = [], last = 0;
  function reveal(element, delay, duration = 550) {
    const animation = element.animate([
      { opacity: 0, translate: '0 8px', visibility: 'hidden' },
      { opacity: 1, translate: '0 0', visibility: 'visible' },
    ], { duration, delay, easing: 'ease-out', fill: 'both' });
    textAnimations.push(animation);
    return animation;
  }
  function drawStar(x, y, radius, rotation) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = rotation + i * Math.PI / 4;
      const size = i % 2 === 0 ? radius : radius * 0.24;
      const px = x + Math.cos(angle) * size, py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  function clearSparks() {
    cancelAnimationFrame(frame);
    frame = 0;
    particles = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function finishInk() {
    clearSparks();
    inkAnimations.forEach(animation => animation.cancel());
    inkAnimations = [];
    strokes.forEach(path => { path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = '0'; path.style.opacity = '1'; });
    welcome.classList.remove('is-writing');
    welcome.classList.add('has-written');
  }
  function finish() {
    finishInk();
    textAnimations.forEach(animation => animation.cancel());
    textAnimations = [];
    welcome.classList.remove('is-revealing');
  }
  function play() {
    finish();
    if (document.body.classList.contains('motion-paused') || !isOpening()) return;
    welcome.classList.add('is-revealing');
    reveal(kicker, 100);
    reveal(title, 750, 150);
    let nextLine = playInk(900) + 150;
    const closingAnimations = closingLines.map(element => {
      const animation = reveal(element, nextLine);
      nextLine += 750;
      return animation;
    });
    Promise.all(closingAnimations.map(animation => animation.finished)).then(() => {
      welcome.classList.remove('is-revealing');
    }).catch(() => { /* Navigation or reduced motion cancels the sequence. */ });
  }
  function playInk(delay) {
    finishInk();
    if (document.body.classList.contains('motion-paused') || !isOpening()) return;
    welcome.classList.add('is-writing');
    welcome.classList.remove('has-written');
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
      inkAnimations.push(animation);
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
        emission += dt * 240;
        const count = Math.floor(emission);
        emission -= count;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 110;
          const life = 0.45 + Math.random() * 0.4;
          particles.push({
            x: point.x, y: point.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life, max: life, size: 1.2 + Math.random() * 2.6,
            star: Math.random() < 0.3, rotation: angle,
            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
          });
        }
        const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 16);
        halo.addColorStop(0, '#ffe6a3b3'); halo.addColorStop(1, '#ffe6a300');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(point.x, point.y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = '#e8b84f'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#d69b36'; drawStar(point.x, point.y, 7 + Math.sin(now / 100) * 1.5, Math.PI / 4);
        ctx.fillStyle = '#fff8df'; ctx.beginPath(); ctx.arc(point.x, point.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 5;
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt;
        const fade = Math.max(0, p.life / p.max);
        const twinkle = 0.65 + 0.35 * Math.sin((p.max - p.life) * 24 + p.rotation);
        ctx.globalAlpha = fade * twinkle;
        ctx.shadowColor = p.color; ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        if (p.star) {
          drawStar(p.x, p.y, p.size * (0.7 + fade), p.rotation + (p.max - p.life) * 1.5);
        } else {
          ctx.lineWidth = p.size * fade;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      const writing = timeline.some(s => s.animation.playState !== 'finished');
      if (!writing) welcome.classList.add('has-written');
      if (writing || particles.length) frame = requestAnimationFrame(draw);
      else { clearSparks(); welcome.classList.remove('is-writing'); }
    }
    frame = requestAnimationFrame(draw);
    return delay;
  }
  return { finish, play, replay: () => playInk(100) };
}
