# ── Stage 1: builder ─────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy all codebase (termasuk node_modules jika ada di host)
COPY . .

# Matikan Next.js telemetry saat build
ENV NEXT_TELEMETRY_DISABLED=1

# Cek apakah node_modules sudah ada (copy dari host), jika belum lakukan install
RUN if [ ! -d node_modules ]; then \
      npm install --legacy-peer-deps; \
    fi

# Build args yang diinjek saat docker build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_AUTH_DEBUG=false

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_AUTH_DEBUG=$NEXT_PUBLIC_AUTH_DEBUG

RUN npm run build

# ── Stage 2: runner ──────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Buat direktori uploads dengan owner nextjs agar writable saat runtime
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
