# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Pass VITE_API_URL during build time so Vite embeds it into the bundles
ARG VITE_PUBLIC_FRONTEND_URL
ENV VITE_PUBLIC_FRONTEND_URL=$VITE_PUBLIC_FRONTEND_URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_BUILD_MODE=production
RUN npm run build -- --mode "$VITE_BUILD_MODE"

# Production stage
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config to handle SPA routing (redirect all paths to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
