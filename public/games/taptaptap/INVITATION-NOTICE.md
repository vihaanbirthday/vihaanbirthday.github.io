# Invitation distribution

Source: https://github.com/MahdiF/taptaptap

Revision: da4b06a051c8ad1ddeb429232e56478f02811fb7

Invitation adaptation, September 2026: local-only assets, telemetry removed, silent play, touch and responsive layout fixes. Original gameplay retained.

Tap Tap Tap: uses pointer events to avoid duplicate touch/click activation. Audio files are omitted.

Safari Flyer: uses Floppy Bird game logic under Apache-2.0; all original graphic and sound assets are omitted. CSS graphics and text-based score displays are original invitation adaptations. jQuery and jQuery Transit retain their upstream notices.

October 2026: result buttons request local PNG image sharing through the invitation’s parent page. The parent uses the configured WhatsApp contact and provides a download fallback. Sharing is initiated by the guest; the sandbox itself gains no downloads, navigation or network privileges.
