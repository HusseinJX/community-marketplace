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
#
# The whole isolated tree comes across, not just sharp/ and @img/. Copying only
# those two shipped a sharp that could not LOAD: it requires `semver` at
# require-time (lib/libvips.js), and semver is not in the standalone's traced
# node_modules because nothing else in the app imports it. Next's optimizer
# catches that failure and quietly serves the ORIGINAL image instead — so
# every poster on the site was going out unresized and unconverted (a 1.4MB
# PNG where the AVIF is 21KB) with no error anywhere. Nothing looked broken;
# it was just slow.
#
# -n so the traced modules win every name they already own: this only fills in
# what sharp needs and the trace didn't include. sharp/ and @img/ are removed
# first, so those two are replaced outright rather than merged.
RUN rm -rf ./node_modules/sharp ./node_modules/@img \
    && cp -Rn /tmp/sharpbuild/node_modules/. ./node_modules/ \
    && rm -rf /tmp/sharpbuild

# Fail the BUILD, not a page view. This broke silently once already — the site
# stayed up, served originals, and looked merely sluggish. An image that cannot
# optimize should never reach the registry.
RUN node -e "const s=require('sharp'); if(!s.versions.vips) process.exit(1); console.log('sharp ok, libvips '+s.versions.vips)"

EXPOSE 3000
CMD ["node", "server.js"]
