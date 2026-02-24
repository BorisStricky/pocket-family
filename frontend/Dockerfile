# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (copy only package files first for caching)
COPY package.json package-lock.json* ./

# Ensure devDeps are installed for the build step.
# If you keep NODE_ENV=production in build, npm ci will omit devDependencies.
ENV NODE_ENV=development

# install deps: prefer npm ci when lockfile is valid, otherwise fallback to npm install
RUN if [ -f package-lock.json ]; then npm ci --silent || npm install --silent; else npm install --silent; fi

# Copy all frontend sources (must be in ./frontend)
COPY . .

# Accept the API base URL as a build-time argument.
# Vite bakes VITE_* env vars into the JS bundle during `npm run build`, so
# this value cannot be injected at runtime — it must be provided here.
# docker-compose.yaml passes this via the build.args section.
ARG VITE_API_URL=http://192.168.1.101:8000
ENV VITE_API_URL=$VITE_API_URL

# Build the app (produces /app/dist)
RUN npm run build

# Serve via nginx
FROM nginx:stable-alpine AS prod
# Replace default nginx config with SPA-friendly one (optional)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
