# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy frontend files
COPY . .

# Create optimized version of contact-form.js
RUN echo "Optimizing web component..."

# Production stage
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf.template

# Copy built files
COPY --from=build /app/index.html /usr/share/nginx/html/
COPY --from=build /app/contact-form.js /usr/share/nginx/html/

# Create environment variable substitution script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]