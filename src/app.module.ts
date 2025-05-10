import { Module, OnApplicationBootstrap } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { EnvoyModule } from "./envoy/envoy.module";
import { AuthenticationModule } from "./authentication/authentication.module";
import config from "src/configuration";
import { DatabasesModule } from "./databases/databases.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { QueriesModule } from "./queries/queries.module";
import { AiModule } from "./ai/ai.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    EnvoyModule,
    DatabaseModule,
    AuthenticationModule,
    DatabasesModule,
    QueriesModule,
    DashboardsModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  onApplicationBootstrap() {
    console.log("ENV:", config.name, "Port:", config.server.port);
  }
}
