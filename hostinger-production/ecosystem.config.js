module.exports = {
  apps: [{
    name: "steadfast-server",
    script: "./server.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "450M",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    merge_logs: true,
    time: true
  }]
};
