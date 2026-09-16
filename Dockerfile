FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY backend ./backend
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=esm --packages=external --outfile=prisma/seed.mjs

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 TEMP_DIR=/tmp/velyxora/uploads STORAGE_DIR=/tmp/velyxora/results \
    FFMPEG_PATH=ffmpeg FFPROBE_PATH=ffprobe LIBREOFFICE_PATH=soffice YT_DLP_PATH=yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress yt-dlp fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
COPY --from=build /app/prisma/seed.mjs ./prisma/seed.mjs
RUN mkdir -p /tmp/velyxora/uploads /tmp/velyxora/results && chown -R node:node /tmp/velyxora
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/server.mjs"]
