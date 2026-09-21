# GGC Build 3.6 — PWA + Share GGC

- Installable Progressive Web App manifest.
- Standalone home-screen launch on supported devices.
- iPhone Apple home-screen metadata and touch icon.
- My Golf > Share GGC opens native share sheet (Mail, Messages, WhatsApp etc. where installed).
- Copy GGC Link fallback uses https://golfgainzcomps.co.uk/.
- Add GGC to Home Screen uses the browser install prompt where supported and iPhone Safari instructions otherwise.
- Service worker uses network-first navigation so new deployments are preferred, with cached fallback.
- Existing Build 3.5 scoring-engine work retained.
