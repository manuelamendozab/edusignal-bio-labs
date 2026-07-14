FROM node:20-alpine AS deps
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY package.json ./
RUN npm install --production
COPY . .
RUN chmod +x /usr/src/app/entrypoint.sh
EXPOSE 4173
ENTRYPOINT ["sh", "/usr/src/app/entrypoint.sh"]
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
