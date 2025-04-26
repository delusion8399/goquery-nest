import developmentConfig from "./development.env";
import productionConfig from "./production.env";
import localConfig from "./local.env";

const env = process.env.NODE_ENV || "local";

let config = localConfig;

if (env === "local") {
  config = localConfig;
} else if (env === "development") {
  config = developmentConfig;
} else if (env === "production") {
  config = productionConfig;
}

export default config;
