import { event } from './event-config.js';
import { getEventDate } from './event-details.js';
import { setupSafariFriends } from './safari-friends.js';
import { setupInvitationPages } from './invitation-pages.js';
import { setupResultSharing } from './result-sharing.js';
const $ = (s) => document.querySelector(s);
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function syncMotionPreference() {
  document.body.classList.toggle('motion-paused', motionPreference.matches);
}
motionPreference.addEventListener('change', syncMotionPreference);
syncMotionPreference();
setupInvitationPages();
setupSafariFriends();
const paths = { calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', message: '<path d="m4 17-1 5 5-2a9 9 0 1 0-4-3Z"/><path d="M8 8c0 4 4 7 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>' };
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[el.dataset.icon]}</svg>`; });
if ('IntersectionObserver' in window) {
  document.body.classList.add('motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
// Pause decorations behind dialogs so guests can concentrate on the task.
function syncDialogMotion() {
  const open = !!document.querySelector('dialog[open]');
  document.body.classList.toggle('motion-dialog', open);
}
new MutationObserver(syncDialogMotion).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
const games = {
  taptaptap: { name: 'Tap Tap Tap', help: 'Eight levels, gold bonus stars and a final challenge. Tap blue circles; avoid red ones.' },
  flappy: { name: 'Safari Flyer', help: 'Tap to flap through the green branches. On a computer, click or press Space.' },
  hextris: { name: 'Hextris', help: 'Tap the left or right side to rotate. Match three colours. Keyboard: ← →.' },
  ohhi: { name: '0h h1', help: 'Tap tiles to change colour. Start with “How to play” for a friendly tutorial.' },
};
const gameDialog = $('#game-dialog');
let activeGame, gameTrigger, loadingTimer;
const gameContainer = $('#game-frame-container');
const closeResultSharing = setupResultSharing({ gameDialog, gameContainer, whatsappNumber: event.whatsappNumber });
function clearGameLoading() {
  clearTimeout(loadingTimer);
  gameContainer.removeAttribute('aria-busy');
}
window.addEventListener('message', event => {
  const frame = gameContainer.querySelector('iframe');
  if (!frame || event.source !== frame.contentWindow || event.data?.type !== 'invitation:game-ready') return;
  clearGameLoading();
  gameContainer.querySelector('.game-loading')?.remove();
  frame.removeAttribute('inert');
  frame.removeAttribute('aria-hidden');
  frame.classList.remove('is-loading');
});
function loadGame() {
  closeResultSharing();
  clearGameLoading();
  gameContainer.setAttribute('aria-busy', 'true');
  const hero = document.createElement('div');
  hero.className = 'game-loading';
  hero.innerHTML = `<img src="./assets/safari.webp" alt="" width="360" height="300"><span class="eyebrow">A LITTLE WILD ADVENTURE</span><h3></h3><p role="status">Getting your adventure ready…</p><span class="game-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
  hero.querySelector('h3').textContent = games[activeGame].name;
  const frame = document.createElement('iframe');
  frame.title = games[activeGame].name + ' browser game';
  // No same-origin, popups, forms, downloads, or top-level navigation privileges.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.className = 'is-loading';
  frame.setAttribute('inert', '');
  frame.setAttribute('aria-hidden', 'true');
  frame.src = `./games/${activeGame}/index.html`;
  gameContainer.replaceChildren(hero, frame);
  loadingTimer = setTimeout(() => {
    hero.querySelector('[role="status"]').textContent = 'Taking a little longer. You can wait or try Restart below.';
  }, 15000);
}
document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => {
  activeGame = button.dataset.game;
  gameTrigger = button;
  $('#game-title').textContent = games[activeGame].name;
  $('#game-help').textContent = games[activeGame].help;
  gameDialog.showModal();
  loadGame();
}));
$('#close-game').addEventListener('click', () => gameDialog.close());
$('#restart-game').addEventListener('click', loadGame);
gameDialog.addEventListener('close', () => {
  closeResultSharing();
  clearGameLoading();
  gameContainer.replaceChildren();
  if (!gameDialog.dataset.navigationClose && gameTrigger?.closest('[data-page]')?.hidden === false) gameTrigger.focus({ preventScroll: true });
  delete gameDialog.dataset.navigationClose;
});
const rsvpDialog = $('#rsvp-dialog');
const rsvpReady = /^[1-9]\d{7,14}$/.test(event.whatsappNumber);
const guestAttendance = $('#guest-attendance');
const guestCount = $('#guest-count');
function syncRSVPFields() {
  const attending = guestAttendance.value === 'yes';
  $('#guest-party').hidden = !attending;
  guestCount.disabled = !attending;
}
guestAttendance.addEventListener('change', syncRSVPFields);
syncRSVPFields();
let rsvpTrigger;
document.querySelectorAll('[data-rsvp]').forEach(button => button.addEventListener('click', () => {
  rsvpTrigger = button;
  $('#rsvp-form').hidden = !rsvpReady;
  $('#rsvp-unavailable').hidden = rsvpReady;
  $('#rsvp-fallback').hidden = true;
  rsvpDialog.showModal();
  if (rsvpReady) $('#guest-name').focus();
}));
if (!rsvpReady) $('#rsvp-note').textContent = 'WhatsApp RSVP details coming soon';
$('#close-rsvp').addEventListener('click', () => rsvpDialog.close());
rsvpDialog.addEventListener('close', () => {
  if (!rsvpDialog.dataset.navigationClose) rsvpTrigger?.focus({ preventScroll: true });
  delete rsvpDialog.dataset.navigationClose;
});
$('#rsvp-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!rsvpReady) return;
  const name = $('#guest-name').value.trim();
  if (!name) { $('#guest-name').setCustomValidity('Please enter your name.'); $('#guest-name').reportValidity(); return; }
  const attending = guestAttendance.value === 'yes';
  const count = guestCount.value;
  if (attending && !/^[1-4]$/.test(count)) {
    guestCount.setCustomValidity('Please choose between 1 and 4 guests, including you and children.');
    guestCount.reportValidity();
    return;
  }
  const message = [
    'Hi Madhav & Urvashee!',
    '',
    "*Vihaan's 1st Birthday — RSVP*",
    `*Name:* ${name}`,
    `*Attendance:* ${attending ? (count === '1' ? "I'll be there" : "We'll be there") : "Sorry, we can't make it"}`,
    ...(attending ? [`*Total guests:* ${count} ${count === '1' ? 'guest' : 'guests'} (including me and children)`] : []),
    '',
    attending ? 'Looking forward to celebrating with you! 🎉' : 'Sending Vihaan lots of love for his big day! 💛',
  ].join('\n');
  $('#rsvp-message').value = message;
  $('#rsvp-status').textContent = 'Your reply is ready. Send your message in WhatsApp to finish your RSVP.';
  $('#copy-status').textContent = '';
  $('#rsvp-fallback').hidden = false;
  window.open(`https://wa.me/${event.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
$('#rsvp-form').addEventListener('input', () => {
  $('#guest-name').setCustomValidity('');
  guestCount.setCustomValidity('');
  $('#rsvp-fallback').hidden = true;
});
$('#copy-rsvp').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#rsvp-message').value);
    $('#copy-status').textContent = 'Message copied. Paste it into WhatsApp and send it to Madhav & Urvashee.';
  } catch {
    $('#rsvp-message').focus();
    $('#rsvp-message').select();
    $('#copy-status').textContent = 'Select and copy the message above, then paste it into WhatsApp.';
  }
});
const eventDate = getEventDate(event);
if (!eventDate) {
  $('#event-date').textContent = 'Date coming soon';
  $('#event-day').textContent = 'A lovely day together';
}
if (!eventDate || !event.time) $('#event-time').textContent = 'Time coming soon';
$('#hero-date').textContent = eventDate
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Mauritius' }).format(eventDate)
  : 'Date coming soon';
$('#hero-time').textContent = eventDate && event.time
  ? new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Indian/Mauritius' }).format(eventDate) + ' · Mauritius time'
  : 'Time coming soon';
if (event.date) {
  const date = getEventDate(event);
  if (date) {
    $('#event-date').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Mauritius' }).format(date);
    $('#event-day').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Indian/Mauritius' }).format(date);
    if (event.time) {
      $('#event-time').textContent = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Indian/Mauritius' }).format(date);
      $('#countdown').hidden = false;
      const updateCountdown = () => {
        const seconds = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
        const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60];
        $('#countdown-values').replaceChildren(...values.map((value, i) => { const box = document.createElement('div'); const number = document.createElement('b'); number.textContent = String(value).padStart(2, '0'); const label = document.createElement('span'); label.textContent = ['days', 'hours', 'minutes'][i]; box.append(number, label); return box; }));
      };
      updateCountdown(); setInterval(updateCountdown, 30000);
      document.querySelectorAll('[data-calendar]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', () => {
          const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
          const escape = s => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
          const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Vihaan Birthday//Invitation//EN','BEGIN:VEVENT',`UID:vihaan-first-birthday-${event.date}@invitation.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(date)}`,'SUMMARY:Vihaan’s first birthday',`LOCATION:${escape(event.venue)}`,'DESCRIPTION:Celebrate with Madhav and Urvashee.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
          const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
          const link = document.createElement('a'); link.href = url; link.download = 'vihaan-first-birthday.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      });
    }
  }
}
// Do not imply that a missing photograph is a photograph of the venue.
$('#venue-photo').addEventListener('error', () => { $('#venue-photo').hidden = true; $('.photo-caption').textContent = 'Paps Restaurant · Vacoas-Phoenix'; $('.photo-credit')?.setAttribute('hidden', ''); });
