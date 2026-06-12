FROM node:20-alpine AS backend-builder
WORKDIR /app

COPY src/backend/package*.json ./
RUN npm ci

COPY src/backend ./
RUN npm run build

FROM node:20-alpine AS backend-runtime
WORKDIR /app
ENV NODE_ENV=production

COPY src/backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/prisma ./prisma

EXPOSE 3101
CMD ["node", "dist/main.js"]
