FROM node:20

# Chrome dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 libx11-6 libxcb1 \
  libxext6 fonts-liberation wget ca-certificates \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit

COPY . .

CMD ["node", "scripts/bot/index.js"]
