FROM node:20

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies using npm ci for more reliable installation
RUN npm install --no-audit

# Copy the rest of the application
COPY . .

# Keep container running
CMD ["tail", "-f", "/dev/null"]
