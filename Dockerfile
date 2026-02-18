# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build
# We don't have a build script in package.json yet, need to add it or run tsc directly. 
# Better add it to package.json via sed or assume standard `tsc`. 
# Let's assume we'll update package.json or runs npx tsc.
RUN npx tsc

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
