FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts/build-web.mjs ./scripts/build-web.mjs
COPY web ./web
RUN node scripts/build-web.mjs --shell-only

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node public ./dist
COPY --chown=node:node server.mjs ./
COPY --chown=node:node scripts/validate-web-assets.mjs ./scripts/validate-web-assets.mjs
USER node
RUN node scripts/validate-web-assets.mjs ./dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
