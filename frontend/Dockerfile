# Dev-oriented image — matches docker-compose.yml, which bind-mounts
# ./frontend/src and ./frontend/public, expecting Vite's dev server
# with hot module reload, not a production static build served by Nginx.

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Vite's dev server binds to localhost by default, which is unreachable
# from outside the container. --host 0.0.0.0 makes it listen on all
# interfaces so the port mapping in docker-compose.yml (5173:5173)
# actually works.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]