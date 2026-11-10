FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

FROM builder AS runtime-deps
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY app.js server.js ./
COPY src ./src
USER node
EXPOSE 5000
CMD ["node", "server.js"]
