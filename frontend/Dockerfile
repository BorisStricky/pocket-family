# frontend/Dockerfile
FROM node:18-alpine AS build
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
