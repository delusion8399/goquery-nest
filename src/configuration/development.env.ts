import {
  DEFAULT_SALT_WORK_FACTOR,
  MAIN_DATABASE_CONN_NAME,
} from "./common.env";

const config = {
  name: "development",
  frontendUrl: "http://localhost:3000",
  databases: {
    main: {
      uri: "mongodb://tijarah:MA6Bnte9X93T34Gaw2dtB58sL9qguDYUvuWZ@152.67.160.174:27088/gq?authSource=admin",
      name: MAIN_DATABASE_CONN_NAME,
    },
  },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 9000,
    publicUrl: "",
    corsOrigin: process.env.ALLOW_ORIGINS || "http://localhost:3000",
  },
  saltWorkFactor: DEFAULT_SALT_WORK_FACTOR,
  openRouter: {
    apiKey: "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",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
};

export default config;
