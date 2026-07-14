FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN chmod +x /usr/src/app/entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["sh", "/usr/src/app/entrypoint.sh"]
CMD ["npm", "run", "dev"]
