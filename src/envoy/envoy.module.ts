import { Global, Module } from "@nestjs/common";
import { EnvoyService } from "./envoy.service";

@Global()
@Module({
  providers: [EnvoyService],
  exports: [EnvoyService],
})
export class EnvoyModule {}
