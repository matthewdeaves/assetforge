#!/usr/bin/env node
/*
 * Tank Sprite Exporter for Classic Mac
 *
 * Usage: node export-sprites.js [output-dir]
 *
 * Generates:
 *   - sprites.h      - C header with all sprite data
 *   - palette.h      - Color palette definitions
 *   - sprites.r      - Rez source file for resource compilation
 *   - sprites.bin    - Raw binary sprite data
 *   - PNG files      - Individual sprite images
 *
 * For use with:
 *   - Retro68 (modern cross-compiler for 68k Macs)
 *   - MPW (Macintosh Programmer's Workshop)
 *   - GraphicConverter (for PNG to PICT conversion)
 */

const fs = require('fs');
const path = require('path');

// Output directory
const outputDir = process.argv[2] || './export';

// ============================================================
// MASTER PALETTE - 16 colors
// ============================================================
const MASTER_PALETTE = [
    { index: 0,  hex: '#000000', name: 'transparent', r: 0, g: 0, b: 0 },
    { index: 1,  hex: '#1a1a1a', name: 'outline', r: 26, g: 26, b: 26 },
    { index: 2,  hex: '#333333', name: 'dark_gray', r: 51, g: 51, b: 51 },
    { index: 3,  hex: '#555555', name: 'mid_gray', r: 85, g: 85, b: 85 },
    { index: 4,  hex: '#777777', name: 'light_gray', r: 119, g: 119, b: 119 },
    { index: 5,  hex: '#999999', name: 'pale_gray', r: 153, g: 153, b: 153 },
    { index: 6,  hex: '#cc2222', name: 'red_dark', r: 204, g: 34, b: 34 },
    { index: 7,  hex: '#ff4444', name: 'red_bright', r: 255, g: 68, b: 68 },
    { index: 8,  hex: '#22aa22', name: 'green_dark', r: 34, g: 170, b: 34 },
    { index: 9,  hex: '#44ff44', name: 'green_bright', r: 68, g: 255, b: 68 },
    { index: 10, hex: '#2266cc', name: 'blue_dark', r: 34, g: 102, b: 204 },
    { index: 11, hex: '#4488ff', name: 'blue_bright', r: 68, g: 136, b: 255 },
    { index: 12, hex: '#ccaa22', name: 'yellow_dark', r: 204, g: 170, b: 34 },
    { index: 13, hex: '#ffdd44', name: 'yellow_bright', r: 255, g: 221, b: 68 },
    { index: 14, hex: '#8B7355', name: 'brown', r: 139, g: 115, b: 85 },
    { index: 15, hex: '#ffffff', name: 'white', r: 255, g: 255, b: 255 },
];

const TANK_COLORS = {
    red:    { outline: 1, dark: 6, mid: 6, bright: 7, highlight: 7, metal: 3, track: 2 },
    green:  { outline: 1, dark: 8, mid: 8, bright: 9, highlight: 9, metal: 3, track: 2 },
    blue:   { outline: 1, dark: 10, mid: 10, bright: 11, highlight: 11, metal: 3, track: 2 },
    yellow: { outline: 1, dark: 12, mid: 12, bright: 13, highlight: 13, metal: 3, track: 2 },
};

// ============================================================
// SPRITE GENERATORS
// ============================================================
function createTankSprite(colorScheme) {
    const c = colorScheme;
    const s = Array.from({length: 64}, () => Array(64).fill(0));
    const rect = (x, y, w, h, col) => {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (y+dy >= 0 && y+dy < 64 && x+dx >= 0 && x+dx < 64) s[y+dy][x+dx] = col;
            }
        }
    };

    // Tracks
    rect(2, 8, 18, 54, c.outline); rect(3, 9, 16, 52, c.track); rect(4, 10, 14, 50, c.track);
    for (let i = 0; i < 12; i++) rect(3, 12 + i*4, 16, 2, c.outline);
    rect(6, 12, 10, 46, c.metal); rect(8, 14, 6, 42, 4);

    rect(44, 8, 18, 54, c.outline); rect(45, 9, 16, 52, c.track); rect(46, 10, 14, 50, c.track);
    for (let i = 0; i < 12; i++) rect(45, 12 + i*4, 16, 2, c.outline);
    rect(48, 12, 10, 46, c.metal); rect(50, 14, 6, 42, 4);

    // Body
    rect(16, 10, 32, 50, c.outline); rect(17, 11, 30, 48, c.dark); rect(18, 12, 28, 46, c.mid);
    rect(20, 14, 24, 42, c.bright); rect(22, 16, 20, 16, c.highlight);

    // Turret
    rect(18, 22, 28, 28, c.dark); rect(20, 24, 24, 24, c.mid); rect(22, 26, 20, 20, c.bright);
    rect(24, 28, 16, 12, c.highlight); rect(26, 30, 12, 6, c.highlight);

    // Gun
    rect(26, 1, 12, 28, c.outline); rect(27, 2, 10, 26, c.metal); rect(28, 3, 8, 24, 4);
    rect(29, 4, 6, 22, 5); rect(30, 5, 4, 20, 5);
    rect(24, 1, 16, 6, c.outline); rect(25, 2, 14, 4, c.metal); rect(26, 3, 12, 2, 5);

    // Details
    rect(22, 56, 6, 6, c.metal); rect(23, 57, 4, 4, c.track);
    rect(36, 56, 6, 6, c.metal); rect(37, 57, 4, 4, c.track);
    rect(29, 32, 6, 6, c.metal); rect(30, 33, 4, 4, 5);

    return s;
}

function rotateSprite90(sprite) {
    const size = sprite.length;
    return Array.from({length: size}, (_, x) =>
        Array.from({length: size}, (_, y) => sprite[size - 1 - y][x])
    );
}

function createGroundTile(type) {
    const s = Array.from({length: 32}, () => Array(32).fill(0));
    const rect = (x, y, w, h, c) => {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (y+dy >= 0 && y+dy < 32 && x+dx >= 0 && x+dx < 32) s[y+dy][x+dx] = c;
            }
        }
    };

    // Use seeded random for reproducibility
    let seed = type.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    if (type === 'ground') {
        rect(0, 0, 32, 32, 14);
        for (let i = 0; i < 20; i++) {
            s[Math.floor(rand() * 30)][Math.floor(rand() * 30)] = rand() > 0.5 ? 3 : 2;
        }
    } else if (type === 'road_h') {
        rect(0, 0, 32, 32, 14);
        rect(0, 10, 32, 12, 2);
        rect(0, 11, 32, 10, 3);
        for (let x = 2; x < 32; x += 8) rect(x, 15, 4, 2, 5);
    } else if (type === 'road_v') {
        rect(0, 0, 32, 32, 14);
        rect(10, 0, 12, 32, 2);
        rect(11, 0, 10, 32, 3);
        for (let y = 2; y < 32; y += 8) rect(15, y, 2, 4, 5);
    } else if (type === 'water') {
        rect(0, 0, 32, 32, 10);
        for (let y = 0; y < 32; y += 4) {
            for (let x = 0; x < 32; x++) {
                if (Math.sin((x + y) * 0.4) > 0.3) s[y][x] = 11;
            }
        }
    }
    return s;
}

function createObstacle(type) {
    const s = Array.from({length: 64}, () => Array(64).fill(0));
    const rect = (x, y, w, h, c) => {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (y+dy >= 0 && y+dy < 64 && x+dx >= 0 && x+dx < 64) s[y+dy][x+dx] = c;
            }
        }
    };
    const circle = (cx, cy, r, c) => {
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x*x + y*y <= r*r) {
                    const px = cx + x, py = cy + y;
                    if (px >= 0 && px < 64 && py >= 0 && py < 64) s[py][px] = c;
                }
            }
        }
    };

    if (type === 'crate') {
        rect(6, 6, 52, 52, 1); rect(7, 7, 50, 50, 14); rect(8, 8, 48, 48, 14);
        rect(8, 18, 48, 3, 2); rect(8, 31, 48, 3, 2); rect(8, 44, 48, 3, 2);
        rect(8, 8, 8, 8, 3); rect(48, 8, 8, 8, 3); rect(8, 48, 8, 8, 3); rect(48, 48, 8, 8, 3);
    } else if (type === 'barrel') {
        circle(32, 32, 26, 1); circle(32, 32, 24, 6); circle(32, 32, 22, 7);
        circle(32, 32, 10, 3); circle(32, 32, 8, 4);
        rect(28, 14, 8, 4, 6); rect(28, 46, 8, 4, 6);
    } else if (type === 'steel') {
        rect(4, 4, 56, 56, 1); rect(5, 5, 54, 54, 2); rect(6, 6, 52, 52, 3); rect(8, 8, 48, 48, 4);
        rect(12, 12, 18, 18, 5); rect(34, 12, 18, 18, 5);
        rect(12, 34, 18, 18, 5); rect(34, 34, 18, 18, 5);
    } else if (type === 'rock') {
        circle(32, 32, 26, 1); circle(32, 32, 24, 2); circle(32, 32, 20, 3);
        circle(32, 32, 14, 4); circle(26, 26, 6, 5);
    } else if (type === 'debris') {
        rect(10, 40, 16, 12, 1); rect(11, 41, 14, 10, 3);
        rect(38, 44, 14, 12, 1); rect(39, 45, 12, 10, 4);
        rect(24, 20, 10, 10, 1); rect(25, 21, 8, 8, 3);
    }
    return s;
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================
function generatePaletteH() {
    let out = `/*
 * palette.h - Tank Game Color Palette
 * 16-color indexed palette for Classic Mac (System 6-9)
 * Generated by export-sprites.js
 */

#ifndef PALETTE_H
#define PALETTE_H

/* RGB values (0-255) */
typedef struct { unsigned char r, g, b; } RGB8;

static const RGB8 gPalette[16] = {
`;
    MASTER_PALETTE.forEach((c, i) => {
        out += `    { ${c.r.toString().padStart(3)}, ${c.g.toString().padStart(3)}, ${c.b.toString().padStart(3)} }${i < 15 ? ',' : ''} /* ${i}: ${c.name} */\n`;
    });
    out += `};

/* Mac 16-bit RGB format for Color QuickDraw */
typedef struct { short value; unsigned short red, green, blue; } MacColorSpec;

static const MacColorSpec gMacPalette[16] = {
`;
    MASTER_PALETTE.forEach((c, i) => {
        const r16 = c.r * 257;
        const g16 = c.g * 257;
        const b16 = c.b * 257;
        out += `    { ${i}, 0x${r16.toString(16).padStart(4,'0')}, 0x${g16.toString(16).padStart(4,'0')}, 0x${b16.toString(16).padStart(4,'0')} }${i < 15 ? ',' : ''}\n`;
    });
    out += `};

#endif /* PALETTE_H */
`;
    return out;
}

function spriteToPackedArray(name, sprite) {
    const size = sprite.length;
    let out = `/* ${name} (${size}x${size}, packed 4-bit, ${size * size / 2} bytes) */\n`;
    out += `static const unsigned char ${name}[${size * size / 2}] = {\n`;

    const bytes = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x += 2) {
            const byte = ((sprite[y][x] & 0x0F) << 4) | (sprite[y][x+1] & 0x0F);
            bytes.push('0x' + byte.toString(16).padStart(2, '0'));
        }
    }

    // Format 16 bytes per line
    for (let i = 0; i < bytes.length; i += 16) {
        out += '    ' + bytes.slice(i, i + 16).join(', ');
        if (i + 16 < bytes.length) out += ',';
        out += '\n';
    }
    out += '};\n\n';
    return out;
}

function generateSpritesH(tanks, tiles, obstacles) {
    let out = `/*
 * sprites.h - Tank Game Sprite Data
 * For Classic Mac (System 6-9)
 * Generated by export-sprites.js
 *
 * Format: Packed 4-bit indexed color (2 pixels per byte)
 * Use with CopyBits() after unpacking or direct PixMap manipulation
 */

#ifndef SPRITES_H
#define SPRITES_H

#include "palette.h"

/* Sprite dimensions */
#define TANK_SIZE    64
#define TILE_SIZE    32
#define OBSTACLE_SIZE 64

/* Tank sprites (64x64 = 2048 bytes each) */
`;

    for (const color of ['red', 'green', 'blue', 'yellow']) {
        for (const dir of ['up', 'right', 'down', 'left']) {
            out += spriteToPackedArray(`gTank_${color}_${dir}`, tanks[color][dir]);
        }
    }

    out += `/* Ground tiles (32x32 = 512 bytes each) */\n`;
    for (const [name, sprite] of Object.entries(tiles)) {
        out += spriteToPackedArray(`gTile_${name}`, sprite);
    }

    out += `/* Obstacles (64x64 = 2048 bytes each) */\n`;
    for (const [name, sprite] of Object.entries(obstacles)) {
        out += spriteToPackedArray(`gObstacle_${name}`, sprite);
    }

    out += `#endif /* SPRITES_H */\n`;
    return out;
}

function generateRezSource(tanks, tiles, obstacles) {
    // Generate hex data for a sprite, split into lines of 64 chars
    const spriteToHex = (sprite) => {
        const bytes = [];
        const size = sprite.length;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x += 2) {
                const byte = ((sprite[y][x] & 0x0F) << 4) | (sprite[y][x+1] & 0x0F);
                bytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
            }
        }
        // Split into lines of 32 bytes (64 hex chars) for readability
        const lines = [];
        for (let i = 0; i < bytes.length; i += 32) {
            lines.push('$"' + bytes.slice(i, i + 32).join('') + '"');
        }
        return lines.join('\n    ');
    };

    let out = `/*
 * sprites.r - Tank Game Resources
 * Rez source file for Classic Mac (Retro68 compatible)
 *
 * Compile with:
 *   Rez -I types.r sprites.r -o sprites.rsrc
 *
 * Note: Include types.r before this file (generated by build script)
 */

/* Color Palette - 16 colors for indexed sprites */
data 'PLTT' (128, "GamePalette") {
`;
    // Output palette as raw data: count (2 bytes) + entries (index:2, r:2, g:2, b:2)
    // Big-endian format for 68k Mac
    const paletteBytes = [];
    // Count
    paletteBytes.push('00', '10');  // 16 colors
    MASTER_PALETTE.forEach((c, i) => {
        const r16 = c.r * 257;
        const g16 = c.g * 257;
        const b16 = c.b * 257;
        paletteBytes.push(
            ((i >> 8) & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            (i & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            ((r16 >> 8) & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            (r16 & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            ((g16 >> 8) & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            (g16 & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            ((b16 >> 8) & 0xFF).toString(16).padStart(2, '0').toUpperCase(),
            (b16 & 0xFF).toString(16).padStart(2, '0').toUpperCase()
        );
    });
    // Format as hex strings
    for (let i = 0; i < paletteBytes.length; i += 32) {
        out += '    $"' + paletteBytes.slice(i, i + 32).join('') + '"\n';
    }
    out += `};

/* ========================================
   Tank Sprites (64x64 pixels, 4-bit packed)
   Format: 2 bytes width, 2 bytes height, then pixel data
   ======================================== */
`;

    let resID = 128;
    for (const color of ['red', 'green', 'blue', 'yellow']) {
        for (const dir of ['up', 'right', 'down', 'left']) {
            const sprite = tanks[color][dir];
            out += `data 'SPRT' (${resID}, "tank_${color}_${dir}") {\n`;
            // Header: width and height as big-endian 16-bit
            out += `    $"0040"  /* width: 64 */\n`;
            out += `    $"0040"  /* height: 64 */\n`;
            out += `    /* Pixel data (2048 bytes) */\n`;
            out += `    ${spriteToHex(sprite)}\n`;
            out += `};\n\n`;
            resID++;
        }
    }

    out += `/* ========================================
   Ground Tiles (32x32 pixels, 4-bit packed)
   ======================================== */
`;
    resID = 200;
    for (const [name, sprite] of Object.entries(tiles)) {
        out += `data 'TILE' (${resID}, "tile_${name}") {\n`;
        out += `    $"0020"  /* width: 32 */\n`;
        out += `    $"0020"  /* height: 32 */\n`;
        out += `    /* Pixel data (512 bytes) */\n`;
        out += `    ${spriteToHex(sprite)}\n`;
        out += `};\n\n`;
        resID++;
    }

    out += `/* ========================================
   Obstacles (64x64 pixels, 4-bit packed)
   ======================================== */
`;
    resID = 300;
    for (const [name, sprite] of Object.entries(obstacles)) {
        out += `data 'OBST' (${resID}, "obstacle_${name}") {\n`;
        out += `    $"0040"  /* width: 64 */\n`;
        out += `    $"0040"  /* height: 64 */\n`;
        out += `    /* Pixel data (2048 bytes) */\n`;
        out += `    ${spriteToHex(sprite)}\n`;
        out += `};\n\n`;
        resID++;
    }

    return out;
}

function generateBinaryFile(tanks, tiles, obstacles) {
    const sprites = [];

    // Add tanks
    for (const color of ['red', 'green', 'blue', 'yellow']) {
        for (const dir of ['up', 'right', 'down', 'left']) {
            sprites.push({ name: `tank_${color}_${dir}`, data: tanks[color][dir], size: 64 });
        }
    }

    // Add tiles
    for (const [name, sprite] of Object.entries(tiles)) {
        sprites.push({ name: `tile_${name}`, data: sprite, size: 32 });
    }

    // Add obstacles
    for (const [name, sprite] of Object.entries(obstacles)) {
        sprites.push({ name: `obstacle_${name}`, data: sprite, size: 64 });
    }

    // Calculate total size
    const headerSize = 8 + sprites.length * 8; // magic + count + entries
    let dataOffset = headerSize;
    const entries = sprites.map(s => {
        const dataSize = (s.size * s.size) / 2;
        const entry = { ...s, offset: dataOffset, dataSize };
        dataOffset += dataSize;
        return entry;
    });

    const buffer = Buffer.alloc(dataOffset);
    let pos = 0;

    // Header
    buffer.write('TNKS', pos); pos += 4;  // Magic
    buffer.writeUInt16BE(sprites.length, pos); pos += 2;  // Count
    buffer.writeUInt16BE(4, pos); pos += 2;  // Bits per pixel

    // Sprite entries
    for (const entry of entries) {
        buffer.writeUInt16BE(entry.size, pos); pos += 2;  // Width
        buffer.writeUInt16BE(entry.size, pos); pos += 2;  // Height
        buffer.writeUInt32BE(entry.offset, pos); pos += 4;  // Offset
    }

    // Sprite data
    for (const entry of entries) {
        const sprite = entry.data;
        for (let y = 0; y < entry.size; y++) {
            for (let x = 0; x < entry.size; x += 2) {
                const byte = ((sprite[y][x] & 0x0F) << 4) | (sprite[y][x+1] & 0x0F);
                buffer.writeUInt8(byte, pos++);
            }
        }
    }

    return buffer;
}

function generatePPM(sprite, name) {
    // Generate PPM (Portable Pixmap) - simple format that can be converted
    const size = sprite.length;
    let out = `P3\n# ${name}\n${size} ${size}\n255\n`;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const c = MASTER_PALETTE[sprite[y][x]];
            out += `${c.r} ${c.g} ${c.b}\n`;
        }
    }
    return out;
}

function generateManifest(tanks, tiles, obstacles) {
    const manifest = {
        format: 'Tank Game Sprites',
        version: '1.0',
        palette: MASTER_PALETTE,
        sprites: {
            tanks: [],
            tiles: [],
            obstacles: []
        }
    };

    for (const color of ['red', 'green', 'blue', 'yellow']) {
        for (const dir of ['up', 'right', 'down', 'left']) {
            manifest.sprites.tanks.push({
                name: `tank_${color}_${dir}`,
                width: 64,
                height: 64,
                color,
                direction: dir
            });
        }
    }

    for (const name of Object.keys(tiles)) {
        manifest.sprites.tiles.push({ name: `tile_${name}`, width: 32, height: 32 });
    }

    for (const name of Object.keys(obstacles)) {
        manifest.sprites.obstacles.push({ name: `obstacle_${name}`, width: 64, height: 64 });
    }

    return JSON.stringify(manifest, null, 2);
}

// ============================================================
// MAIN
// ============================================================
function main() {
    console.log('Tank Sprite Exporter for Classic Mac');
    console.log('=====================================\n');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`Output directory: ${outputDir}\n`);

    // Generate sprites
    console.log('Generating sprites...');

    const tanks = {};
    for (const color of ['red', 'green', 'blue', 'yellow']) {
        const base = createTankSprite(TANK_COLORS[color]);
        tanks[color] = {
            up: base,
            right: rotateSprite90(base),
            down: rotateSprite90(rotateSprite90(base)),
            left: rotateSprite90(rotateSprite90(rotateSprite90(base)))
        };
    }
    console.log('  - 16 tank sprites (4 colors x 4 directions)');

    const tiles = {
        ground: createGroundTile('ground'),
        road_h: createGroundTile('road_h'),
        road_v: createGroundTile('road_v'),
        water: createGroundTile('water')
    };
    console.log('  - 4 ground tiles');

    const obstacles = {
        crate: createObstacle('crate'),
        barrel: createObstacle('barrel'),
        steel: createObstacle('steel'),
        rock: createObstacle('rock'),
        debris: createObstacle('debris')
    };
    console.log('  - 5 obstacle sprites');

    // Export files
    console.log('\nExporting files...');

    // C Headers
    fs.writeFileSync(path.join(outputDir, 'palette.h'), generatePaletteH());
    console.log('  - palette.h');

    fs.writeFileSync(path.join(outputDir, 'sprites.h'), generateSpritesH(tanks, tiles, obstacles));
    console.log('  - sprites.h');

    // Rez source
    fs.writeFileSync(path.join(outputDir, 'sprites.r'), generateRezSource(tanks, tiles, obstacles));
    console.log('  - sprites.r');

    // Binary
    fs.writeFileSync(path.join(outputDir, 'sprites.bin'), generateBinaryFile(tanks, tiles, obstacles));
    console.log('  - sprites.bin');

    // Manifest
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), generateManifest(tanks, tiles, obstacles));
    console.log('  - manifest.json');

    // PPM images (can be converted to PNG/PICT with ImageMagick or GraphicConverter)
    const ppmDir = path.join(outputDir, 'ppm');
    if (!fs.existsSync(ppmDir)) fs.mkdirSync(ppmDir);

    for (const color of ['red', 'green', 'blue', 'yellow']) {
        for (const dir of ['up', 'right', 'down', 'left']) {
            const name = `tank_${color}_${dir}`;
            fs.writeFileSync(path.join(ppmDir, `${name}.ppm`), generatePPM(tanks[color][dir], name));
        }
    }
    for (const [name, sprite] of Object.entries(tiles)) {
        fs.writeFileSync(path.join(ppmDir, `tile_${name}.ppm`), generatePPM(sprite, `tile_${name}`));
    }
    for (const [name, sprite] of Object.entries(obstacles)) {
        fs.writeFileSync(path.join(ppmDir, `obstacle_${name}.ppm`), generatePPM(sprite, `obstacle_${name}`));
    }
    console.log('  - ppm/*.ppm (25 image files)');

    console.log('\nDone! Files exported to:', outputDir);
    console.log('\nNext steps:');
    console.log('  1. Include sprites.h in your Retro68/MPW project');
    console.log('  2. Or compile sprites.r with Rez to create a resource file');
    console.log('  3. Convert PPM files to PICT using GraphicConverter if needed');
    console.log('     (or use ImageMagick: convert *.ppm *.png)');
}

main();
