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
  let file, imageURL, message, generation = 0;
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
      await navigator.share({ files: [file], title: 'Tap Tap Tap result', text: message });
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
        !new URL(frame.src).pathname.endsWith('/games/taptaptap/index.html') ||
        event.data?.type !== 'invitation:share-taptaptap' || dialog.open) return;
    const result = event.data.result;
    if (!result || !Number.isSafeInteger(result.score) || result.score < 0 || result.score > 1000000 ||
        !Number.isInteger(result.level) || result.level < 1 || result.level > 8 ||
        !Number.isInteger(result.hearts) || result.hearts < 0 || result.hearts > 3 ||
        !Number.isInteger(result.taps) || result.taps < 0 || result.taps > 42 ||
        !Number.isInteger(result.goal) || result.goal < 12 || result.goal > 42 ||
        typeof result.passed !== 'boolean' || typeof result.heading !== 'string' || result.heading.length > 60 ||
        typeof result.detail !== 'string' || result.detail.length > 80) return;
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
      const cleared = result.passed ? result.level : result.level - 1;
      message = `Hi Madhav! I scored ${result.score} points in Tap Tap Tap at Vihaan’s birthday challenge. ${cleared}/8 levels cleared${result.passed ? '.' : ` · ${result.taps}/${result.goal} taps on level ${result.level}.`}`;
      drawResult(canvas, result, cleared);
      canvas.setAttribute('aria-label', `${result.heading} ${message} ${result.detail}`);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (current !== generation) return;
      if (!blob) throw new Error('Image unavailable');
      file = new File([blob], `tap-tap-tap-${result.score}-points.png`, { type: 'image/png' });
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

function drawResult(canvas, result, cleared) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 800);
  gradient.addColorStop(0, '#2b5251');
  gradient.addColorStop(1, '#122d33');
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
  text('Tap Tap Tap', 236, 54, '#f7f2df', 'Playfair Display');
  text(result.heading, 318, 34, '#f7f2df', 'Playfair Display');
  text(String(result.score), 440, 100, '#f6d777');
  text('POINTS', 482, 20, '#b7d5ce');
  text(`${cleared} / 8 levels cleared`, 553, 28);
  text(result.detail, 600, 23, '#f6d777');
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(234 + i * 36, 656, 10, 0, Math.PI * 2);
    ctx.fillStyle = i < cleared ? '#edc66c' : '#ffffff10';
    ctx.fill();
    ctx.strokeStyle = '#acc5b9';
    ctx.stroke();
  }
  text(`${result.hearts} heart${result.hearts === 1 ? '' : 's'} left · Level ${result.level} of 8`, 732, 22, '#b7d5ce');
}
