FROM public.ecr.aws/docker/library/node:22.11.0-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g @nestjs/cli

ENV NODE_ENV=production

RUN npm install

COPY . .

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start"]
