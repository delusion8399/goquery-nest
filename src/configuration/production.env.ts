import {
  DEFAULT_SALT_WORK_FACTOR,
  MAIN_DATABASE_CONN_NAME,
} from "./common.env";

const config = {
  name: "production",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  databases: {
    main: {
      uri: "mongodb+srv://delusion8399:6XOq66BK1lt8Gbjg@cluster0.wrea4gz.mongodb.net/goquery?retryWrites=true&w=majority&appName=Cluster0",
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
    apiKey: "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",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
};

export default config;
