FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4111
# Production start: build the Mastra bundle, then run it.
# npm install is kept at start time because the source tree is bind-mounted
# over /app and node_modules lives in a named volume (fresh on first start).
CMD ["sh", "-c", "npm install && npm run build && node .mastra/output/index.mjs"]
