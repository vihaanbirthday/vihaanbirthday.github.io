# Vihaan’s Little Explorer invitation

A responsive, five-page storybook invitation with an optional games screen for Vihaan’s first birthday, with a handwritten animated opening, locally hosted safari artwork and fonts, five animated animal companions and four sandboxed games. No backend, database, analytics, guest accounts or remote API is required.

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

The invitation opens on a pastel blue-and-cream nursery cover with clouds, stars and paper bunting, and “Vihaan” handwritten in blue from left to right. The birthday text and invitation note appear only after the final stroke finishes, and hide again on replay. Strokes use their actual lengths for even drawing speed. Future strokes stay fully transparent so their rounded ends cannot appear as dots. A moving spark releases short golden trails only along the active stroke; the lowercase letters form one connected path. Replay restarts the writing. The five invitation chapters are Opening, Invitation, Celebration, Venue and RSVP. Open invitation is the only forward button on the opening; Next reveals the following chapters in order and the final chapter offers an optional Play games link. Games sit outside the five-page progress count. A prominent Play games shortcut stays visible in the header, allowing immediate access from any chapter. The Pages menu provides larger links to individual chapters, plus credits and privacy. Back to invitation returns to the chapter from which games were opened; direct game links return to the opening. Only the current chapter is visible and focusable. Next/Back buttons, horizontal swipes, arrow keys and the Pages menu move through the invitation; Home/End jump to the opening or the final invitation chapter. Arrow keys and swipes stop at the final chapter instead of entering games. Browser Back/Forward, reloads and direct chapter links retain the selected screen. Game navigation closes and unloads the game before changing chapters.

Shorter copy, 17–21px main reading text, larger headings and 44–56px controls keep standard phone and desktop layouts readable within each chapter. Artwork is sized to leave room for text, and repeated captions and actions are removed. Short windows or enlarged content can scroll within the active chapter while navigation remains visible. Without JavaScript all chapters remain readable through native anchors. The celebration chapter shows the date, Mauritius time, venue and countdown. The RSVP chapter opens the existing WhatsApp form directly; directions are available in the venue chapter.

Guests enter a name and choose whether they can attend. Acceptances request a total headcount including the person replying and children, with an exact count for parties of six or more. Declines omit the headcount. Guests review and send the prepared message themselves in WhatsApp; the website does not send messages or claim attendance is confirmed. A copy-message fallback works when WhatsApp does not open, with manual selection if clipboard access is unavailable. Names and RSVP details are not stored. Calendar downloads use the Mauritius time zone and do not invent an event end time. Missing settings are labelled as pending.

## Artwork, motion and games

The opening uses soft blue lettering on cream and pastel blue; the following chapters use peach, butter yellow, sky blue, blush pink and lavender backgrounds with illustrated teddy bears, balloons, rattles, alphabet blocks and rainbows. Clouds drift, toys bob and stars twinkle around the reading area. Background decorations pause for open dialogs and reduced motion. The visibly labelled venue illustration and picture-book safari animals remain in each chapter. Reading text stays still. There is no header pause control. The operating system’s reduced-motion preference pauses all page decorations and canvas loops. Enabling reduced motion displays the entire handwritten name and its supporting text immediately and disables replay. All five sprite sheets and the tiger’s rolling pose preload at page open and decode in parallel, including animals in inactive chapters. Artwork paints when it is ready and resizes with its section. Each animal appears only after its real artwork is painted; no emoji face or static placeholder flashes first.

Continuous in-between frames add head and neck movement, body bends, breathing, a smoother walking turn, springy monkey hops and a crouch-roll-bounce sequence for the tiger. Existing artwork stays local. Offscreen animals and page decorations behind open dialogs stop moving to avoid unnecessary work. Tapping the companions makes the lion wave, elephant splash, giraffe munch a leaf, monkey somersault or tiger roll. Paused motion shows a still response. Ordinary words have no surprise effects or extra keyboard stops.

Each chapter after the opening keeps its animated companion: lion in Invitation, elephant in Celebration, giraffe in Venue, tiger in RSVP and monkey in Gaming.

Gaming contains Tap Tap Tap, Hextris, 0h h1 and Safari Flyer. Tap Tap Tap now has eight rounds (12–42 blue taps with 30–38 seconds each), three hearts, escalating red hazards, up to 3× streak points, gold stars for extra time, time bonuses, a clear Next level button and a final celebration. Players can retry a failed level with its starting score or restart the whole run. Targets never overlap; symbols distinguish the colours. In-game pause preserves the timer, and hiding the browser automatically pauses play. Phone cards use compact illustrated previews. Scores remain inside the isolated game session and disappear when it is closed. Games never report scores, ask for nicknames or contact a service.

## Security and privacy

The invitation has no frontend runtime dependencies and makes no outbound API requests. Assets and game libraries are local. WhatsApp and Google Maps open only when a guest chooses their links. A static host may maintain access logs.

Games run in frames with `sandbox="allow-scripts"` and no same-origin, navigation, popup, forms or download privileges. They cannot read the invitation DOM or browser storage. A memory-only compatibility layer supports older game code; games have no cookies or persistent storage. Content policies block outbound fetch/XHR/WebSocket connections and external scripts. The only message games send to the invitation indicates that their start screen is ready.

The site asks search engines not to index it, but this is not access control. Event details and the WhatsApp recipient are public to anyone who can access the site. Use host access controls if needed. Vendored games are older upstream projects; preserve their isolation and content policies when editing them.

## Attribution

[public/credits.html](public/credits.html) contains licenses, attribution and downloadable complete modified game sources. After changing games, run `python3 scripts/package-game-sources.py` before building. `scripts/harden-games.py` documents the original one-time adaptation and should not be reapplied to already adapted games.

The venue card is an original SVG illustration. Google Maps provides real visitor photos; no third-party venue photograph is redistributed. Safari artwork and sprite sheets were generated with the built-in image generation tool; see [design/asset-notes.md](design/asset-notes.md) and [docs/animal-art-prompts.md](docs/animal-art-prompts.md).

## Verification

`npm test` checks assets, date validation, game content policies and absence of backend tooling. `npm run check:ready` checks event configuration.

Browser checks require installed Chrome on macOS, or `CHROME_PATH` pointing to Chrome elsewhere:

- `npm run build && npm run test:pages`: domain-root and repository-subpath loading, animal activities, visible animation, eager loading without placeholder faces, missing artwork, game loading, credits and source downloads.
- With `npm run dev` running: `node scripts/invitation-check.mjs` checks direct RSVP entry points, acceptance/decline replies, exact larger-party counts, WhatsApp URL encoding, clipboard/manual fallback, pending event settings and calendar timezone. WhatsApp is mocked; no messages are sent.
- With `npm run dev` running: `node scripts/motion-check.mjs` checks invisible future strokes (including rounded caps), the left-to-right writing timeline, supporting text appearing after the final stroke, replay, complete lettering with reduced motion, stable reading text, keyboard greetings, reduced-motion preferences and dialog motion.
- With `npm run preview -- --port 4173` running: `npm run test:navigation` checks viewport layouts at 320, 390, 768 and 1440px and in landscape; one visible chapter at a time; hidden-page focus exclusion; Next/Back, keyboard and swipe navigation; browser history; direct links and reloads; painted artwork; exiting games to chapters; and readable navigation without JavaScript.
- With `npm run preview -- --port 4173` running: `node scripts/game-check.mjs` exercises touch gameplay, replay, restart, closing, frame isolation and absence of external requests at phone and desktop widths.

- With the preview server running: `node scripts/taptaptap-check.mjs` plays all eight rounds and checks hearts, combos, bonus stars, target placement, pause, retries, time expiry and a fresh replay.

These checks use browser-emulated devices, not physical-device certification.
