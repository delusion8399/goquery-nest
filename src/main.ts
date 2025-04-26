import {
  BadRequestException,
  Logger,
  ValidationError,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import config from "./configuration";
import { ResponseCodes } from "./shared/response/codes";

const recursiveExtract = (errors: ValidationError[]) => {
  return errors.reduce((ac, err) => {
    if (err.children.length > 0) return recursiveExtract(err.children);
    ac[err.property] = Object.values(err.constraints);
    return ac;
  }, {});
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new Logger(),
    cors: {
      origin: config.server.corsOrigin ?? "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      preflightContinue: false,
    },
  });

  app.useBodyParser("json", { limit: "10mb" });

  const logger = new Logger();
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory(errors) {
        const error = recursiveExtract(errors);
        return new BadRequestException({
          code: ResponseCodes.validation_error,
          message: Object.entries(error).map(([property, error]) => ({
            property,
            error,
          })),
        });
      },
    })
  );

  await app.listen(config.server.port, config.server.host);

  logger.log(`server started at ${config.server.port}, ${config.name}`);
}
bootstrap();
