// The sandboxed game provides only result data. The invitation owns file sharing
// and the configured WhatsApp destination; no extra iframe privileges are needed.
export function setupResultSharing({ gameDialog, gameContainer, whatsappNumber }) {
  const dialog = document.querySelector('#result-share-dialog');
  const canvas = document.querySelector('#result-share-preview');
  const share = document.querySelector('#share-result-file');
  const download = document.querySelector('#download-result-file');
  const whatsapp = document.querySelector('#result-whatsapp');
  const help = document.querySelector('#result-share-help');
  const status = document.querySelector('#result-share-status');
  let file, imageURL, message, shareTitle, generation = 0;
  const contactReady = /^[1-9]\d{7,14}$/.test(whatsappNumber || '');

  function release() {
    generation++;
    if (imageURL) URL.revokeObjectURL(imageURL);
    file = imageURL = null;
    download.removeAttribute('href');
    whatsapp.removeAttribute('href');
  }
  function close() {
    if (dialog.open) dialog.close();
    release();
  }
  document.querySelector('#close-result-share').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    release();
    if (gameDialog.open) gameContainer.querySelector('iframe')?.focus();
  });

  function fallback() {
    share.hidden = true;
    download.hidden = false;
    whatsapp.hidden = !contactReady;
    help.textContent = contactReady
      ? 'Download the screenshot, open Madhav’s WhatsApp, then attach the saved image and send.'
      : 'Download your screenshot. Madhav’s WhatsApp contact is not available yet.';
  }
  share.addEventListener('click', async () => {
    if (!file) return;
    const current = generation;
    share.disabled = true;
    status.textContent = '';
    try {
      // The file is prepared before this click, preserving browser user activation.
      await navigator.share({ files: [file], title: shareTitle, text: message });
      if (current === generation) status.textContent = 'Result handed to your chosen app. Finish sending it to Madhav in WhatsApp.';
    } catch (error) {
      if (current !== generation) return;
      if (error.name !== 'AbortError') {
        fallback();
        status.textContent = 'Image sharing is unavailable here. You can still send the saved screenshot.';
      }
    } finally {
      if (current === generation) share.disabled = false;
    }
  });
  download.addEventListener('click', () => {
    status.textContent = contactReady
      ? 'Now open Madhav’s WhatsApp and attach the downloaded screenshot.'
      : 'Your result image is ready to save.';
  });

  window.addEventListener('message', async event => {
    const frame = gameContainer.querySelector('iframe');
    if (!gameDialog.open || !frame || event.source !== frame.contentWindow ||
        event.data?.type !== 'invitation:share-result' || dialog.open) return;
    const game = new URL(frame.src).pathname.match(/\/games\/(taptaptap|flappy|hextris|ohhi)\/index\.html$/)?.[1];
    const result = normalizeResult(game, event.data.result);
    if (!result) return;
    release();
    const current = generation;
    share.hidden = false;
    share.disabled = true;
    download.hidden = whatsapp.hidden = true;
    status.textContent = '';
    help.textContent = 'Preparing your result image…';
    dialog.showModal();
    try {
      await document.fonts.ready;
      if (current !== generation) return;
      message = `Hi Madhav! I scored ${result.score} points in ${result.name} at Vihaan’s birthday challenge. ${result.summary}.`;
      shareTitle = `${result.name} result`;
      drawResult(canvas, result);
      canvas.setAttribute('aria-label', `${result.heading} ${message} ${result.detail}`);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (current !== generation) return;
      if (!blob) throw new Error('Image unavailable');
      file = new File([blob], `${result.slug}-${result.score}-points.png`, { type: 'image/png' });
      imageURL = URL.createObjectURL(file);
      download.href = imageURL;
      download.download = file.name;
      if (contactReady) whatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      let canShare = false;
      try { canShare = !!navigator.share && !!navigator.canShare?.({ files: [file] }); } catch { /* Use the download path. */ }
      if (canShare && contactReady) {
        help.textContent = `Choose WhatsApp, then Madhav (+${whatsappNumber}), and send the screenshot.`;
        share.disabled = false;
        // Keep the directed chat and download available alongside the share sheet.
        download.hidden = whatsapp.hidden = false;
      } else fallback();
    } catch {
      if (current !== generation) return;
      share.hidden = true;
      help.textContent = 'The result image could not be prepared. Go back to your result and try sharing again.';
    }
  });
  return close;
}

function normalizeResult(game, data) {
  if (!data || !Number.isSafeInteger(data.score) || data.score < 0) return null;
  const names = { taptaptap: 'Tap Tap Tap', flappy: 'Broomstick Flyer', hextris: 'Hextris', ohhi: '0h h1' };
  if (!names[game]) return null;
  const result = { score: data.score, name: names[game], slug: game === 'taptaptap' ? 'tap-tap-tap' : game };
  if (game === 'taptaptap') {
    if (!Number.isInteger(data.level) || data.level < 1 || data.level > 8 ||
        !Number.isInteger(data.hearts) || data.hearts < 0 || data.hearts > 3 ||
        !Number.isInteger(data.taps) || data.taps < 0 || data.taps > 42 ||
        !Number.isInteger(data.goal) || data.goal < 12 || data.goal > 42 ||
        typeof data.passed !== 'boolean' || typeof data.heading !== 'string' || data.heading.length > 60 ||
        typeof data.detail !== 'string' || data.detail.length > 80) return null;
    result.cleared = data.passed ? data.level : data.level - 1;
    result.heading = data.heading;
    result.summary = `${result.cleared}/8 levels cleared`;
    result.detail = data.detail;
    result.footer = `${data.hearts} heart${data.hearts === 1 ? '' : 's'} left · Level ${data.level} of 8`;
  } else if (game === 'ohhi') {
    if (![4, 6, 8, 10].includes(data.size) || typeof data.tutorial !== 'boolean') return null;
    result.heading = data.tutorial ? 'Tutorial complete!' : 'Puzzle complete!';
    result.summary = `${data.size} × ${data.size} ${data.tutorial ? 'tutorial' : 'puzzle'} completed`;
    result.detail = 'Total points this visit';
    result.footer = 'A little logic. A lovely result.';
  } else {
    if (!Number.isSafeInteger(data.best) || data.best < data.score) return null;
    result.heading = game === 'flappy' ? 'Magical flying!' : 'A good run!';
    result.summary = 'Final score';
    result.detail = `Best this visit: ${data.best}`;
    result.footer = 'Can you beat my score?';
    if (game === 'flappy') {
      const characters = { nova: 'Nova', pip: 'Pip', lumi: 'Lumi' };
      if (!Object.hasOwn(characters, data.character)) return null;
      result.summary = `Flown with ${characters[data.character]}`;
      result.footer = 'A broomstick. A castle. A little magic.';
    }
  }
  return result;
}

function drawResult(canvas, result) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 800);
  gradient.addColorStop(0, result.slug === 'flappy' ? '#333755' : '#2b5251');
  gradient.addColorStop(1, result.slug === 'flappy' ? '#111a31' : '#122d33');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 800);
  ctx.textAlign = 'center';
  function text(value, y, size, color = '#f7f2df', family = 'DM Sans') {
    ctx.fillStyle = color;
    ctx.font = `500 ${size}px "${family}", sans-serif`;
    ctx.fillText(value, 360, y, 640);
  }
  text('✦', 110, 72, '#edc66c');
  text('VIHAAN’S BIRTHDAY CHALLENGE', 165, 20, '#b7d5ce');
  text(result.name, 236, 54, '#f7f2df', 'Playfair Display');
  text(result.heading, 318, 34, '#f7f2df', 'Playfair Display');
  text(String(result.score), 440, 100, '#f6d777');
  text('POINTS', 482, 20, '#b7d5ce');
  text(result.summary, 553, 28);
  text(result.detail, 600, 23, '#f6d777');
  for (let i = 0; i < (result.cleared === undefined ? 0 : 8); i++) {
    ctx.beginPath();
    ctx.arc(234 + i * 36, 656, 10, 0, Math.PI * 2);
    ctx.fillStyle = i < result.cleared ? '#edc66c' : '#ffffff10';
    ctx.fill();
    ctx.strokeStyle = '#acc5b9';
    ctx.stroke();
  }
  text(result.footer, 732, 22, '#b7d5ce');
}
