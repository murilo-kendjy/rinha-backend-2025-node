FROM node:lts-alpine AS base
RUN apk add tzdata
ENV TZ=America/Sao_Paulo
WORKDIR /home/node/app
COPY package.json ./
RUN npm install --omit=dev

FROM base AS build
RUN npm install
COPY ./src ./src
COPY tsconfig.json ./
RUN npm run build

FROM node:lts-alpine AS prod
RUN apk add tzdata
ENV TZ=America/Sao_Paulo
WORKDIR /home/node/app
COPY package.json ./
COPY --from=base /home/node/app/node_modules ./node_modules
COPY --from=build /home/node/app/dist ./dist
CMD ["npm", "run", "start"]
