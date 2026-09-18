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

# Compilar backend de producción
RUN npx esbuild backend/src/server.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --packages=external \
    --sourcemap \
    --outfile=backend/dist/server.mjs

# Compilar seed de producción para no depender de tsx en runtime
RUN npx esbuild prisma/seed.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --packages=external \
    --outfile=prisma/seed.mjs


FROM node:22-bookworm-slim AS runtime

ARG YT_DLP_VERSION=2026.08.19
ARG YT_DLP_SHA256=1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6

ENV NODE_ENV=production \
    PORT=3000 \
    TEMP_DIR=/tmp/velyxora/uploads \
    STORAGE_DIR=/tmp/velyxora/results \
    FFMPEG_PATH=ffmpeg \
    FFPROBE_PATH=ffprobe \
    LIBREOFFICE_PATH=soffice \
    YT_DLP_PATH=yt-dlp \
    PATH="/opt/velyxora-ytdlp/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libreoffice-core \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        ca-certificates \
        curl \
        python3 \
        python3-venv \
        fonts-dejavu-core \
    && curl --fail --show-error --silent --location \
        "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
        --output /usr/local/bin/yt-dlp \
    && echo "${YT_DLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum --check --strict \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && test "$(/usr/local/bin/yt-dlp --version)" = "${YT_DLP_VERSION}" \
    && python3 -m venv /opt/velyxora-ytdlp \
    && /opt/velyxora-ytdlp/bin/python -m pip install \
        --disable-pip-version-check \
        --no-cache-dir \
        certifi==2026.7.22 \
        cffi==2.1.1 \
        curl-cffi==0.16.0 \
        pycparser==3.0 \
    && test "$(/opt/velyxora-ytdlp/bin/python -c 'import curl_cffi; print(curl_cffi.__version__)')" = "0.16.0" \
    && yt-dlp --list-impersonate-targets | grep -Eq 'curl_cffi$' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev \
    && npx prisma generate \
    && npm cache clean --force

# Backend compilado
COPY --from=build /app/backend/dist ./backend/dist

# Seed compilado
COPY --from=build /app/prisma/seed.mjs ./prisma/seed.mjs

RUN mkdir -p /tmp/velyxora/uploads /tmp/velyxora/results \
    && chown -R node:node /tmp/velyxora

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/server.mjs"]
