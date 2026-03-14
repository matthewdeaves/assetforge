#!/bin/bash
#
# build-mac-resources.sh - Build Classic Mac resources from sprite data
#
# Uses Retro68 toolchain to compile resources and create disk images
# for use on real classic Macs or emulators (Mini vMac, Basilisk II, etc.)
#
# Output:
#   export/
#     sprites.rsrc     - Compiled resource file (AppleSingle on Linux)
#     sprites.bin      - MacBinary format (for transfer to Mac)
#     TankAssets.dsk   - HFS disk image (800K floppy)
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RETRO68_BIN="/home/matthew/Retro68-build/toolchain/bin"
RETRO68_RINCLUDES="/home/matthew/Retro68-build/toolchain/RIncludes"
OUTPUT_DIR="${SCRIPT_DIR}/export"
DISK_SIZE="800k"  # Classic Mac 800K floppy

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "Tank Game Resource Builder for Classic Mac"
echo "=============================================="
echo ""

# Check for Retro68 tools
check_tool() {
    if [ ! -x "${RETRO68_BIN}/$1" ]; then
        echo -e "${RED}Error: $1 not found at ${RETRO68_BIN}/${NC}"
        echo "Make sure Retro68 is properly installed."
        exit 1
    fi
}

echo "Checking Retro68 toolchain..."
check_tool "Rez"
check_tool "hformat"
check_tool "hmount"
check_tool "hcopy"
check_tool "humount"
echo -e "${GREEN}  All tools found.${NC}"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/ppm"

# Step 1: Generate sprite data (run our Node.js exporter)
echo "Step 1: Generating sprite data..."
if [ -f "${SCRIPT_DIR}/export-sprites.js" ]; then
    node "${SCRIPT_DIR}/export-sprites.js" "${OUTPUT_DIR}"
    echo -e "${GREEN}  Sprite data generated.${NC}"
else
    echo -e "${RED}Error: export-sprites.js not found${NC}"
    exit 1
fi
echo ""

# Step 2: Compile resources with Rez
echo "Step 2: Compiling resources with Rez..."
cd "${OUTPUT_DIR}"

# Check if sprites.r exists
if [ ! -f "sprites.r" ]; then
    echo -e "${RED}Error: sprites.r not found in ${OUTPUT_DIR}${NC}"
    exit 1
fi

# Compile with Rez
# sprites.r uses 'data' resources which don't need type definitions
# Retro68's Rez outputs in AppleDouble format on Linux:
#   sprites.rsrc     - empty data fork
#   .rsrc/sprites.rsrc - resource fork data
#   .finf/sprites.rsrc - Finder info
"${RETRO68_BIN}/Rez" \
    -o sprites.rsrc \
    -t rsrc \
    -c RSED \
    sprites.r 2>&1

# Check if resource fork was created in AppleDouble format
RSRC_SIZE=0
if [ -f ".rsrc/sprites.rsrc" ]; then
    RSRC_SIZE=$(stat -c%s ".rsrc/sprites.rsrc" 2>/dev/null || stat -f%z ".rsrc/sprites.rsrc")
fi

if [ "$RSRC_SIZE" -gt 0 ]; then
    echo -e "${GREEN}  Resources compiled: sprites.rsrc (${RSRC_SIZE} bytes in resource fork)${NC}"
else
    echo -e "${RED}Error: Failed to compile resources${NC}"
    exit 1
fi
echo ""

# Step 3: Create MacBinary file for easy transfer
echo "Step 3: Creating MacBinary file..."

# Use our custom MacBinary generator which properly reads AppleDouble format
node "${SCRIPT_DIR}/make-macbinary.js" sprites.rsrc sprites.bin

if [ -f "sprites.bin" ] && [ -s "sprites.bin" ]; then
    BIN_SIZE=$(stat -c%s "sprites.bin" 2>/dev/null || stat -f%z "sprites.bin")
    echo -e "${GREEN}  MacBinary created: sprites.bin (${BIN_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}  MacBinary creation failed${NC}"
fi
echo ""

# Step 4: Create HFS disk image
echo "Step 4: Creating HFS disk image..."
DISK_IMG="${OUTPUT_DIR}/TankAssets.dsk"
rm -f "${DISK_IMG}"

# Create 800K disk image
dd if=/dev/zero of="${DISK_IMG}" bs=1k count=800 2>/dev/null
"${RETRO68_BIN}/hformat" -l "TankAssets" "${DISK_IMG}"

# Mount the disk
"${RETRO68_BIN}/hmount" "${DISK_IMG}"

# Copy the MacBinary file to HFS - this properly decodes both forks
# The -m flag tells hcopy this is a MacBinary file to decode
"${RETRO68_BIN}/hcopy" -m sprites.bin :Sprites.rsrc 2>&1

# Also copy the C headers for developers who want to include directly
"${RETRO68_BIN}/hcopy" -t palette.h :palette.h 2>/dev/null || true
"${RETRO68_BIN}/hcopy" -t sprites.h :sprites.h 2>/dev/null || true

# Create a readme file
cat > readme.txt << 'MACEOF'
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
MACEOF
"${RETRO68_BIN}/hcopy" -t readme.txt :ReadMe

# Show disk contents
echo "Disk contents:"
"${RETRO68_BIN}/hls" -la :

# Unmount
"${RETRO68_BIN}/humount"

echo ""
echo -e "${GREEN}  HFS disk image created: TankAssets.dsk${NC}"
echo ""

# Step 5: Create PNG previews if ImageMagick is available
echo "Step 5: Creating PNG previews..."
if command -v convert &> /dev/null; then
    cd "${OUTPUT_DIR}/ppm"
    for ppm in *.ppm; do
        png="${ppm%.ppm}.png"
        convert "$ppm" "$png" 2>/dev/null && rm "$ppm"
    done
    echo -e "${GREEN}  PNG files created in export/ppm/${NC}"
else
    echo -e "${YELLOW}  ImageMagick not found, keeping PPM files${NC}"
fi
echo ""

# Summary
echo "=============================================="
echo -e "${GREEN}Build complete!${NC}"
echo "=============================================="
echo ""
echo "Output files in ${OUTPUT_DIR}:"
echo "  sprites.rsrc    - Compiled Mac resources (AppleSingle format)"
echo "  sprites.bin     - MacBinary format for file transfer"
echo "  TankAssets.dsk  - 800K HFS floppy disk image"
echo "  sprites.h       - C header with inline sprite data"
echo "  palette.h       - C header with palette definitions"
echo "  manifest.json   - Asset manifest"
echo ""
echo "To use with an emulator:"
echo "  Mini vMac:     Drag TankAssets.dsk to the emulator window"
echo "  Basilisk II:   Add TankAssets.dsk as a floppy in preferences"
echo "  SheepShaver:   Add TankAssets.dsk as a volume"
echo ""
echo "To transfer to real Mac:"
echo "  Use sprites.bin (MacBinary) via serial, network, or SD card"
echo ""
