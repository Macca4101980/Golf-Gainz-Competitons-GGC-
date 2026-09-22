# GGC Build 3.8

- OOM now calculates from completed competitions instead of showing a permanent empty placeholder.
- Field-size OOM points follow the configured design: 5–8 entrants starts at 10 and falls by 2; 9–12 starts 12; 13–16 starts 14; 17+ starts 16. Blind-pairs team points are divided between partners.
- Competition setup adds 18 holes / Front 9 / Back 9.
- Nine-hole score entry shows only the selected nine, completion is 9 holes, and scoring uses the selected holes only.
- Nine-hole stroke allocation uses the tee's existing 18-hole Course Handicap and actual hole stroke indexes. This is a competition allocation method, not an official WHS 9-hole Course Handicap calculation; dedicated 9-hole CR/Slope data would be needed for that.
- Blind Pairs completion respects 9-hole competitions.
- White/light card secondary-button contrast is explicitly overridden for readability.
- PWA cache/version bumped to 3.8.
