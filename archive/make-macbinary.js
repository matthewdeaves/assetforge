#!/usr/bin/env node
/*
 * make-macbinary.js - Create MacBinary II file from AppleDouble format
 *
 * Usage: node make-macbinary.js <filename> [output.bin]
 *
 * Reads AppleDouble format:
 *   filename        - data fork (can be empty)
 *   .rsrc/filename  - resource fork
 *   .finf/filename  - Finder info (optional)
 *
 * Creates MacBinary II format output.
 */

const fs = require('fs');
const path = require('path');

// MacBinary II header structure (128 bytes)
function createMacBinaryHeader(options) {
    const header = Buffer.alloc(128, 0);

    // Byte 0: Old version number (must be 0 for MacBinary II)
    header[0] = 0;

    // Byte 1: Length of filename (1-63)
    const filename = options.filename || 'Untitled';
    const fnameLen = Math.min(filename.length, 63);
    header[1] = fnameLen;

    // Bytes 2-64: Filename (Pascal string, no length byte here)
    header.write(filename.substring(0, fnameLen), 2, fnameLen, 'ascii');

    // Bytes 65-68: File type (4 chars)
    const fileType = options.type || '????';
    header.write(fileType.substring(0, 4).padEnd(4, ' '), 65, 4, 'ascii');

    // Bytes 69-72: File creator (4 chars)
    const creator = options.creator || '????';
    header.write(creator.substring(0, 4).padEnd(4, ' '), 69, 4, 'ascii');

    // Byte 73: Finder flags (high byte)
    header[73] = (options.finderFlags >> 8) & 0xFF || 0;

    // Byte 74: Zero
    header[74] = 0;

    // Bytes 75-76: Vertical position in window
    header.writeUInt16BE(0, 75);

    // Bytes 77-78: Horizontal position in window
    header.writeUInt16BE(0, 77);

    // Bytes 79-80: Window or folder ID
    header.writeUInt16BE(0, 79);

    // Byte 81: Protected flag
    header[81] = 0;

    // Byte 82: Zero
    header[82] = 0;

    // Bytes 83-86: Data fork length (big-endian)
    header.writeUInt32BE(options.dataForkLength || 0, 83);

    // Bytes 87-90: Resource fork length (big-endian)
    header.writeUInt32BE(options.resourceForkLength || 0, 87);

    // Bytes 91-94: Creation date (seconds since Jan 1, 1904)
    const macEpoch = Date.UTC(1904, 0, 1);
    const now = Date.now();
    const macTime = Math.floor((now - macEpoch) / 1000);
    header.writeUInt32BE(macTime, 91);

    // Bytes 95-98: Modification date
    header.writeUInt32BE(macTime, 95);

    // Bytes 99-100: GetInfo comment length
    header.writeUInt16BE(0, 99);

    // Byte 101: Finder flags (low byte)
    header[101] = (options.finderFlags || 0) & 0xFF;

    // Bytes 102-105: MacBinary II signature 'mBIN'
    header.write('mBIN', 102, 4, 'ascii');

    // Byte 106: Script of filename
    header[106] = 0;

    // Byte 107: Extended Finder flags
    header[107] = 0;

    // Bytes 108-115: Unused (zero)

    // Bytes 116-119: Unpacked total length
    const totalLen = (options.dataForkLength || 0) + (options.resourceForkLength || 0);
    header.writeUInt32BE(totalLen, 116);

    // Bytes 120-121: Length of secondary header (0 for MacBinary II)
    header.writeUInt16BE(0, 120);

    // Byte 122: MacBinary II version (129 = version 2)
    header[122] = 129;

    // Byte 123: Minimum MacBinary II version to read (129)
    header[123] = 129;

    // Bytes 124-125: CRC of header bytes 0-123
    const crc = calculateCRC(header.slice(0, 124));
    header.writeUInt16BE(crc, 124);

    // Bytes 126-127: Reserved (zero)

    return header;
}

// CRC-16-CCITT calculation for MacBinary
function calculateCRC(data) {
    let crc = 0;

    for (let i = 0; i < data.length; i++) {
        let byte = data[i];
        for (let bit = 0; bit < 8; bit++) {
            const xorFlag = ((crc ^ (byte << 8)) & 0x8000) !== 0;
            crc = (crc << 1) & 0xFFFF;
            if (xorFlag) {
                crc ^= 0x1021;
            }
            byte = (byte << 1) & 0xFF;
        }
    }

    return crc;
}

// Pad buffer to 128-byte boundary
function padTo128(buffer) {
    const remainder = buffer.length % 128;
    if (remainder === 0) return buffer;
    const padding = Buffer.alloc(128 - remainder, 0);
    return Buffer.concat([buffer, padding]);
}

// Parse Finder info from .finf file
function parseFinderInfo(finfoData) {
    if (!finfoData || finfoData.length < 32) {
        return { type: 'rsrc', creator: 'RSED', flags: 0 };
    }

    // Finder info is 32 bytes
    // Bytes 0-3: File type
    // Bytes 4-7: Creator
    // Bytes 8-9: Finder flags
    const type = finfoData.slice(0, 4).toString('ascii').replace(/\x00/g, ' ');
    const creator = finfoData.slice(4, 8).toString('ascii').replace(/\x00/g, ' ');
    const flags = finfoData.readUInt16BE(8);

    return { type, creator, flags };
}

// Main
function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('Usage: node make-macbinary.js <input-file> [output.bin]');
        console.error('');
        console.error('Reads AppleDouble format (file + .rsrc/file + .finf/file)');
        console.error('and creates a MacBinary II output file.');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace(/\.[^.]+$/, '') + '.bin';
    const dir = path.dirname(inputFile);
    const basename = path.basename(inputFile);

    // Read data fork
    let dataFork = Buffer.alloc(0);
    if (fs.existsSync(inputFile)) {
        dataFork = fs.readFileSync(inputFile);
    }

    // Read resource fork from AppleDouble location
    let resourceFork = Buffer.alloc(0);
    const rsrcPath = path.join(dir, '.rsrc', basename);
    if (fs.existsSync(rsrcPath)) {
        resourceFork = fs.readFileSync(rsrcPath);
    }

    // Read Finder info from AppleDouble location
    let finderInfo = { type: 'rsrc', creator: 'RSED', flags: 0 };
    const finfPath = path.join(dir, '.finf', basename);
    if (fs.existsSync(finfPath)) {
        const finfData = fs.readFileSync(finfPath);
        finderInfo = parseFinderInfo(finfData);
    }

    console.log('Creating MacBinary II file:');
    console.log(`  Input: ${inputFile}`);
    console.log(`  Data fork: ${dataFork.length} bytes`);
    console.log(`  Resource fork: ${resourceFork.length} bytes`);
    console.log(`  Type: '${finderInfo.type}' Creator: '${finderInfo.creator}'`);
    console.log(`  Output: ${outputFile}`);

    // Create header
    const header = createMacBinaryHeader({
        filename: basename.replace(/\.rsrc$/i, ''),
        type: finderInfo.type,
        creator: finderInfo.creator,
        finderFlags: finderInfo.flags,
        dataForkLength: dataFork.length,
        resourceForkLength: resourceFork.length
    });

    // Assemble MacBinary file
    // Header (128) + Data fork (padded) + Resource fork (padded)
    const paddedData = padTo128(dataFork);
    const paddedRsrc = padTo128(resourceFork);

    // If data fork is empty, don't pad
    const output = dataFork.length > 0
        ? Buffer.concat([header, paddedData, paddedRsrc])
        : Buffer.concat([header, paddedRsrc]);

    fs.writeFileSync(outputFile, output);
    console.log(`  Written: ${output.length} bytes`);
}

main();
