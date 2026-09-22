# GGC Build 3.9 — authentication test build
- Keeps the verified-format-only scoring menu from 3.8R2.
- Keeps OOM, 9-hole, editable HI and handicap snapshot fixes.
- Clarifies first-time email verification vs sign-in-code wording.
- Passkey wording now says Passkey / Face ID and explains that iPhone may present another passkey method.
- Existing authenticated sessions continue to restore automatically; no extra prompt is intentionally added on normal app open.
- Adds My Golf -> Login Testing -> Reset Login On This Device.
- Reset signs out and clears this device's GGC auth/local cache, but deliberately does NOT claim to delete the Supabase Auth user or cloud competition history.
- A true 'brand-new email account' reset still requires a secure server-side/admin user deletion capability; no service-role credential is embedded in the browser.
