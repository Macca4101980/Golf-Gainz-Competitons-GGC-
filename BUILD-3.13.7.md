# GGC Build 3.13.7
Realtime flicker/echo fix, based on 3.13.6.

Remote state received from Supabase is marked before React applies it. The autosave effect skips saving that exact remote state back to Supabase. Local changes still save normally. No database schema, scoring, competition, group, invite or permission logic was otherwise changed.
