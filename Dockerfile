FROM oven/bun:1.0

WORKDIR /app

COPY packages/api/ ./

RUN bun install

CMD ["bun", "run", "./index.ts"]