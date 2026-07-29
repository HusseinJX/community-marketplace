# Lightweight packaging image for CapRover.
# The heavy Next.js compile (`npm run build`) runs LOCALLY on the dev machine;
# this Dockerfile only copies the prebuilt standalone output, so CapRover's
# on-server build does no compilation (safe on a small/1GB droplet).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Swap the macOS/arm64 sharp binary (bundled by the local build) for the
# Linux/amd64 one. Install in an ISOLATED dir so npm never reconciles/prunes
# the standalone's traced node_modules, then copy only the native pieces in.
RUN mkdir -p /tmp/sharpbuild \
    && cd /tmp/sharpbuild \
    && npm init -y >/dev/null 2>&1 \
    && npm install sharp@0.34.5 >/dev/null 2>&1

# Prebuilt Next standalone server + assets (produced by local `npm run build`).
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
# NOTE: Apple root CAs for StoreKit IAP are EMBEDDED in lib/apple-root-cas.ts
# (compiled into the bundle), so no cert files are copied here — the gitignored
# certs/apple/ dir is only a source-of-truth reference for regenerating that module.

# Replace bundled sharp with the isolated Linux build.
RUN rm -rf ./node_modules/sharp ./node_modules/@img \
    && cp -R /tmp/sharpbuild/node_modules/sharp ./node_modules/sharp \
    && cp -R /tmp/sharpbuild/node_modules/@img ./node_modules/@img \
    && rm -rf /tmp/sharpbuild

EXPOSE 3000
CMD ["node", "server.js"]
