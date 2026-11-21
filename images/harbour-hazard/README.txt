HARBOUR HAZARD — ENVIRONMENT ASSET PACK

Contents
- harbour_atlas_01_cleaned.png: cleaned first harbour atlas
- harbour_atlas_02_cleaned.png: cleaned second harbour atlas
- boat_smoke_1.png through boat_smoke_6.png: six smoke puff frames

The two atlas images preserve the original layout and pixel-art scale.
The smoke frames are intended to be played in sequence as a looping puff
animation behind a moving boat. Use nearest-neighbour scaling.

Suggested smoke animation:
- frame order: boat_smoke_1.png to boat_smoke_6.png
- frame duration: 100–140 ms per frame
- loop continuously while the boat is moving
- position the puff at the boat's exhaust, drifting slightly backward
- hide or reduce the smoke when the boat is stationary

Note: the source artwork was generated as a packed atlas, not as individually
separated production sprites. The cleaned atlases are provided intact so
individual boats, docks, nets, buoys and props can be cropped precisely
during game implementation without losing their original artwork.
