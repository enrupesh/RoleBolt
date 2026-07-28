FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx tsc --outDir dist --skipLibCheck 2>/dev/null || true
EXPOSE 8080
CMD ["node", "dist/index.js"]
