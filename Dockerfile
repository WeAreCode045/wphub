# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.13.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Vite"

# Vite app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev --ignore-scripts

# Copy application code
COPY . .

# Build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ARG VITE_APP_NAME
ARG VITE_APP_DOMAIN

# Set environment variables for build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM nginx

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Start the server by default, this can be overwritten at runtime
EXPOSE 80
CMD [ "/usr/sbin/nginx", "-g", "daemon off;" ]
