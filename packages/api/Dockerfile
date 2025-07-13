# Use official Bun image
FROM oven/bun:1.0

WORKDIR /app

COPY . .

RUN bun install

CMD ["bun", "run", "index.ts"]