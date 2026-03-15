FROM node:20-slim

WORKDIR /app

# Install build tools for compiling C utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libc6-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy and compile C tools
COPY tools/ tools/

# Compile grid2pict and pict2macbin (unconditional — sources exist)
RUN gcc -o /usr/local/bin/grid2pict tools/grid2pict.c && \
    gcc -o /usr/local/bin/pict2macbin tools/pict2macbin.c

# Compile picts2dsk only if source exists (depends on libhfs)
RUN if [ -f tools/picts2dsk.c ]; then \
      gcc -DHAVE_CONFIG_H -o /usr/local/bin/picts2dsk tools/picts2dsk.c tools/libhfs/*.c -Itools; \
    fi

# Install server dependencies
COPY server/ server/
RUN cd server && npm install

# Copy eval harness (judge.js needed by /api/rubrics endpoint)
COPY eval/ eval/

# Copy static frontend
COPY public/ public/

# Create runtime data directory
RUN mkdir -p /app/data

EXPOSE 3777

CMD ["node", "server/index.js"]
