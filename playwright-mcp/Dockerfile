FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 3200
CMD ["node", "src/index.js"]
