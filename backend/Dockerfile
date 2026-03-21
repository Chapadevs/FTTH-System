# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN npx prisma generate

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/src src
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]
