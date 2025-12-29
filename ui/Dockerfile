# UI Dockerfile (Next.js + Prisma)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install OS dependencies required for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Copy prisma schema BEFORE running npm ci (needed for postinstall hook)
COPY prisma ./prisma

# Set dummy DATABASE_URL for prisma generate during build
ARG DATABASE_URL="postgresql://postgres:zoSsGafGpNWpctpinOauKWPcbndhXVLN@postgres.railway.internal:5432/railway"
ENV DATABASE_URL=${DATABASE_URL}

# Install dependencies (this will run prisma generate via postinstall)
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

# Set dummy DATABASE_URL for build stage
ARG DATABASE_URL="postgresql://postgres:zoSsGafGpNWpctpinOauKWPcbndhXVLN@postgres.railway.internal:5432/railway"
ENV DATABASE_URL=${DATABASE_URL}

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy prisma schema
COPY prisma ./prisma

# Copy all source files
COPY . .

# Generate Prisma Client in builder stage
RUN npx prisma generate

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

# Run migrations and start server
# Real DATABASE_URL will be injected at runtime from Railway environment variables
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
