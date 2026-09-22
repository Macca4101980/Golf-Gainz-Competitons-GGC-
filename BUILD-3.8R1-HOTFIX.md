# Build 3.8R1 OOM hotfix
Fixed OOM crash when a completed Blind Pairs competition has a saved draw.
The OOM loop was calling `.forEach()` on the pair result object instead of its `ids` array.
No scoring results or existing competition data are changed.
