FROM node:20-alpine

WORKDIR /app

# Copy server package files and install production dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy all server files
COPY server/ ./

# Expose server port (Render will bind dynamically to $PORT)
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
