import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { DatabasesService } from "./databases.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { TestConnectionDto } from "./dto/test-connection.dto";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    [key: string]: any;
  };
}

@Controller("api/databases")
@UseGuards(AuthGuard("jwt"))
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

  @Post()
  async createDatabase(
    @Req() req: AuthenticatedRequest,
    @Body() createDatabaseDto: CreateDatabaseDto
  ) {
    return this.databasesService.createDatabase(
      req.user.userId,
      createDatabaseDto
    );
  }

  @Get()
  async getDatabases(@Req() req: AuthenticatedRequest) {
    const databases = await this.databasesService.getDatabases(req.user.userId);

    // Transform the databases to include id property
    const transformedDatabases = databases.map((db) => {
      const dbObj = db.toObject ? db.toObject() : db;
      // Add id property if it doesn't exist
      if (dbObj._id && !dbObj._id) {
        dbObj._id = dbObj._id.toString();
      }
      return dbObj;
    });

    return { databases: transformedDatabases };
  }

  @Get(":id")
  async getDatabase(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Query("refresh") refresh?: boolean
  ) {
    const database = await this.databasesService.getDatabase(
      req.user.userId,
      id
    );

    // If refresh is true, fetch the schema and stats
    if (refresh === true) {
      const { schema, stats } = await this.databasesService.fetchDatabaseSchema(
        req.user.userId,
        id
      );
      // Use type assertion to avoid TypeScript errors
      (database as any).schema = schema;
      (database as any).stats = stats;
    }

    return database;
  }

  @Delete(":id")
  async deleteDatabase(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    return this.databasesService.deleteDatabase(req.user.userId, id);
  }

  @Post("/test-connection")
  async testConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.databasesService.testConnection(testConnectionDto);
  }

  @Get(":id/queries")
  async getDatabaseQueries(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.databasesService.getDatabaseQueries(
      req.user.userId,
      id,
      page,
      limit
    );
  }
}
