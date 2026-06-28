FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --package-lock=false

COPY server.mjs ./

ENV PORT=9380
EXPOSE 9380

CMD ["node", "server.mjs"]
