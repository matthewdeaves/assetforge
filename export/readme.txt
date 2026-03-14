Tank Game Assets for Classic Mac
=================================

This disk contains:

- Sprites.rsrc: Compiled resource file with all game sprites
  Contains: SPRT (tanks), TILE (ground), OBST (obstacles), PLTT (palette)

- palette.h: C header with color palette definitions
- sprites.h: C header with raw sprite data arrays

Resource IDs:
  SPRT 128-143: Tank sprites (4 colors x 4 directions)
  TILE 200-203: Ground tiles (ground, road_h, road_v, water)
  OBST 300-304: Obstacles (crate, barrel, steel, rock, debris)
  PLTT 128: Master palette (16 colors)

Usage in your game:
  Handle h = GetResource('SPRT', 128);  /* Get red tank facing up */

For use with Retro68, MPW, or THINK C.
