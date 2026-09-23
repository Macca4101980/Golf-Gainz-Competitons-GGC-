# GGC Build 3.2
Stability and UX build based on 3.13.8.

Implemented:
- Explicit Group selection before Delete Group, with immediate cloud persistence before navigation.
- Settings course library independent of the active Group.
- Add Course captures course name, tee, Slope Rating, Course Rating, 18 Pars and 18 unique Stroke Indexes.
- Shared courses are available to all Groups.
- Settings Admin role changes immediately persist.
- Create Group / Join Group immediately persist.
- End / Cancel / Reopen Competition immediately persist.
- Clearer ← ALL GROUPS button.
- Home CTA replaced by How to use GGC with the five-step flow.
- Score entry: blank + starts at Par; blank - starts at Birdie.
- Existing Realtime echo guard and 3.13.8 member-management fixes retained.

Known limitation:
Simultaneous live scoring still uses the shared ggc_state document. This build does not claim to eliminate multi-device score-write collisions; normalized score storage is the next structural task.
