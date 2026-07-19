FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci && npm install @rolldown/binding-linux-x64-musl --no-save

# Copy source code
COPY . .

EXPOSE 5000

# Start dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5000"]
