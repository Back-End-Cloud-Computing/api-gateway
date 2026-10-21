FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN yarn install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN yarn build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN yarn install --production && yarn cache clean
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000 9100
CMD ["node", "dist/main.js"]
