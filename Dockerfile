
FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    qpdf \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads converted temp

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server/app.js"]
