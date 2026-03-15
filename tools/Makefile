CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c99

LIBHFS_SRC = $(wildcard libhfs/*.c)

all: grid2pict pict2macbin picts2dsk

grid2pict: grid2pict.c
	$(CC) $(CFLAGS) -o $@ $<

pict2macbin: pict2macbin.c
	$(CC) $(CFLAGS) -o $@ $<

picts2dsk: picts2dsk.c $(LIBHFS_SRC)
	$(CC) $(CFLAGS) -I. -DHAVE_CONFIG_H -o $@ picts2dsk.c $(LIBHFS_SRC)

clean:
	rm -f grid2pict pict2macbin picts2dsk

.PHONY: all clean
