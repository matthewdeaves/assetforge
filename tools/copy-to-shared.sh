#!/bin/bash
#
# Copy PICT files to QemuMac shared disk for testing on classic Mac
#
# Usage:
#   ./copy-to-shared.sh file.pict [file2.pict ...]
#   ./copy-to-shared.sh   (no args = copies the test yellow tank)
#

set -e

HFSUTILS="/home/matthew/Retro68-build/toolchain/bin"
SHARED_DISK="/home/matthew/QemuMac/shared/shared-disk.img"

if [ ! -f "$SHARED_DISK" ]; then
    echo "Error: shared disk not found at $SHARED_DISK"
    exit 1
fi

# Default: copy the test yellow tank
if [ $# -eq 0 ]; then
    # Generate fresh yellow tank PICT if needed
    TANK_JSON="/tmp/yellow_tank.json"
    TANK_PICT="/tmp/yellow_tank_with_header.pict"

    if [ ! -f "$TANK_PICT" ]; then
        echo "Generating yellow tank PICT..."
        cd /home/matthew/tanks
        tools/grid2pict "$TANK_JSON" "$TANK_PICT"
    fi

    set -- "$TANK_PICT"
    echo "No files specified, using test yellow tank"
fi

echo "Mounting shared disk..."
"$HFSUTILS/hmount" "$SHARED_DISK"

for FILE in "$@"; do
    if [ ! -f "$FILE" ]; then
        echo "Error: file not found: $FILE"
        continue
    fi

    # Get just the filename, change extension to .pict for Mac
    BASENAME=$(basename "$FILE")
    MACNAME="${BASENAME%.*}"

    echo "Copying $BASENAME -> :${MACNAME}"
    "$HFSUTILS/hcopy" -r "$FILE" ":${MACNAME}"
    "$HFSUTILS/hattrib" -t PICT -c ttxt ":${MACNAME}"
    echo "  Type: PICT  Creator: ttxt"
done

echo ""
echo "Shared disk contents:"
"$HFSUTILS/hls" -la :

echo ""
"$HFSUTILS/humount"
echo "Done. Boot a Mac VM and check the Shared disk."
