# GGC Build 3.13.3 — recovery build
Built fresh from 3.13 (the last build before the blank-screen regression), not from 3.13.1/3.13.2.
- Retains 3.13 Realtime Live Sync.
- Retains 3.12.2 iPhone modal scrolling.
- Applies only the Leave Society fix: remove member, switch away, and immediately save the updated state to Supabase.
- Removes all useRef/local-write-guard changes introduced in the blank-screen builds.
