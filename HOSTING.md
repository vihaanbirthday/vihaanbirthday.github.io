# Publishing Vihaan's invitation

1. Fill in `event-config.js` with the confirmed date, start time, and WhatsApp number. The date and time are in Mauritius, UTC+04:00. The number must include the country code, using digits only.
2. Run `npm run check:ready`. It reports any missing or invalid event details.
3. Run `npm test` and `npm run build`.
4. Publish the **contents of `dist/`** using HTTPS.

## GitHub Pages

1. Push this project to [vihaanbirthday/vihaanbirthday.github.io](https://github.com/vihaanbirthday/vihaanbirthday.github.io), including `.github/workflows/deploy.yml`, `package.json`, and `package-lock.json`. The workflow deploys from `main`. GitHub requires this repository name to serve the account's root Pages URL.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, or push a commit to `main`.
4. Open the URL shown by the completed deployment: `https://vihaanbirthday.github.io/` (unless a custom domain is configured).

The workflow installs dependencies, runs source checks, builds, and uploads only `dist/`. Do not select branch-based publishing of the source directory. Relative URLs support repository sites, account sites, and custom domains without entering a repository name in the configuration.

Event details can remain pending for a preview deployment. Before sharing, fill in `event-config.js` and run `npm run check:ready`; missing details do not block deployment.

GitHub Pages does not apply the Netlify-style `public/_headers` file or `vercel.json`. HTML content-security policies and iframe sandbox restrictions still apply, but additional custom HTTP headers (including `frame-ancestors`) require a host that supports them.

For a local production check, run `npm run build` then `npm run test:pages`. This checks both the domain root and a repository subpath using a static server without an SPA fallback. It requires installed Chrome (or `CHROME_PATH`). The workflow itself runs `npm test` and the build.

References: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite deployment guide](https://vite.dev/guide/static-deploy.html).

## Netlify

For a repository deployment, use build command `npm run build` and output directory `dist`. For a manual Netlify deployment, upload `dist/` or the extracted hosting ZIP. Keep `_headers` in the upload: it provides the security headers.

## Vercel

Deploy the project repository. The root `vercel.json` specifies the build output and security headers. Do not copy that configuration into `dist/`, because it describes the source-project build.

## Other hosting

Publish `dist/` and translate `public/_headers` into your host's HTTP-header configuration. The HTML also carries content-security policies. The frame-ancestor rule must be supplied as an HTTP header. Confirm the configured headers using your browser's Network panel after publication.

This build uses relative paths and supports a domain root or a nested folder such as `/birthday/`. Use the folder URL with its trailing slash (static hosts normally redirect to it).

## Hosting ZIP

After rebuilding, run `python3 scripts/package-site.py` to update `vihaan-invitation.zip`. Only public production files are packaged; dependencies, project source, reference artwork, and local test results are excluded. Complete source archives for the open-source games remain included for license compliance.

Run `npm run check:ready` to verify the event settings before sharing. Calendar and directed WhatsApp RSVP appear only when their corresponding settings are valid. The site needs no backend or database.

## Final live check

Open the HTTPS site on your phone. Check the displayed date and time, open each game, open Maps, and confirm that the RSVP button prepares a message to your intended WhatsApp recipient. The site never sends the message itself. Website event details and the RSVP recipient are public; use your host's access controls if you need a private invitation.

## Game result sharing

All four games offer **Share final score** on their result screens. A PNG result image is generated locally. On devices with file sharing, choose WhatsApp and Madhav in the share sheet. Otherwise, download the image, open the directed WhatsApp chat, and attach it yourself. The recipient comes from `event-config.js`; WhatsApp requires the guest to send the message. 0h h1 shares the completed puzzle size and its total points for this visit.

To check sharing and gameplay locally, run the production preview server, then `npm run test:sharing` (or set `TEST_URL` if the preview uses another port). This covers result images, configured contact, download fallback, cancellation, replay, and phone portrait/landscape layouts.
