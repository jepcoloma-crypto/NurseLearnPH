// pm2 production config — start from the repo root:
//   pm2 start ecosystem.config.js
//
// Values come from .env.production (gitignored). The app's own dotenv loads
// the dev .env for everything NOT listed here (SMTP, Gemini); pm2-injected
// values always win because dotenv never overwrites existing variables.
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env.production") });

module.exports = {
  apps: [
    {
      name: "nurselearn-api",
      script: "dist/index.js",
      cwd: path.resolve(__dirname, "server"),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        PORT: process.env.PORT,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        CLIENT_URL: process.env.CLIENT_URL,
        SIGNUP_MODE: process.env.SIGNUP_MODE,
        LOG_LEVEL: process.env.LOG_LEVEL,
      },
    },
    {
      // Quick tunnel: public HTTPS → local API (port in .env.production).
      // URL is random per start — see DEPLOY.md §11 to swap in a stable
      // domain-based named tunnel later.
      name: "nurselearn-tunnel",
      script: "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
      args: ["--config", "C:\\Projects\\NurseLearnPH\\cloudflared-quick.yml", "tunnel", "--url", "http://localhost:3003"],
      autorestart: false,
      env: {},
    },
  ],
};
