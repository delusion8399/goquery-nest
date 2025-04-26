FROM node:22.14.0-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g @nestjs/cli

ENV NODE_ENV=production

RUN npm install

COPY . .

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start"]
