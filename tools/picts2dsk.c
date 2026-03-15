/*
 * picts2dsk - Create an HFS disk image containing PICT files
 *
 * Usage: picts2dsk <volume_name> <folder_name> <output.dsk> <name1:pict1> [name2:pict2] ...
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libhfs/hfs.h"

#define MIN_DISK_SIZE  (800 * 1024)
#define BLOCK_SIZE     (800 * 1024)
#define HFS_OVERHEAD   (64 * 1024)

static long file_size(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return -1;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fclose(f);
    return sz;
}

static unsigned char *read_file(const char *path, long *out_size) {
    long sz = file_size(path);
    if (sz < 0) return NULL;
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    unsigned char *buf = malloc(sz);
    if (!buf) { fclose(f); return NULL; }
    if ((long)fread(buf, 1, sz, f) != sz) {
        free(buf);
        fclose(f);
        return NULL;
    }
    fclose(f);
    *out_size = sz;
    return buf;
}

int main(int argc, char *argv[]) {
    if (argc < 5) {
        fprintf(stderr, "Usage: %s <volume_name> <folder_name> <output.dsk> <name1:pict1> [name2:pict2] ...\n", argv[0]);
        return 1;
    }

    const char *volume_name = argv[1];
    const char *folder_name = argv[2];
    const char *output_path = argv[3];
    int num_files = argc - 4;

    /* Parse name:path pairs and calculate total size */
    char **names = malloc(num_files * sizeof(char *));
    char **paths = malloc(num_files * sizeof(char *));
    if (!names || !paths) {
        fprintf(stderr, "Error: memory allocation failed\n");
        return 1;
    }

    long total_data = 0;
    for (int i = 0; i < num_files; i++) {
        char *arg = argv[4 + i];
        char *colon = strchr(arg, ':');
        if (!colon) {
            fprintf(stderr, "Error: invalid argument '%s' (expected name:path)\n", arg);
            return 1;
        }
        *colon = '\0';
        names[i] = arg;
        paths[i] = colon + 1;

        long sz = file_size(paths[i]);
        if (sz < 0) {
            fprintf(stderr, "Error: cannot read file '%s'\n", paths[i]);
            return 1;
        }
        total_data += sz;
    }

    /* Calculate disk size: data + overhead, padded to 800KB multiples, minimum 800KB */
    long disk_size = total_data + HFS_OVERHEAD;
    if (disk_size < MIN_DISK_SIZE) {
        disk_size = MIN_DISK_SIZE;
    }
    /* Round up to next 800KB multiple */
    disk_size = ((disk_size + BLOCK_SIZE - 1) / BLOCK_SIZE) * BLOCK_SIZE;

    /* Create zero-filled disk image */
    FILE *img = fopen(output_path, "wb");
    if (!img) {
        fprintf(stderr, "Error: cannot create '%s'\n", output_path);
        return 1;
    }
    unsigned char *zeros = calloc(1, BLOCK_SIZE);
    if (!zeros) {
        fprintf(stderr, "Error: memory allocation failed\n");
        fclose(img);
        return 1;
    }
    long remaining = disk_size;
    while (remaining > 0) {
        long chunk = remaining < BLOCK_SIZE ? remaining : BLOCK_SIZE;
        if ((long)fwrite(zeros, 1, chunk, img) != chunk) {
            fprintf(stderr, "Error: failed to write disk image\n");
            fclose(img);
            free(zeros);
            return 1;
        }
        remaining -= chunk;
    }
    free(zeros);
    fclose(img);

    /* Format as HFS */
    int nparts = disk_size / 512;
    if (hfs_format(output_path, 0, 0, volume_name, 0, 0) == -1) {
        fprintf(stderr, "Error: hfs_format failed: %s\n", hfs_error);
        return 1;
    }
    (void)nparts;

    /* Mount the volume */
    hfsvol *vol = hfs_mount(output_path, 0, HFS_MODE_RDWR);
    if (!vol) {
        fprintf(stderr, "Error: hfs_mount failed: %s\n", hfs_error);
        return 1;
    }

    /* Create the project folder */
    if (hfs_mkdir(vol, folder_name) == -1) {
        fprintf(stderr, "Error: hfs_mkdir failed: %s\n", hfs_error);
        hfs_umount(vol);
        return 1;
    }

    /* Change into the folder (HFS uses : as path separator) */
    char chdir_path[512];
    snprintf(chdir_path, sizeof(chdir_path), ":%s", folder_name);
    if (hfs_chdir(vol, chdir_path) == -1) {
        fprintf(stderr, "Error: hfs_chdir failed: %s\n", hfs_error);
        hfs_umount(vol);
        return 1;
    }

    /* Write each PICT file */
    for (int i = 0; i < num_files; i++) {
        long data_size = 0;
        unsigned char *data = read_file(paths[i], &data_size);
        if (!data) {
            fprintf(stderr, "Error: cannot read '%s'\n", paths[i]);
            hfs_umount(vol);
            return 1;
        }

        /* Build HFS path relative to cwd (already in folder) */
        char hfs_path[512];
        snprintf(hfs_path, sizeof(hfs_path), ":%s", names[i]);

        /* Create the file with type PICT and creator ttxt */
        hfsfile *file = hfs_create(vol, hfs_path, "PICT", "ttxt");
        if (!file) {
            fprintf(stderr, "Error: hfs_create failed for '%s': %s\n", names[i], hfs_error);
            free(data);
            hfs_umount(vol);
            return 1;
        }
        hfs_close(file);

        /* Open the file and write data */
        file = hfs_open(vol, hfs_path);
        if (!file) {
            fprintf(stderr, "Error: hfs_open failed for '%s': %s\n", names[i], hfs_error);
            free(data);
            hfs_umount(vol);
            return 1;
        }

        unsigned long written = hfs_write(file, data, data_size);
        if ((long)written != data_size) {
            fprintf(stderr, "Error: hfs_write failed for '%s': %s\n", names[i], hfs_error);
            hfs_close(file);
            free(data);
            hfs_umount(vol);
            return 1;
        }

        if (hfs_close(file) == -1) {
            fprintf(stderr, "Error: hfs_close failed for '%s': %s\n", names[i], hfs_error);
            free(data);
            hfs_umount(vol);
            return 1;
        }

        free(data);
        fprintf(stderr, "  Added: %s (%ld bytes)\n", names[i], data_size);
    }

    /* Unmount */
    if (hfs_umount(vol) == -1) {
        fprintf(stderr, "Error: hfs_umount failed: %s\n", hfs_error);
        return 1;
    }

    fprintf(stderr, "Created %s (%ld bytes, %d files)\n", output_path, disk_size, num_files);

    free(names);
    free(paths);
    return 0;
}
