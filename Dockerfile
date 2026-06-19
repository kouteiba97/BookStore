# ─── Build stage ──────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# Prisma's query engine needs OpenSSL at generate time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Generate the Prisma client (needs the schema) before compiling.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Drop dev dependencies so only the runtime tree is copied forward.
RUN npm prune --omit=dev

# ─── Production stage ─────────────────────────────────────────────────────
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Pruned node_modules carries the generated Prisma client + the prisma CLI
# (a runtime dependency) so `migrate deploy` works on boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# ServeStatic roots at ./public; covers live on R2 in prod, so it can be empty.
RUN mkdir -p public

EXPOSE 3000

# Apply any pending migrations, then start. Requires DATABASE_URL (and
# DIRECT_URL if the schema declares one) to be reachable at startup.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
