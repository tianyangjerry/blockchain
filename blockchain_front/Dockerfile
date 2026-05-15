FROM node:20-alpine AS build
WORKDIR /app
COPY blockchain_front/package.json blockchain_front/pnpm-lock.yaml ./
ENV CI=1
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate && pnpm config set node-linker hoisted && pnpm install --frozen-lockfile --shamefully-hoist
COPY blockchain_front/ .
RUN pnpm build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]


