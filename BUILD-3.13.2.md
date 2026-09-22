# GGC Build 3.13.2 — blank-screen hotfix
Root cause fixed: Build 3.13.1 used React useRef for the Live Sync write guard but did not import useRef.
This caused the app to fail during render and display a blank screen.
No feature logic changed. 3.13.1 Leave Society + Live Sync fixes are retained.
