import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import config from "src/configuration";
import { DatabaseService } from "./database.service";
import { UserSchema, User } from "./models/user.entity";
import { Database, DatabaseSchema } from "./models/database.entity";
import { Query, QuerySchema } from "./models/query.entity";
import { Dashboard, DashboardSchema } from "./models/dashboard.entity";

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(config.databases.main.uri, {
      connectionName: config.databases.main.name,
      autoIndex: true,
    }),
    MongooseModule.forFeature(
      [
        {
          schema: UserSchema,
          name: User.name,
        },
        {
          schema: DatabaseSchema,
          name: Database.name,
        },
        {
          schema: QuerySchema,
          name: Query.name,
        },
        {
          schema: DashboardSchema,
          name: Dashboard.name,
        },
      ],
      config.databases.main.name
    ),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
