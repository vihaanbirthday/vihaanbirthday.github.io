import { event } from './event-config.js';
import { getEventDate } from './event-details.js';
import { setupSafariFriends } from './safari-friends.js';
import { setupInvitationPages } from './invitation-pages.js';
import { setupGameExit } from './game-exit.js';
import { setupPartyInteractions } from './party-interactions.js';
const $ = (s) => document.querySelector(s);
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function syncMotionPreference() {
  document.body.classList.toggle('motion-paused', motionPreference.matches);
}
motionPreference.addEventListener('change', syncMotionPreference);
syncMotionPreference();
setupInvitationPages();
setupSafariFriends();
setupPartyInteractions();
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
  flappy: { name: 'Broomstick Flyer', help: 'Choose your character, then tap, click or press Space to fly.' },
  hextris: { name: 'Hextris', help: 'Tap the left or right side to rotate. Match three colours. Keyboard: ← →.' },
  ohhi: { name: '0h h1', help: 'Tap tiles to change colour. Start with “How to play” for a friendly tutorial.' },
};
const gameDialog = $('#game-dialog');
let activeGame, gameTrigger, loadingTimer;
const gameContainer = $('#game-frame-container');
const requestGameAction = setupGameExit(gameDialog, gameContainer);
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
  clearGameLoading();
  gameContainer.setAttribute('aria-busy', 'true');
  const hero = document.createElement('div');
  hero.className = 'game-loading';
  hero.innerHTML = `<img src="./assets/safari.webp" alt="" width="360" height="300"><span class="eyebrow">A LITTLE WILD ADVENTURE</span><h3></h3><p role="status">Getting your adventure ready…</p><span class="game-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
  if (activeGame === 'flappy') {
    hero.classList.add('broomstick-loading');
    hero.querySelector('img').src = './games/flappy/art/nova.svg';
    hero.querySelector('.eyebrow').textContent = 'A LITTLE MAGIC AWAITS';
  }
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
  gameDialog.dataset.game = activeGame;
  gameTrigger = button;
  $('#game-title').textContent = games[activeGame].name;
  $('#game-help').textContent = games[activeGame].help;
  gameDialog.showModal();
  loadGame();
}));
$('#close-game').addEventListener('click', () => requestGameAction(() => gameDialog.close()));
$('#restart-game').addEventListener('click', () => requestGameAction(loadGame, 'restart'));
gameDialog.addEventListener('close', () => {
  clearGameLoading();
  gameContainer.replaceChildren();
  delete gameDialog.dataset.game;
  if (!gameDialog.dataset.navigationClose && gameTrigger?.closest('[data-page]')?.hidden === false) gameTrigger.focus({ preventScroll: true });
  delete gameDialog.dataset.navigationClose;
});
const rsvpDialog = $('#rsvp-dialog');
const rsvpReady = /^[1-9]\d{7,14}$/.test(event.whatsappNumber);
const guestAttendance = $('#guest-attendance');
const guestList = $('#guest-list');
const addGuest = $('#add-guest');
const maxGuests = 10;
let guestId = 0;
function guestInputs() {
  return [...guestList.querySelectorAll('input')];
}
function syncGuestList() {
  const inputs = guestInputs();
  const count = inputs.length + 1;
  const attending = guestAttendance.value === 'yes';
  $('#guest-total').textContent = `${count} / ${maxGuests} guests`;
  addGuest.disabled = !attending || count >= maxGuests;
  $('#guest-limit').hidden = count < maxGuests;
  inputs.forEach((input, index) => {
    const row = input.closest('.guest-card');
    row.querySelector('label').textContent = `Guest ${index + 2}`;
    row.querySelector('.guest-number').textContent = index + 2;
    row.querySelector('button').setAttribute('aria-label', `Remove guest ${index + 2}`);
    input.disabled = !attending;
  });
}
addGuest.addEventListener('click', () => {
  if (guestAttendance.value !== 'yes' || guestInputs().length >= maxGuests - 1) return;
  const row = document.createElement('div');
  row.className = 'guest-card';
  const number = document.createElement('span');
  number.className = 'guest-number';
  number.setAttribute('aria-hidden', 'true');
  const field = document.createElement('div');
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.id = `party-guest-${++guestId}`;
  input.name = 'guests[]';
  input.type = 'text';
  input.required = true;
  input.maxLength = 80;
  input.autocomplete = 'off';
  input.placeholder = 'Their name';
  label.htmlFor = input.id;
  field.append(label, input);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-guest';
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    const inputs = guestInputs();
    const index = inputs.indexOf(input);
    row.remove();
    syncGuestList();
    // Keep keyboard focus near the removed guest, even after renumbering.
    (guestInputs()[index] || guestInputs()[index - 1] || addGuest).focus();
  });
  row.append(number, field, remove);
  guestList.append(row);
  syncGuestList();
  input.focus();
});
function syncRSVPFields() {
  const attending = guestAttendance.value === 'yes';
  $('#guest-party').hidden = !attending;
  syncGuestList();
}
guestAttendance.addEventListener('change', syncRSVPFields);
syncRSVPFields();
let rsvpTrigger;
document.querySelectorAll('[data-rsvp]').forEach(button => button.addEventListener('click', () => {
  rsvpTrigger = button;
  $('#rsvp-form').hidden = !rsvpReady;
  $('#rsvp-unavailable').hidden = rsvpReady;
  rsvpDialog.showModal();
  if (rsvpReady) $('#guest-name').focus();
}));
$('#close-rsvp').addEventListener('click', () => rsvpDialog.close());
rsvpDialog.addEventListener('close', () => {
  if (!rsvpDialog.dataset.navigationClose) rsvpTrigger?.focus({ preventScroll: true });
  delete rsvpDialog.dataset.navigationClose;
});
$('#rsvp-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!rsvpReady) return;
  const cleanName = value => value.trim().replace(/\s+/g, ' ');
  const name = cleanName($('#guest-name').value);
  if (!name) { $('#guest-name').setCustomValidity('Please enter your name.'); $('#guest-name').reportValidity(); return; }
  const attending = guestAttendance.value === 'yes';
  const inputs = guestInputs();
  const count = inputs.length + 1;
  if (attending) {
    if (count > maxGuests) {
      $('#guest-name').setCustomValidity('Your party can include up to 10 people, including you and children.');
      $('#guest-name').reportValidity();
      return;
    }
    for (const input of inputs) {
      if (!input.value.trim()) {
        input.setCustomValidity('Please enter this guest’s name or remove them from your crew.');
        input.reportValidity();
        return;
      }
    }
  }
  const guests = inputs.map(input => cleanName(input.value));
  const greeting = `Hi Madhav and Urvashee, it’s ${name}! Thank you for inviting ${attending && count > 1 ? 'us' : 'me'} to Vihaan’s first birthday.`;
  let reply = 'I’m sorry I won’t be able to make it. Sending Vihaan lots of love for his big day!';
  if (attending) {
    reply = count === 1
      ? 'I’ll be there and can’t wait to celebrate with you!'
      : `I’ll be coming with ${new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(guests)}. There will be ${count} of us altogether. We’re looking forward to celebrating with you!`;
  }
  const message = `${greeting}\n\n${reply}`;
  window.open(`https://wa.me/${event.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  rsvpDialog.close();
});
$('#rsvp-form').addEventListener('input', e => {
  $('#guest-name').setCustomValidity('');
  if (e.target instanceof HTMLInputElement) e.target.setCustomValidity('');
});
const eventDate = getEventDate(event);
if (!eventDate) {
  $('#event-date').textContent = 'Date coming soon';
  $('#event-day').textContent = 'A lovely day together';
}
if (!eventDate || !event.time) $('#event-time').textContent = 'Time coming soon';
const recapDate = eventDate
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Mauritius' }).format(eventDate)
  : 'Date coming soon';
const recapTime = eventDate && event.time
  ? new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Indian/Mauritius' }).format(eventDate) + ' · Mauritius time'
  : 'Time coming soon';
document.querySelectorAll('[data-event-recap]').forEach(el => {
  el.replaceChildren(...[recapDate, recapTime, 'Paps Restaurant'].map(text => { const line = document.createElement('span'); line.textContent = text; return line; }));
});
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
