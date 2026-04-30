FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile
COPY server ./server
RUN pnpm --filter @sort-bot-arena/server build
RUN pnpm --filter @sort-bot-arena/server deploy --prod /tmp/deploy

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/dist ./dist
COPY --from=build /tmp/deploy/node_modules ./node_modules
COPY --from=build /tmp/deploy/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
