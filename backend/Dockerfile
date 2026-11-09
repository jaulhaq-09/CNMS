# Dev-oriented image — matches docker-compose.yml, which bind-mounts
# ./backend/src into the container and expects nodemon-driven hot
# reload, not a static production build.

FROM node:20-alpine
WORKDIR /app

# Full install (including devDependencies) since nodemon lives there,
# not in dependencies — unlike a production image, we need it here.
COPY package.json package-lock.json* ./
RUN npm install

# Baseline copy of the whole app; at runtime docker-compose overrides
# /app/src with your live local folder via a bind mount, so edits on
# your machine are picked up immediately without rebuilding the image.
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]