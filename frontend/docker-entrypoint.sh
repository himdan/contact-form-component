#!/bin/sh

# Substitute environment variables in nginx configuration
envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Substitute environment variables in HTML files
if [ -f "/usr/share/nginx/html/index.html" ]; then
    envsubst '${API_URL}' < /usr/share/nginx/html/index.html > /usr/share/nginx/html/index.html.tmp
    mv /usr/share/nginx/html/index.html.tmp /usr/share/nginx/html/index.html
fi

# Create nginx.conf.template from nginx.conf
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.template

echo "Starting nginx with API_URL: ${API_URL}"

# Start nginx
exec "$@"