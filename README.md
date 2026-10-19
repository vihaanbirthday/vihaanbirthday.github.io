# Vihaan’s Little Explorer invitation

A responsive, five-page storybook invitation with an optional games screen for Vihaan’s first birthday, with a handwritten animated opening, locally hosted safari artwork and fonts, five animated animal companions and four sandboxed games. No backend, database, analytics, guest accounts or remote API is required.

Project repository: [vihaanbirthday/vihaanbirthday.github.io](https://github.com/vihaanbirthday/vihaanbirthday.github.io). GitHub Pages deploys from `main` to [vihaanbirthday.github.io](https://vihaanbirthday.github.io/); see [HOSTING.md](HOSTING.md) for setup.

## Preview and build

Requires Node.js 22.12+.

```
npm ci
npm run dev
npm test
npm run build
```

Publish only `dist/` to a static HTTPS host. GitHub Pages, Netlify and Vercel configurations are included. See [HOSTING.md](HOSTING.md) for publishing and security-header setup. The build supports a domain root or a repository subpath.

## Event details and RSVP

Edit `event-config.js`. The configured celebration is Sunday 6 December 2026 at 11:00 am Mauritius time, at Paps Restaurant. Run `npm run check:ready` before sharing.

The invitation opens on a pastel blue-and-cream nursery cover with clouds, gently floating stars and paper flags fluttering independently in a soft breeze, and “Vihaan” handwritten in blue from left to right. The birthday text and invitation note appear only after the final stroke finishes, and hide again on replay. Strokes use their actual lengths for even drawing speed. Future strokes stay fully transparent so their rounded ends cannot appear as dots. A glowing star at the moving pen releases a fuller trail of golden glitter and twinkling four-point stars only along the active stroke; the lowercase letters form one connected path. Touching or clicking Vihaan’s name restarts the writing; the name also supports Enter and Space, with no separate replay button. The five invitation chapters are Opening, Invitation, Celebration, Venue and RSVP. Open invitation is the only forward button on the opening; Next reveals the following chapters in order and the final chapter offers an optional Play games link. Games sit outside the five-page progress count. RSVP and Play games shortcuts stay visible in the header, allowing immediate access from any chapter. The Pages menu provides larger links to individual chapters, plus credits and privacy. Back to invitation returns to the chapter from which games were opened; direct game links return to the opening. Only the current chapter is visible and focusable. Next/Back buttons, horizontal swipes, arrow keys and the Pages menu move through the invitation; Home/End jump to the opening or the final invitation chapter. Arrow keys and swipes stop at the final chapter instead of entering games. Browser Back/Forward, reloads and direct chapter links retain the selected screen. Leaving or restarting an active round pauses the game and asks whether to discard progress, including when using browser Back within the invitation. Keeping the game retains the same frame and progress; use its resume control to continue. Confirmed navigation closes and unloads the game before changing chapters.

Shorter copy, 17–21px main reading text, larger headings and 44–56px controls keep standard phone and desktop layouts readable within each chapter. Artwork is sized to leave room for text, and repeated captions and actions are removed. Short windows or enlarged content can scroll within the active chapter while navigation remains visible. Downward pulls at the top of a chapter allow the phone browser’s native pull-to-refresh gesture; horizontal swipes still change chapters. Without JavaScript all chapters remain readable through native anchors. The RSVP chapter shows a compact date, Mauritius time and venue recap. The invitation chapter gives more space to the transparent safari illustration. The celebration chapter shows the countdown and calendar download. The RSVP chapter opens the existing WhatsApp form directly; directions are available in the venue chapter.

Guests enter a name and choose whether they can attend. Acceptances let them use a + button to add each accompanying guest by name, including children, up to 10 people in total including the person replying. Each added guest can be removed; a live total and limit notice keep the crew size clear. The RSVP uses a cartoon style with pastel cards, bold outlines, a party-post illustration and chunky buttons. WhatsApp replies include a birthday heading, labelled name and attendance lines, the total and numbered list of guest names for acceptances, and a closing note separated by blank lines. Declines omit the guest list and headcount. Submitting the form opens WhatsApp directly with the prepared reply, with no review screen or phone-call option. Guests send the message themselves in WhatsApp; the website does not send messages or claim attendance is confirmed. Names and RSVP details are not stored. Calendar downloads use the Mauritius time zone and do not invent an event end time. Missing settings are labelled as pending.

## Artwork, motion and games

The RSVP’s cartoon party style carries through the entire invitation: rounded bold headings, pastel paper cards, dark outlines, offset shadows and chunky buttons. The opening keeps its animated blue handwriting inside a cream cover card. Navigation, celebration cards, countdown, venue postcard, game shelf, loading and sharing dialogs, downloadable score cards, game menus and credits use the same shared palette in `public/assets/party-theme.css`. Game playfields retain their distinct visual cues and original mechanics.

The opening uses soft blue lettering on cream and pastel blue; the following chapters use peach, butter yellow, sky blue, blush pink and lavender backgrounds with illustrated teddy bears, balloons, rattles, alphabet blocks and rainbows. Clouds drift, toys bob and stars twinkle around the reading area. Background decorations pause for open dialogs and reduced motion. The visibly labelled venue illustration and picture-book safari animals remain in each chapter. Reading text stays still. There is no header pause control. The operating system’s reduced-motion preference pauses all page decorations and canvas loops. Enabling reduced motion displays the entire handwritten name and its supporting text immediately and disables replay. All five sprite sheets and the tiger’s rolling pose preload at page open and decode in parallel, including animals in inactive chapters. Artwork paints when it is ready and resizes with its section. Each animal appears only after its real artwork is painted; no emoji face or static placeholder flashes first.

Continuous in-between frames add head and neck movement, body bends, breathing, a smoother walking turn, springy monkey hops and a crouch-roll-bounce sequence for the tiger. Existing artwork stays local. Offscreen animals and page decorations behind open dialogs stop moving to avoid unnecessary work. Tapping the companions makes the lion wave, elephant splash, giraffe munch a leaf, monkey somersault or tiger roll. Paused motion shows a still response. The three celebration cards are buttons with a quick squash-and-spring response. Red heading words, including the RSVP dialog’s “reply”, launch local confetti on every tap or keyboard activation, including rapid repeated taps. Confetti starts at the tap position, never blocks controls, and clears after the animation, on chapter changes or on dialog close. Reduced motion uses a short fade instead of scaling or flying particles.

Each chapter after the opening keeps its animated companion: lion in Invitation, elephant in Celebration, giraffe in Venue, tiger in RSVP and monkey in Gaming.

Gaming contains Tap Tap Tap, Hextris, 0h h1 and Broomstick Flyer. Broomstick Flyer is an original fantasy broomstick game: choose Nova the moon scholar, Pip the wind apprentice or Lumi the lantern keeper before takeoff, fly through gaps in enchanted towers above an original lakeside magic academy, and choose again after each flight. The first takeoff opens a looping flying lesson showing tap-to-rise, drift-to-descend and one point per cleared tower; the demo can be reopened before any later flight. Tower speed rises from 110 to 170 pixels per second and new gaps narrow gradually over the first 40 points, then difficulty stays capped. Existing gaps keep their size, and consecutive gap centres stay within a reachable vertical distance. Replay resets the difficulty. Shared results include the selected character. Tap Tap Tap now has eight rounds (12–42 blue taps with 30–38 seconds each), three hearts, escalating red hazards, up to 3× streak points, gold stars for extra time, time bonuses, a clear Next level button and a final celebration. Players can retry a failed level with its starting score or restart the whole run. Targets never overlap; symbols distinguish the colours. In-game pause preserves the timer, and hiding the browser automatically pauses play. Phone cards use compact illustrated previews. Scores remain inside the isolated game session and disappear when it is closed. 0h h1 opens directly on Play and How to play. Its menu, board-size choices, tiles, undo and hint controls use native buttons; arrow keys move around the board and Space changes a tile. Hextris exposes Play, Help, Pause/Resume and Restart as labelled keyboard controls. Broomstick Flyer offers Pause/Resume and pauses when hidden or focus moves away. Games never send scores to a remote service, ask for nicknames or contact a service.

## Security and privacy

The invitation has no frontend runtime dependencies and makes no outbound API requests. Assets and game libraries are local. WhatsApp and Google Maps open only when a guest chooses their links. A static host may maintain access logs.

Games run in frames with `sandbox="allow-scripts"` and no same-origin, navigation, popup, forms or download privileges. They cannot read the invitation DOM or browser storage. A memory-only compatibility layer supports older game code; games have no cookies or persistent storage. Content policies block outbound fetch/XHR/WebSocket connections and external scripts. Messages from the current frame indicate readiness, request local result sharing, or answer whether a round has progress to discard. The parent can request a pause; these messages preserve the frame’s isolation and never contact a service.

The site asks search engines not to index it, but this is not access control. Event details and the WhatsApp recipient are public to anyone who can access the site. Use host access controls if needed. Vendored games are older upstream projects; preserve their isolation and content policies when editing them.

## Attribution

[public/credits.html](public/credits.html) contains licenses, attribution and downloadable complete modified game sources. After changing games, run `python3 scripts/package-game-sources.py` before building. `scripts/harden-games.py` documents the original one-time adaptation and should not be reapplied to already adapted games.

The venue card is an original SVG illustration. Google Maps provides real visitor photos; no third-party venue photograph is redistributed. Safari artwork and sprite sheets were generated with the built-in image generation tool; see [design/asset-notes.md](design/asset-notes.md) and [docs/animal-art-prompts.md](docs/animal-art-prompts.md).

## Verification

`npm test` checks assets, date validation, game content policies and absence of backend tooling. `npm run check:ready` checks event configuration.

Browser checks require installed Chrome on macOS, or `CHROME_PATH` pointing to Chrome elsewhere:

- `npm run build && npm run test:pages`: domain-root and repository-subpath loading, animal activities, visible animation, eager loading without placeholder faces, missing artwork, game loading, credits and source downloads.
- With `npm run dev` running: `node scripts/invitation-check.mjs` checks direct RSVP entry points, adding/removing named guests, keyboard focus, required names, the ten-person limit, structured acceptance/decline replies, WhatsApp URL encoding, direct WhatsApp handoff, pending event settings, calendar timezone and dialog sizing on phone and desktop. WhatsApp is mocked; no messages are sent.
- With `npm run dev` running: `node scripts/motion-check.mjs` checks invisible future strokes (including rounded caps), the left-to-right writing timeline, supporting text appearing after the final stroke, replay, complete lettering with reduced motion, stable reading text, keyboard greetings, reduced-motion preferences and dialog motion.
- With `npm run preview -- --port 4173` running: `npm run test:navigation` checks viewport layouts at 320, 390, 768 and 1440px and in landscape; one visible chapter at a time; hidden-page focus exclusion; Next/Back, keyboard and swipe navigation; browser history; direct links and reloads; painted artwork; exiting games to chapters; and readable navigation without JavaScript.
- With `npm run preview -- --port 4173` running: `node scripts/game-check.mjs` exercises touch gameplay, replay, restart, closing, frame isolation and absence of external requests at phone and desktop widths.

- With the preview server running: `npm run test:celebration` checks the three card presses, touch and keyboard confetti, rapid repeats, tap positions, cleanup, dialog layering and reduced motion on phone and desktop.

- With the preview server running: `npm run test:ux` checks immediate puzzle choices, keyboard controls, cancelled exits, close/restart/navigation/browser Back confirmations, and flight pause/resume/visibility.

- With the preview server running: `node scripts/taptaptap-check.mjs` plays all eight rounds and checks hearts, combos, bonus stars, target placement, pause, retries, time expiry and a fresh replay.

These checks use browser-emulated devices, not physical-device certification.
