FROM oven/bun:1.0

WORKDIR /app

COPY . .

WORKDIR /app/packages/api

RUN bun install

CMD ["bun", "run", "index.ts"]