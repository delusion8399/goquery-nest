import {
  DEFAULT_SALT_WORK_FACTOR,
  MAIN_DATABASE_CONN_NAME,
} from "./common.env";

const config = {
  name: "production",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  databases: {
    main: {
      uri: process.env.MONGO_URI || "mongodb://localhost:27017/goquery",
      name: MAIN_DATABASE_CONN_NAME,
    },
  },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 9000,
    publicUrl: "",
    corsOrigin: process.env.ALLOW_ORIGINS || "*",
  },
  saltWorkFactor: DEFAULT_SALT_WORK_FACTOR,
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "deepseek-chat",
    baseUrl:
      process.env.OPENROUTER_BASE_URL ||
      "https://api.deepseek.com/chat/completions",
  },
};

export default config;
