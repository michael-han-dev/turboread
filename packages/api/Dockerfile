FROM oven/bun:1.0

WORKDIR /app
COPY packages/api/ ./

RUN ls -R .

CMD ["bun", "run", "index.ts"]