# Base image
FROM ubuntu:latest

# Set working directory
WORKDIR /app

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl git && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Copy app source code
COPY . .

RUN rm -rf node_modules

# Install app dependencies
RUN npm cache clean -f
RUN npm install

# Build app
RUN npm run build

RUN mkdir -p /app/pg/ssl
COPY certs /app/pg/ssl/certs

# Expose port 3003
EXPOSE 3003

# Start the app
CMD [ "npm", "run", "serve" ]