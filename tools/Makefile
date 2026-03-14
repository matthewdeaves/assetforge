CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c99

all: grid2pict pict2macbin

grid2pict: grid2pict.c
	$(CC) $(CFLAGS) -o $@ $<

pict2macbin: pict2macbin.c
	$(CC) $(CFLAGS) -o $@ $<

clean:
	rm -f grid2pict pict2macbin

.PHONY: all clean
