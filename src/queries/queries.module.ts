import { Module } from "@nestjs/common";
import { QueriesController } from "./queries.controller";
import { QueriesService } from "./queries.service";
import { AiModule } from "src/ai/ai.module";

@Module({
  imports: [AiModule],
  controllers: [QueriesController],
  providers: [QueriesService],
  exports: [QueriesService],
})
export class QueriesModule {}
