/*
 * pict2macbin - Wrap one or more PICT files into a MacBinary resource file
 *
 * Creates a MacBinary (.bin) file containing PICT resources in the
 * resource fork. The resulting file can be opened on classic Mac OS
 * with GetPicture() or viewed in any resource editor (ResEdit, Resorcerer).
 *
 * Usage:
 *   pict2macbin output.bin input1.pict[:id[:name]] [input2.pict[:id[:name]] ...]
 *
 * Examples:
 *   pict2macbin YellowTank.bin tank.pict
 *   pict2macbin Sprites.bin tank.pict:128:YellowTank tile.pict:200:Ground
 *
 * Resource IDs default to 128, incrementing for each file.
 * Resource names default to the input filename (without extension).
 *
 * Output: MacBinary II format with resource fork containing PICT resources.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>

/* --- Big-endian write helpers --- */

static void put_u8(uint8_t *buf, int offset, uint8_t v)
{
    buf[offset] = v;
}

static void put_u16(uint8_t *buf, int offset, uint16_t v)
{
    buf[offset]     = (v >> 8) & 0xFF;
    buf[offset + 1] = v & 0xFF;
}

static void put_u32(uint8_t *buf, int offset, uint32_t v)
{
    buf[offset]     = (v >> 24) & 0xFF;
    buf[offset + 1] = (v >> 16) & 0xFF;
    buf[offset + 2] = (v >> 8) & 0xFF;
    buf[offset + 3] = v & 0xFF;
}

/* --- CRC-16 for MacBinary header --- */

static uint16_t macbin_crc(const uint8_t *buf, int len)
{
    uint16_t crc = 0;
    for (int i = 0; i < len; i++) {
        uint8_t data = buf[i];
        for (int j = 0; j < 8; j++) {
            if ((crc ^ (data << 8)) & 0x8000)
                crc = (crc << 1) ^ 0x1021;
            else
                crc = crc << 1;
            data <<= 1;
        }
    }
    return crc;
}

/* --- Resource types --- */

typedef struct {
    uint8_t *data;
    uint32_t size;
    int16_t id;
    char name[256];
    char type[5]; /* 4-char type + null */
} ResEntry;

/* --- Build resource fork in memory --- */

/*
 * Resource fork layout:
 *   Header (256 bytes):
 *     0-3:   offset to resource data
 *     4-7:   offset to resource map
 *     8-11:  length of resource data
 *     12-15: length of resource map
 *     16-255: reserved (zeros)
 *
 *   Resource data section:
 *     For each resource: 4-byte length + raw data
 *
 *   Resource map:
 *     0-15:  copy of header (16 bytes)
 *     16-19: next resource map handle (0)
 *     20-21: file reference (0)
 *     22-23: resource file attributes (0)
 *     24-25: offset from map start to type list
 *     26-27: offset from map start to name list
 *     Type list:
 *       0-1: number of types - 1
 *       For each type:
 *         0-3: type code
 *         4-5: count - 1
 *         6-7: offset from type list start to reference list
 *     Reference list (for each resource of a type):
 *       0-1:  resource ID
 *       2-3:  offset to name in name list (-1 if no name)
 *       4:    attributes
 *       5-7:  offset to data in data section (3 bytes)
 *     Name list:
 *       Pascal strings (length byte + chars)
 */

static uint8_t *build_resource_fork(ResEntry *entries, int count, uint32_t *fork_size)
{
    /* Calculate sizes */
    uint32_t data_section_size = 0;
    uint32_t data_offsets[256];

    for (int i = 0; i < count; i++) {
        data_offsets[i] = data_section_size;
        data_section_size += 4 + entries[i].size; /* 4-byte length prefix + data */
    }

    /* We only have one type: PICT */
    /* Type list: 2 (count-1) + 1 type entry (8 bytes) = 10 bytes */
    /* Ref list: count * 12 bytes */
    /* Name list: sum of (1 + strlen(name)) for each entry with a name */
    int type_list_size = 2 + 8; /* one type */
    int ref_list_size = count * 12;
    int name_list_size = 0;
    for (int i = 0; i < count; i++) {
        if (entries[i].name[0])
            name_list_size += 1 + (int)strlen(entries[i].name);
    }
    if (name_list_size == 0)
        name_list_size = 0; /* no names */

    int map_fixed = 28; /* header copy + handle + fileref + attrs + type/name offsets */
    int map_size = map_fixed + type_list_size + ref_list_size + name_list_size;

    uint32_t header_size = 256;
    uint32_t total = header_size + data_section_size + map_size;

    uint8_t *fork = calloc(total, 1);
    if (!fork) return NULL;

    /* Header */
    put_u32(fork, 0, header_size);                        /* offset to data */
    put_u32(fork, 4, header_size + data_section_size);    /* offset to map */
    put_u32(fork, 8, data_section_size);                  /* data length */
    put_u32(fork, 12, map_size);                          /* map length */

    /* Data section */
    uint32_t dpos = header_size;
    for (int i = 0; i < count; i++) {
        put_u32(fork, dpos, entries[i].size);
        memcpy(fork + dpos + 4, entries[i].data, entries[i].size);
        dpos += 4 + entries[i].size;
    }

    /* Resource map */
    uint32_t map_start = header_size + data_section_size;

    /* Copy of header (first 16 bytes) */
    memcpy(fork + map_start, fork, 16);

    /* next map handle, file ref, attrs */
    put_u32(fork + map_start, 16, 0);
    put_u16(fork + map_start, 20, 0);
    put_u16(fork + map_start, 22, 0);

    /* offset to type list (from map start) */
    uint16_t type_list_offset = 28;
    put_u16(fork + map_start, 24, type_list_offset);

    /* offset to name list (from map start) */
    uint16_t name_list_offset = (uint16_t)(type_list_offset + type_list_size + ref_list_size);
    put_u16(fork + map_start, 26, name_list_offset);

    /* Type list */
    uint32_t tpos = map_start + type_list_offset;
    put_u16(fork, tpos, 0); /* number of types - 1 = 0 (one type) */
    tpos += 2;

    /* Type entry: PICT */
    fork[tpos] = 'P'; fork[tpos+1] = 'I'; fork[tpos+2] = 'C'; fork[tpos+3] = 'T';
    put_u16(fork, tpos + 4, (uint16_t)(count - 1)); /* count - 1 */
    put_u16(fork, tpos + 6, type_list_size); /* offset from type list to ref list */
    tpos += 8;

    /* Reference list */
    uint32_t rpos = tpos;
    int name_offset_cur = 0;

    for (int i = 0; i < count; i++) {
        put_u16(fork, rpos, (uint16_t)entries[i].id);

        if (entries[i].name[0]) {
            put_u16(fork, rpos + 2, (uint16_t)name_offset_cur);
            name_offset_cur += 1 + (int)strlen(entries[i].name);
        } else {
            put_u16(fork, rpos + 2, 0xFFFF); /* no name */
        }

        put_u8(fork, rpos + 4, 0); /* attributes */

        /* 3-byte offset into data section */
        uint32_t doff = data_offsets[i];
        fork[rpos + 5] = (doff >> 16) & 0xFF;
        fork[rpos + 6] = (doff >> 8) & 0xFF;
        fork[rpos + 7] = doff & 0xFF;

        put_u32(fork, rpos + 8, 0); /* reserved */
        rpos += 12;
    }

    /* Name list */
    uint32_t npos = map_start + name_list_offset;
    for (int i = 0; i < count; i++) {
        if (entries[i].name[0]) {
            int len = (int)strlen(entries[i].name);
            if (len > 255) len = 255;
            fork[npos] = (uint8_t)len;
            memcpy(fork + npos + 1, entries[i].name, len);
            npos += 1 + len;
        }
    }

    *fork_size = total;
    return fork;
}

/* --- MacBinary II header --- */

static void build_macbinary_header(uint8_t *hdr, const char *filename,
                                   uint32_t data_fork_len,
                                   uint32_t rsrc_fork_len)
{
    memset(hdr, 0, 128);

    /* Byte 0: old version (0) */
    hdr[0] = 0;

    /* Byte 1: filename length */
    int namelen = (int)strlen(filename);
    if (namelen > 63) namelen = 63;
    hdr[1] = (uint8_t)namelen;

    /* Bytes 2-64: filename */
    memcpy(hdr + 2, filename, namelen);

    /* Bytes 65-68: file type = 'rsrc' */
    hdr[65] = 'r'; hdr[66] = 's'; hdr[67] = 'r'; hdr[68] = 'c';

    /* Bytes 69-72: creator = 'RSED' */
    hdr[69] = 'R'; hdr[70] = 'S'; hdr[71] = 'E'; hdr[72] = 'D';

    /* Byte 73: Finder flags (high byte) */
    hdr[73] = 0;

    /* Bytes 83-86: data fork length */
    put_u32(hdr, 83, data_fork_len);

    /* Bytes 87-90: resource fork length */
    put_u32(hdr, 87, rsrc_fork_len);

    /* Bytes 91-94: creation date (seconds since 1904-01-01) */
    /* Use a fixed date for reproducibility: 2026-03-14 */
    uint32_t mac_epoch = 3850214400U; /* approximate */
    put_u32(hdr, 91, mac_epoch);
    put_u32(hdr, 95, mac_epoch); /* modification date */

    /* Byte 122: MacBinary II version (129) */
    hdr[122] = 129;

    /* Byte 123: MacBinary II minimum version (129) */
    hdr[123] = 129;

    /* Bytes 124-125: CRC-16 of bytes 0-123 */
    uint16_t crc = macbin_crc(hdr, 124);
    put_u16(hdr, 124, crc);
}

/* --- Pad to 128-byte boundary --- */

static void write_padding(FILE *f, uint32_t size)
{
    int pad = (128 - (size % 128)) % 128;
    uint8_t zeros[128];
    memset(zeros, 0, sizeof(zeros));
    if (pad > 0)
        fwrite(zeros, 1, pad, f);
}

/* --- Main --- */

static void usage(const char *prog)
{
    fprintf(stderr, "Usage: %s output.bin input.pict[:id[:name]] [...]\n", prog);
    fprintf(stderr, "\n");
    fprintf(stderr, "  Wraps PICT files into a MacBinary resource file.\n");
    fprintf(stderr, "  IDs default to 128+. Names default to filename stem.\n");
}

int main(int argc, char **argv)
{
    if (argc < 3) {
        usage(argv[0]);
        return 1;
    }

    const char *output_path = argv[1];
    int num_inputs = argc - 2;

    if (num_inputs > 256) {
        fprintf(stderr, "error: too many inputs (max 256)\n");
        return 1;
    }

    ResEntry entries[256];
    memset(entries, 0, sizeof(entries));

    int next_id = 128;

    for (int i = 0; i < num_inputs; i++) {
        char arg[1024];
        strncpy(arg, argv[i + 2], sizeof(arg) - 1);
        arg[sizeof(arg) - 1] = '\0';

        /* Parse path[:id[:name]] */
        char *path = arg;
        char *id_str = NULL;
        char *name_str = NULL;

        char *colon1 = strchr(arg, ':');
        if (colon1) {
            *colon1 = '\0';
            id_str = colon1 + 1;
            char *colon2 = strchr(id_str, ':');
            if (colon2) {
                *colon2 = '\0';
                name_str = colon2 + 1;
            }
        }

        /* Read PICT file */
        FILE *f = fopen(path, "rb");
        if (!f) {
            fprintf(stderr, "error: cannot open '%s'\n", path);
            return 1;
        }
        fseek(f, 0, SEEK_END);
        long fsize = ftell(f);
        fseek(f, 0, SEEK_SET);

        entries[i].data = malloc(fsize);
        if (!entries[i].data) {
            fprintf(stderr, "error: out of memory\n");
            fclose(f);
            return 1;
        }
        entries[i].size = (uint32_t)fsize;
        fread(entries[i].data, 1, fsize, f);
        fclose(f);

        /* Set ID */
        if (id_str && id_str[0])
            entries[i].id = (int16_t)atoi(id_str);
        else
            entries[i].id = (int16_t)next_id++;

        /* Set name */
        if (name_str && name_str[0]) {
            strncpy(entries[i].name, name_str, 255);
        } else {
            /* Default: filename without extension */
            const char *base = strrchr(path, '/');
            base = base ? base + 1 : path;
            strncpy(entries[i].name, base, 255);
            char *dot = strrchr(entries[i].name, '.');
            if (dot) *dot = '\0';
        }

        strcpy(entries[i].type, "PICT");

        fprintf(stderr, "  PICT %d '%s' (%u bytes from %s)\n",
                entries[i].id, entries[i].name, entries[i].size, path);
    }

    /* Build resource fork */
    uint32_t fork_size;
    uint8_t *fork = build_resource_fork(entries, num_inputs, &fork_size);
    if (!fork) {
        fprintf(stderr, "error: failed to build resource fork\n");
        return 1;
    }

    /* Build MacBinary header */
    /* Extract output filename for the Mac */
    const char *mac_name = strrchr(output_path, '/');
    mac_name = mac_name ? mac_name + 1 : output_path;
    char mac_filename[64];
    strncpy(mac_filename, mac_name, 63);
    mac_filename[63] = '\0';
    /* Remove .bin extension for Mac name */
    char *ext = strrchr(mac_filename, '.');
    if (ext && strcmp(ext, ".bin") == 0) *ext = '\0';

    uint8_t header[128];
    build_macbinary_header(header, mac_filename, 0, fork_size);

    /* Write output */
    FILE *out = fopen(output_path, "wb");
    if (!out) {
        fprintf(stderr, "error: cannot create '%s'\n", output_path);
        free(fork);
        return 1;
    }

    /* MacBinary header (128 bytes) */
    fwrite(header, 1, 128, out);

    /* No data fork, but still pad if needed */
    /* Data fork length is 0, no padding needed */

    /* Resource fork */
    fwrite(fork, 1, fork_size, out);
    write_padding(out, fork_size);

    long total = ftell(out);
    fclose(out);
    free(fork);

    fprintf(stderr, "pict2macbin: wrote %s (%ld bytes, %d PICT resources)\n",
            output_path, total, num_inputs);

    /* Clean up */
    for (int i = 0; i < num_inputs; i++)
        free(entries[i].data);

    return 0;
}
