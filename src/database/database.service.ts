import { Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import config from "src/configuration";
import { Database, DatabaseDocument } from "./models/database.entity";
import { Connection, Model } from "mongoose";
import { Query, QueryDocument } from "./models/query.entity";
import { Dashboard, DashboardDocument } from "./models/dashboard.entity";
import { User, UserDocument } from "./models/user.entity";

@Injectable()
export class DatabaseService {
  @InjectConnection(config.databases.main.name)
  public con: Connection;

  ObjectId(id?: string) {
    return new mongoose.Types.ObjectId(id);
  }

  @InjectModel(Database.name, config.databases.main.name)
  public databaseModel: Model<DatabaseDocument>;

  @InjectModel(Query.name, config.databases.main.name)
  public queryModel: Model<QueryDocument>;

  @InjectModel(Dashboard.name, config.databases.main.name)
  public dashboardModel: Model<DashboardDocument>;

  @InjectModel(User.name, config.databases.main.name)
  public userModel: Model<UserDocument>;
}
