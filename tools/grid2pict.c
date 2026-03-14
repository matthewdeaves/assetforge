/*
 * grid2pict - Convert palette-indexed pixel grids to PICT 2.0 resources
 *
 * Reads a JSON sprite file (palette + 2D pixel grid) from stdin or file,
 * writes a valid PICT 2.0 file that System 7+ can load with GetPicture().
 *
 * Supports 4-bit (16 color) and 8-bit (256 color) indexed palettes.
 *
 * Usage:
 *   grid2pict input.json output.pict
 *   grid2pict input.json output.pict --no-header   (omit 512-byte file header for resource embedding)
 *   cat input.json | grid2pict - output.pict
 *
 * Input JSON format:
 *   {
 *     "width": 64,
 *     "height": 64,
 *     "palette": [
 *       { "r": 0, "g": 0, "b": 0 },
 *       { "r": 255, "g": 68, "b": 68 },
 *       ...
 *     ],
 *     "pixels": [
 *       [0, 0, 1, 1, ...],
 *       [0, 1, 2, 3, ...],
 *       ...
 *     ]
 *   }
 *
 * Based on the PICT 2.0 specification from Inside Macintosh: Imaging
 * with QuickDraw, and informed by the PictSharp encoder approach.
 *
 * All multi-byte values are big-endian (Motorola 68k convention).
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

/* --- Big-endian write helpers --- */

static void write_u8(FILE *f, uint8_t v)
{
    fputc(v, f);
}

static void write_u16(FILE *f, uint16_t v)
{
    fputc((v >> 8) & 0xFF, f);
    fputc(v & 0xFF, f);
}

static void write_u32(FILE *f, uint32_t v)
{
    fputc((v >> 24) & 0xFF, f);
    fputc((v >> 16) & 0xFF, f);
    fputc((v >> 8) & 0xFF, f);
    fputc(v & 0xFF, f);
}

static void write_rect(FILE *f, int top, int left, int bottom, int right)
{
    write_u16(f, (uint16_t)top);
    write_u16(f, (uint16_t)left);
    write_u16(f, (uint16_t)bottom);
    write_u16(f, (uint16_t)right);
}

/* --- PackBits compression --- */

/*
 * PackBits: byte-level run-length encoding used by PICT.
 * Returns number of bytes written to out.
 * out must be large enough (worst case: input_len + (input_len+127)/128).
 */
static int packbits_encode(const uint8_t *in, int len, uint8_t *out)
{
    int pos = 0, opos = 0;

    while (pos < len) {
        /* look for a run of 3+ identical bytes */
        int run = 1;
        while (pos + run < len && in[pos + run] == in[pos] && run < 128)
            run++;

        if (run >= 3) {
            /* repeat packet: header = 1 - run (signed) */
            out[opos++] = (uint8_t)(1 - run);
            out[opos++] = in[pos];
            pos += run;
        } else {
            /* literal packet: scan for non-repeating bytes */
            int lit_start = pos;
            int lit = 0;
            while (pos < len && lit < 128) {
                if (pos + 2 < len &&
                    in[pos] == in[pos + 1] &&
                    in[pos] == in[pos + 2])
                    break;
                pos++;
                lit++;
            }
            out[opos++] = (uint8_t)(lit - 1);
            memcpy(&out[opos], &in[lit_start], lit);
            opos += lit;
        }
    }
    return opos;
}

/* --- Minimal JSON parser (just enough for our format) --- */

typedef struct {
    uint8_t r, g, b;
} Color;

typedef struct {
    int width;
    int height;
    int num_colors;
    Color palette[256];
    uint8_t *pixels; /* row-major, one byte per pixel (palette index) */
} Sprite;

/* Skip whitespace */
static const char *skip_ws(const char *p)
{
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r')
        p++;
    return p;
}

/* Parse an integer, advance pointer */
static int parse_int(const char **pp)
{
    const char *p = skip_ws(*pp);
    int neg = 0, val = 0;
    if (*p == '-') { neg = 1; p++; }
    while (*p >= '0' && *p <= '9') {
        val = val * 10 + (*p - '0');
        p++;
    }
    *pp = p;
    return neg ? -val : val;
}

/* Find a key in JSON, return pointer after the colon */
static const char *find_key(const char *json, const char *key)
{
    char pattern[256];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *p = strstr(json, pattern);
    if (!p) return NULL;
    p += strlen(pattern);
    p = skip_ws(p);
    if (*p == ':') p++;
    return skip_ws(p);
}

/* Parse the palette array */
static int parse_palette(const char *p, Sprite *s)
{
    p = skip_ws(p);
    if (*p != '[') return -1;
    p++;

    int count = 0;
    while (count < 256) {
        p = skip_ws(p);
        if (*p == ']') break;
        if (*p == ',') { p++; continue; }
        if (*p != '{') return -1;
        p++;

        int r = -1, g = -1, b = -1;
        /* parse fields within this object */
        while (*p && *p != '}') {
            p = skip_ws(p);
            if (*p == '"') {
                p++;
                if (strncmp(p, "r\"", 2) == 0) {
                    p += 2; p = skip_ws(p);
                    if (*p == ':') p++;
                    r = parse_int(&p);
                } else if (strncmp(p, "g\"", 2) == 0) {
                    p += 2; p = skip_ws(p);
                    if (*p == ':') p++;
                    g = parse_int(&p);
                } else if (strncmp(p, "b\"", 2) == 0) {
                    p += 2; p = skip_ws(p);
                    if (*p == ':') p++;
                    b = parse_int(&p);
                } else {
                    /* skip unknown key */
                    while (*p && *p != '"') p++;
                    if (*p == '"') p++;
                    p = skip_ws(p);
                    if (*p == ':') p++;
                    p = skip_ws(p);
                    /* skip value */
                    if (*p == '"') {
                        p++;
                        while (*p && *p != '"') p++;
                        if (*p == '"') p++;
                    } else {
                        while (*p && *p != ',' && *p != '}') p++;
                    }
                }
            }
            if (*p == ',') p++;
        }
        if (*p == '}') p++;

        if (r < 0) r = 0;
        if (g < 0) g = 0;
        if (b < 0) b = 0;
        s->palette[count].r = (uint8_t)r;
        s->palette[count].g = (uint8_t)g;
        s->palette[count].b = (uint8_t)b;
        count++;
    }
    s->num_colors = count;
    return 0;
}

/* Parse the 2D pixels array */
static int parse_pixels(const char *p, Sprite *s)
{
    p = skip_ws(p);
    if (*p != '[') return -1;
    p++;

    s->pixels = calloc(s->width * s->height, 1);
    if (!s->pixels) return -1;

    int row = 0;
    while (row < s->height) {
        p = skip_ws(p);
        if (*p == ']') break;
        if (*p == ',') { p++; continue; }
        if (*p != '[') return -1;
        p++;

        int col = 0;
        while (col < s->width) {
            p = skip_ws(p);
            if (*p == ']') break;
            if (*p == ',') { p++; continue; }
            int val = parse_int(&p);
            if (col < s->width)
                s->pixels[row * s->width + col] = (uint8_t)val;
            col++;
        }
        if (*p == ']') p++;
        row++;
    }
    return 0;
}

static int parse_sprite(const char *json, Sprite *s)
{
    const char *p;

    memset(s, 0, sizeof(*s));

    p = find_key(json, "width");
    if (!p) { fprintf(stderr, "error: missing 'width'\n"); return -1; }
    s->width = parse_int(&p);

    p = find_key(json, "height");
    if (!p) { fprintf(stderr, "error: missing 'height'\n"); return -1; }
    s->height = parse_int(&p);

    if (s->width <= 0 || s->height <= 0 || s->width > 4096 || s->height > 4096) {
        fprintf(stderr, "error: invalid dimensions %dx%d\n", s->width, s->height);
        return -1;
    }

    p = find_key(json, "palette");
    if (!p) { fprintf(stderr, "error: missing 'palette'\n"); return -1; }
    if (parse_palette(p, s) != 0) {
        fprintf(stderr, "error: failed to parse palette\n");
        return -1;
    }

    p = find_key(json, "pixels");
    if (!p) { fprintf(stderr, "error: missing 'pixels'\n"); return -1; }
    if (parse_pixels(p, s) != 0) {
        fprintf(stderr, "error: failed to parse pixels\n");
        return -1;
    }

    return 0;
}

/* --- PICT 2.0 writer --- */

static int write_pict(const Sprite *s, FILE *f, int include_file_header)
{
    int w = s->width;
    int h = s->height;
    int bpp = (s->num_colors <= 16) ? 4 : 8;
    int row_bytes;
    long pic_start;

    if (bpp == 4)
        row_bytes = (w + 1) / 2;
    else
        row_bytes = w;

    /* row_bytes must be even */
    if (row_bytes & 1)
        row_bytes++;

    /* Part A: 512-byte file header (all zeros) */
    if (include_file_header) {
        uint8_t zeros[512];
        memset(zeros, 0, sizeof(zeros));
        fwrite(zeros, 1, 512, f);
    }

    pic_start = ftell(f);

    /* Part B: Picture header */
    write_u16(f, 0x0000);                      /* picSize placeholder */
    write_rect(f, 0, 0, h, w);                 /* picFrame */
    write_u16(f, 0x0011);                      /* version opcode */
    write_u16(f, 0x02FF);                      /* version 2 */
    write_u16(f, 0x0C00);                      /* header opcode */
    write_u32(f, 0xFFFE0000);                  /* extended v2 header */
    write_u32(f, 0x00480000);                  /* hRes = 72.0 dpi */
    write_u32(f, 0x00480000);                  /* vRes = 72.0 dpi */
    write_rect(f, 0, 0, h, w);                 /* source rect */
    write_u32(f, 0x00000000);                  /* reserved */

    /* Part C: Clip region */
    write_u16(f, 0x0001);                      /* OP_CLIP_RGN */
    write_u16(f, 0x000A);                      /* region size = 10 */
    write_rect(f, 0, 0, h, w);                 /* clip rect */

    /* Part D: PackBitsRect opcode */
    write_u16(f, 0x0098);                      /* OP_PACK_BITS_RECT */

    /* D.1: rowBytes with PixMap flag */
    write_u16(f, (uint16_t)(row_bytes | 0x8000));

    /* D.2: PixMap record (minus baseAddr and rowBytes already written) */
    write_rect(f, 0, 0, h, w);                 /* bounds */
    write_u16(f, 0x0000);                      /* pmVersion */
    write_u16(f, 0x0000);                      /* packType = default */
    write_u32(f, 0x00000000);                  /* packSize */
    write_u32(f, 0x00480000);                  /* hRes = 72.0 */
    write_u32(f, 0x00480000);                  /* vRes = 72.0 */
    write_u16(f, 0x0000);                      /* pixelType = indexed */
    write_u16(f, (uint16_t)bpp);               /* pixelSize */
    write_u16(f, 0x0001);                      /* cmpCount = 1 */
    write_u16(f, (uint16_t)bpp);               /* cmpSize */
    write_u32(f, 0x00000000);                  /* planeBytes */
    write_u32(f, 0x00000000);                  /* pmTable */
    write_u32(f, 0x00000000);                  /* pmReserved */

    /* D.3: ColorTable */
    int num_ct_entries = (bpp == 4) ? 16 : s->num_colors;
    write_u32(f, 0x00000000);                  /* ctSeed */
    write_u16(f, 0x0000);                      /* ctFlags */
    write_u16(f, (uint16_t)(num_ct_entries - 1)); /* ctSize */

    for (int i = 0; i < num_ct_entries; i++) {
        uint16_t r16, g16, b16;
        if (i < s->num_colors) {
            r16 = (uint16_t)(s->palette[i].r * 257);
            g16 = (uint16_t)(s->palette[i].g * 257);
            b16 = (uint16_t)(s->palette[i].b * 257);
        } else {
            r16 = g16 = b16 = 0;
        }
        write_u16(f, (uint16_t)i);             /* index value */
        write_u16(f, r16);
        write_u16(f, g16);
        write_u16(f, b16);
    }

    /* D.4: srcRect, dstRect, transfer mode */
    write_rect(f, 0, 0, h, w);                 /* srcRect */
    write_rect(f, 0, 0, h, w);                 /* dstRect */
    write_u16(f, 0x0000);                      /* mode = srcCopy */

    /* D.5: Pixel data — scanlines */
    uint8_t *scanline_buf = malloc(row_bytes);
    /* worst case PackBits output */
    uint8_t *pack_buf = malloc(row_bytes + (row_bytes + 127) / 128 + 2);
    if (!scanline_buf || !pack_buf) {
        fprintf(stderr, "error: out of memory\n");
        free(scanline_buf);
        free(pack_buf);
        return -1;
    }

    long pixel_data_start = ftell(f);

    for (int y = 0; y < h; y++) {
        /* build scanline from pixel grid */
        memset(scanline_buf, 0, row_bytes);

        if (bpp == 4) {
            for (int x = 0; x < w; x++) {
                uint8_t idx = s->pixels[y * w + x];
                if (x & 1)
                    scanline_buf[x / 2] |= (idx & 0x0F);
                else
                    scanline_buf[x / 2] |= ((idx & 0x0F) << 4);
            }
        } else {
            for (int x = 0; x < w; x++) {
                scanline_buf[x] = s->pixels[y * w + x];
            }
        }

        if (row_bytes < 8) {
            /* no compression, no byte count prefix */
            fwrite(scanline_buf, 1, row_bytes, f);
        } else {
            /* PackBits compress */
            int packed_len = packbits_encode(scanline_buf, row_bytes, pack_buf);

            if (row_bytes > 250) {
                write_u16(f, (uint16_t)packed_len);
            } else {
                write_u8(f, (uint8_t)packed_len);
            }
            fwrite(pack_buf, 1, packed_len, f);
        }
    }

    free(scanline_buf);
    free(pack_buf);

    /* Pad to even byte boundary */
    long pixel_data_end = ftell(f);
    long total_pixel_bytes = pixel_data_end - pixel_data_start;
    if (total_pixel_bytes & 1)
        write_u8(f, 0x00);

    /* Part E: End of picture */
    write_u16(f, 0x00FF);

    /* Backpatch picSize */
    long pic_end = ftell(f);
    long pic_size = pic_end - pic_start;
    fseek(f, pic_start, SEEK_SET);
    write_u16(f, (uint16_t)(pic_size & 0xFFFF));
    fseek(f, pic_end, SEEK_SET);

    return 0;
}

/* --- Main --- */

static char *read_file(const char *path)
{
    FILE *f;
    char *buf;

    if (strcmp(path, "-") == 0) {
        f = stdin;
    } else {
        f = fopen(path, "r");
        if (!f) {
            fprintf(stderr, "error: cannot open '%s'\n", path);
            return NULL;
        }
    }

    /* read entire file into memory */
    size_t capacity = 64 * 1024;
    size_t used = 0;
    buf = malloc(capacity);
    if (!buf) {
        if (f != stdin) fclose(f);
        return NULL;
    }

    while (!feof(f)) {
        if (used + 4096 > capacity) {
            capacity *= 2;
            buf = realloc(buf, capacity);
            if (!buf) {
                if (f != stdin) fclose(f);
                return NULL;
            }
        }
        size_t n = fread(buf + used, 1, 4096, f);
        used += n;
        if (n == 0) break;
    }
    buf[used] = '\0';

    if (f != stdin) fclose(f);
    return buf;
}

static void usage(const char *prog)
{
    fprintf(stderr, "Usage: %s input.json output.pict [--no-header]\n", prog);
    fprintf(stderr, "\n");
    fprintf(stderr, "  Converts a palette-indexed pixel grid (JSON) to PICT 2.0.\n");
    fprintf(stderr, "\n");
    fprintf(stderr, "  --no-header   Omit 512-byte file header (for resource embedding)\n");
    fprintf(stderr, "  Use '-' as input to read from stdin.\n");
}

int main(int argc, char **argv)
{
    if (argc < 3) {
        usage(argv[0]);
        return 1;
    }

    const char *input_path = argv[1];
    const char *output_path = argv[2];
    int include_header = 1;

    for (int i = 3; i < argc; i++) {
        if (strcmp(argv[i], "--no-header") == 0)
            include_header = 0;
    }

    /* read input */
    char *json = read_file(input_path);
    if (!json) return 1;

    /* parse sprite */
    Sprite sprite;
    if (parse_sprite(json, &sprite) != 0) {
        free(json);
        return 1;
    }
    free(json);

    fprintf(stderr, "grid2pict: %dx%d, %d colors (%d-bit), ",
            sprite.width, sprite.height, sprite.num_colors,
            sprite.num_colors <= 16 ? 4 : 8);

    /* write PICT */
    FILE *out = fopen(output_path, "wb");
    if (!out) {
        fprintf(stderr, "error: cannot create '%s'\n", output_path);
        free(sprite.pixels);
        return 1;
    }

    int ret = write_pict(&sprite, out, include_header);
    long file_size = ftell(out);
    fclose(out);

    if (ret == 0) {
        fprintf(stderr, "%ld bytes written to %s\n", file_size, output_path);
    }

    free(sprite.pixels);
    return ret;
}
