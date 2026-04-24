# syntax=docker/dockerfile:1.6

# ---------- Build stage (produces dist/) ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Development stage (watch + debugger) ----------
# Full toolchain incl. devDependencies; source is expected to be bind-mounted
# from the host at runtime so `nest start --watch` picks up edits live.
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 4000 9229
CMD ["npm", "run", "start:debug"]

# ---------- Production stage (default) ----------
FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/main"]
