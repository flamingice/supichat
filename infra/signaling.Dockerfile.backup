FROM node:20-alpine
WORKDIR /srv
COPY services/signaling/package.json ./
RUN npm install --omit=dev
COPY services/signaling ./
ENV PORT=4001
EXPOSE 4001
CMD ["node", "server.js"]




