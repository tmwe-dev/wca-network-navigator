

## Problem
The `onWheel` handler on the carousel fires on every single trackpad scroll event, causing the cards to "race" uncontrollably with two-finger gestures. The user wants this removed entirely for now.

## Fix
Remove the `onWheel` handler from the carousel container (lines 311-314). This is a single-line deletion — the wheel/trackpad will simply do nothing on the carousel area, which is the desired behavior. Keyboard arrows and click selection remain functional.

The user also wants focus shifted to making the download functionality work properly rather than visual effects. After this fix, I'll ask what specific download flow needs attention.

