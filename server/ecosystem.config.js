module.exports = {
  apps: [{
    name: "steadfast-server",
    script: "server.js",
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
