# Invitation UX review

Reviewed 7 October 2026, Mauritius time. Scope: the local Vihaan birthday invitation, source code, fresh desktop and mobile screenshots, and automated invitation and responsive checks. Findings and line references below describe the baseline before the improvements. Implementation status follows the findings.

The invitation has a strong visual identity and a clear primary action. The cream background, safari illustration, generous spacing, personal host names, and consistent dark-green RSVP buttons make it feel welcoming. Date, time, and venue appear together before the main RSVP action. Calendar downloads and persistent mobile RSVP/Directions actions support guests returning later to plan their visit. Keeping games after the RSVP section is a good hierarchy.

The largest opportunity is to give guests more control over motion and responses, then remove ambiguity from interactions. The psychological effects below are heuristic judgments supported by established usability guidance; they have not been measured with this site's guests.

## 1. High priority: provide control over continuous motion

**Observed:** Headline letters, emphasized words, heading phrases, picture framing, animals, hearts, and the message ribbon animate automatically. The motion test explicitly verifies that ribbon animation remains active with `prefers-reduced-motion: reduce`. Pausing behind dialogs is already implemented, but guests cannot pause motion while reading the invitation.

**Experience risk:** The main information competes with several moving elements for attention. Guests who need a stable reading experience cannot choose one. Motion sensitivity is also an accessibility concern.

**Recommendation:** Keep the headline and practical details stable. Retain brief, deliberate animal interactions and a small amount of gentle decorative motion. Respect the operating system's reduced-motion preference across CSS, canvas rendering, smooth scrolling, and comic bursts. Add an accessible pause/resume mechanism for the continuing ribbon and other automatic movement; an operating-system preference alone should not be treated as a complete pause-control audit.

**Implementation locations:** `style.css:13`, `style.css:44`, `main.js:14`, `safari-friends.js:23`, `scripts/motion-check.mjs`.

**Acceptance:** With reduced motion enabled, the invitation remains visually complete and readable without moving text, canvas loops, or surprise zooms. A guest can pause continuing motion while reading without keeping focus on a particular element. Update the existing tests that currently require full motion under reduced-motion settings.

W3C explains [pause controls for automatic movement](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) and [respecting reduced-motion preferences](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## 2. High priority: make both RSVP outcomes possible

**Observed:** The form requests a name and party size. Every generated message says the guest would love to attend. There is no decline option. “How many are joining?” does not explicitly say whether to include the person replying or children.

**Experience risk:** Guests who cannot attend must abandon the prepared flow and compose a separate message. Ambiguous headcounts can produce inaccurate replies and extra follow-up work for the hosts.

**Recommendation:** Add a simple attendance choice: “We'll be there” / “Sorry, we can't make it.” Show party size only for attending guests, labelled “Total guests, including you and children.” Generate an appropriate message for each answer. If an exact count matters for catering, allow guests with larger parties to enter it. Keep the existing name-first, single-column layout.

**Implementation locations:** `index.html:83`, `main.js:146`.

**Acceptance:** A guest can prepare an acceptance or decline without editing a contradictory message. Party size is clearly defined and is omitted from declines. Nothing is sent until the guest sends the message in WhatsApp.

This follows NN/g's guidance on [clear labels and conditional questions that reduce mental effort](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/).

## 3. Medium priority: make playful interactions predictable

**Observed:** Ordinary words such as “explorer,” “giggles,” and “magic” receive button roles and keyboard focus. Activating them triggers a comic burst and briefly hides the original word. Animal buttons announce a “playful jumpscare.” These controls sit within the reading content and headings.

**Experience risk:** Guests encounter controls whose labels do not explain their effect. Keyboard users must traverse extra stops between practical actions. Briefly disappearing words can interrupt reading. A surprise is not equally enjoyable for every guest.

**Recommendation:** Keep ordinary copy as text. Concentrate playful reactions on the animals with an explicit hint such as “Tap the animals to say hello.” Use a gentle wave or bounce, and give each control a meaningful action label, such as “Make the lion wave.” Keep these reactions compatible with reduced motion.

**Implementation locations:** `main.js:37`, `main.js:51`, `safari-friends.js:30`.

**Acceptance:** Reading text is not a sequence of unexplained buttons. Interactive animals have clear names and predictable reactions. Keyboard navigation reaches RSVP, calendar, directions, and games without decorative text controls between them.

The relevant principles are [recognition, user control, and clear system behavior](https://www.nngroup.com/articles/ten-usability-heuristics/).

## 4. Medium priority: make the WhatsApp handoff unmistakable

**Observed:** The website correctly says that guests must review and send their message in WhatsApp. It does not falsely claim that attendance is confirmed. A copy-message fallback and manual-copy recovery are implemented. The main page's RSVP buttons open a website form before WhatsApp opens.

**Experience risk:** Some guests may assume completing the form is the RSVP. They may also expect the “RSVP on WhatsApp” button to open WhatsApp immediately.

**Recommendation:** Preserve the honest status wording. Add a brief explanation near the first RSVP action: “Enter your name and guest count, then send your reply in WhatsApp.” Keep the final button labelled “Continue to WhatsApp.” After preparing the message, prominently state “Send your message in WhatsApp to finish your RSVP.” Retain the copy fallback. Add a small direct contact fallback if the hosts want replies from guests without WhatsApp.

**Implementation locations:** `index.html:41`, `index.html:83`, `main.js:154`.

**Acceptance:** Guests can explain when their reply reaches the hosts. Closing the website form alone is never presented as confirmation. Returning after a blocked handoff offers a visible next step.

NN/g recommends [setting expectations before and during a form](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/).

## 5. Lower priority: improve first-screen scanning

**Observed:** At 390 × 844 pixels, the event name, date, time, venue, and RSVP are visible in the first screen. This is already useful. The hero's practical text is substantially smaller than its three-line headline, and its date omits the year and its time omits the timezone. Those details are present farther down the page.

**Recommendation:** Preserve the hero structure. Give the date, time, and location slightly more visual weight. Use “Sunday 6 December 2026” and “11:30 am · Mauritius time” near the first action. Aim for approximately 16px for practical reading text on phones and check wrapping at 320px. Avoid enlarging secondary decorative labels at the expense of useful details.

**Implementation locations:** `index.html:39`, `main.js:179`, the final mobile overrides in `style.css`.

**Acceptance:** A guest can identify whose party it is, when it starts, where it is, and how to respond after a brief look at the first screen. No horizontal scrolling appears at narrow widths or increased text size.

## 6. Lower priority: label the venue illustration visibly

**Observed:** The venue image's alternative text correctly describes an illustration. Its visible caption says “A lovely place to make memories,” with a separate link to real venue photos on Google Maps.

**Experience risk:** A guest could interpret the drawn façade as a likeness of the actual restaurant and use it as an arrival landmark.

**Recommendation:** Change the caption to “A little illustration of our celebration” or add “Illustration” visibly. Keep the full address and Maps directions prominent. If the hosts later provide a real venue photo they can use, that would help guests recognize the destination.

**Implementation location:** `index.html:64`.

## Implemented improvements

- Added a header Pause/Resume animations control. Device reduced-motion preferences stop CSS decorations, smooth scrolling, and canvas loops. Paused ribbon phrases wrap so every phrase stays readable.
- Kept headings and emphasized words still and removed ordinary text from the button/tab sequence. Animal controls have descriptive greeting labels and small, deliberate greetings.
- Added explicit attendance choices. Party-size fields appear for acceptance, include the guest replying and children, and request exact counts for larger groups. Decline messages omit attendance counts and acceptance language.
- Explained the WhatsApp handoff before the form and in the prepared-message status. Preserved the copy/manual fallback and guest-controlled Send action.
- Increased practical mobile reading text and added the full year and Mauritius time to the hero. Visibly labelled the venue image as an illustration.

The optional direct-contact channel remains a host decision; no new contact method was invented. Physical-device and guest-comprehension testing remain useful next steps.

## Validation and limits

- `npm test`: passed source, asset, security, and event-validation checks.
- `npm run check:ready`: passed configured event details.
- `npm run build`: passed production build.
- `npm run test:pages`: passed production invitation, animal rendering/greetings, reduced motion, games, credits, and source downloads at the domain root and `/Birthday/` repository subpath.
- `scripts/invitation-check.mjs` against the local preview: passed direct RSVP entry points, focus restoration, acceptance and decline, exact headcounts, invalid-count rejection, mobile quick actions, message encoding, copy/manual fallback, calendar timezone, and configured/pending settings. WhatsApp was mocked; no messages were sent.
- `scripts/motion-check.mjs` against the local preview: passed layout checks at 320, 390, 768, and 1440px, readable moving and static ribbon phrases, stable reading text, keyboard greetings, pause/resume, device preference changes, and dialog motion pausing. The baseline tests requiring animation under reduced motion were corrected.
- Fresh desktop/mobile hero and page screenshots, plus mobile acceptance and decline form screenshots, were visually inspected.

The deployed website, physical devices, virtual-keyboard behavior, and guest comprehension were not tested. The computer-use browser surface was unavailable, so visual evidence came from the existing automated browser checks. This is a focused UX review, not a full accessibility certification or a claim of measured RSVP improvement.

For the next validation round, ask several representative guests, including an older relative and someone using a phone, to find the event details, accept, decline, and get directions. Observe whether they can finish without explanation and whether they understand that WhatsApp's Send action completes the reply.
