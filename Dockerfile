FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    BUS_RUNTIME_DIR=/data

# No npm dependencies: copy the app as-is.
COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

# Runtime data (saved buses, OSRM road cache) lives on a volume.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/sim >/dev/null || exit 1
CMD ["node", "backend/server.js"]
