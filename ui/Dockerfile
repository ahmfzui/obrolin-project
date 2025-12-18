# UI Dockerfile (Next.js + Prisma)
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install OS deps required for prisma and node-gyp
RUN apk add --no-cache python3 make g++ openssl

# Copy manifests
COPY package.json package-lock.json* .npmrc* ./

# Install deps
RUN npm ci --include=dev

# Copy source
COPY . .

# Generate Prisma client and build Next app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Copy only what we need for runtime
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

EXPOSE 3000

# Start: run migrations then start the server
CMD ["sh", "-lc", "npx prisma migrate deploy && npm run start"]
