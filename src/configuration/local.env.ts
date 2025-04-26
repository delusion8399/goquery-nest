import {
  DEFAULT_SALT_WORK_FACTOR,
  MAIN_DATABASE_CONN_NAME,
} from "./common.env";

const config = {
  name: "local",
  frontendUrl: "http://localhost:3000",
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
    corsOrigin: process.env.ALLOW_ORIGINS || "http://localhost:3000",
  },
  saltWorkFactor: DEFAULT_SALT_WORK_FACTOR,
  openRouter: {
    apiKey: "sk-27a181185efe4c64ba39ececde2168f8",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/chat/completions",
  },
};

export default config;
