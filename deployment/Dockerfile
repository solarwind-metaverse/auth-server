# Base image
FROM vhalme/solarwind-nodejs-server

# Set working directory
WORKDIR /app

# Copy app source code
RUN git clone https://github.com/solarwind-metaverse/auth-server.git

WORKDIR /app/auth-server
# Install app dependencies
RUN npm install

# Build app
RUN npm run build

RUN mkdir -p /app/pg/ssl
COPY certs /app/pg/ssl/certs

# Expose port 3003
EXPOSE 3003

# Start the app
CMD [ "npm", "run", "serve" ]