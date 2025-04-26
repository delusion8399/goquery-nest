import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { MongoClient } from "mongodb";
import { Client } from "pg";
import { AiService } from "src/ai/ai.service";
import { DatabaseService } from "src/database/database.service";
import { QueryStatus } from "src/database/models/query.entity";
import { CreateQueryDto } from "./dto/create-query.dto";
import { UpdateQueryDto } from "./dto/update-query.dto";

@Injectable()
export class QueriesService {
  private readonly logger = new Logger(QueriesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiService: AiService
  ) {}

  async createQuery(userId: string, createQueryDto: CreateQueryDto) {
    // Check if database exists and user has access to it
    const database = await this.databaseService.databaseModel.findOne({
      _id: this.databaseService.ObjectId(createQueryDto.databaseId),
      userId: this.databaseService.ObjectId(userId),
    });

    if (!database) {
      throw new NotFoundException("Database not found");
    }

    // Create query with pending status
    const newQuery = await this.databaseService.queryModel.create({
      userId: this.databaseService.ObjectId(userId),
      databaseId: this.databaseService.ObjectId(createQueryDto.databaseId),
      naturalQuery: createQueryDto.query,
      name: createQueryDto.name || "",
      status: QueryStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate SQL/MongoDB query (this would be implemented with AI)
    const { query: generatedQuery, prompt } = await this.generateQuery(
      database,
      createQueryDto.query
    );

    // Execute query
    try {
      // Update query status to running
      await this.databaseService.queryModel.updateOne(
        { _id: newQuery._id },
        {
          $set: {
            status: QueryStatus.RUNNING,
            generatedSQL: generatedQuery,
            prompt: prompt,
            updatedAt: new Date(),
          },
        }
      );

      // Execute query
      const startTime = Date.now();
      const results = await this.executeQuery(database, generatedQuery);
      const executionTime = `${Date.now() - startTime}ms`;

      // Update query with results
      await this.databaseService.queryModel.updateOne(
        { _id: newQuery._id },
        {
          $set: {
            status: QueryStatus.COMPLETED,
            results,
            executionTime,
            updatedAt: new Date(),
          },
        }
      );

      // Generate a title if none was provided
      if (!createQueryDto.name) {
        const generatedName = await this.generateQueryTitle(
          createQueryDto.query
        );
        await this.databaseService.queryModel.updateOne(
          { _id: newQuery._id },
          { $set: { name: generatedName } }
        );
      }

      // Return updated query
      return this.databaseService.queryModel.findById(newQuery._id);
    } catch (error) {
      // Delete the query instead of updating it to FAILED status
      await this.databaseService.queryModel.findByIdAndDelete(newQuery._id);

      // Throw the error to be handled by the controller
      throw new BadRequestException(
        `Failed to execute query: ${error.message}`
      );
    }
  }

  async getQueries(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [queries, total] = await Promise.all([
      this.databaseService.queryModel
        .find({
          userId: this.databaseService.ObjectId(userId),
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.databaseService.queryModel.countDocuments({
        userId: this.databaseService.ObjectId(userId),
      }),
    ]);

    return {
      queries: queries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getQuery(userId: string, queryId: string) {
    const query = await this.databaseService.queryModel.findOne({
      _id: this.databaseService.ObjectId(queryId),
      userId: this.databaseService.ObjectId(userId),
    });

    if (!query) {
      throw new NotFoundException("Query not found");
    }

    return query;
  }

  async updateQuery(
    userId: string,
    queryId: string,
    updateQueryDto: UpdateQueryDto
  ) {
    const query = await this.databaseService.queryModel.findOneAndUpdate(
      {
        _id: this.databaseService.ObjectId(queryId),
        userId: this.databaseService.ObjectId(userId),
      },
      {
        $set: {
          ...updateQueryDto,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!query) {
      throw new NotFoundException("Query not found");
    }

    return query;
  }

  async deleteQuery(userId: string, queryId: string) {
    const query = await this.databaseService.queryModel.findOneAndDelete({
      _id: this.databaseService.ObjectId(queryId),
      userId: this.databaseService.ObjectId(userId),
    });

    if (!query) {
      throw new NotFoundException("Query not found");
    }

    return { success: true };
  }

  async rerunQuery(userId: string, queryId: string) {
    // Find the query
    const query = await this.databaseService.queryModel.findOne({
      _id: this.databaseService.ObjectId(queryId),
      userId: this.databaseService.ObjectId(userId),
    });

    if (!query) {
      throw new NotFoundException("Query not found");
    }

    // Find the database
    const database = await this.databaseService.databaseModel.findOne({
      _id: query.databaseId,
      userId: this.databaseService.ObjectId(userId),
    });

    if (!database) {
      throw new NotFoundException("Database not found");
    }

    // Execute query
    try {
      // Update query status to running
      await this.databaseService.queryModel.updateOne(
        { _id: query._id },
        {
          $set: {
            status: QueryStatus.RUNNING,
            updatedAt: new Date(),
          },
        }
      );

      // Execute query
      const startTime = Date.now();
      const results = await this.executeQuery(database, query.generatedSQL);
      const executionTime = `${Date.now() - startTime}ms`;

      // Update query with results
      await this.databaseService.queryModel.updateOne(
        { _id: query._id },
        {
          $set: {
            status: QueryStatus.COMPLETED,
            results,
            executionTime,
            updatedAt: new Date(),
          },
        }
      );

      // Return updated query
      return this.databaseService.queryModel.findById(query._id);
    } catch (error) {
      // For rerun, we don't want to delete the original query
      // Instead, we'll just throw the error without updating the query
      throw new BadRequestException(
        `Failed to execute query: ${error.message}`
      );
    }
  }

  private async generateQuery(
    database: any,
    naturalQuery: string
  ): Promise<{ query: string; prompt: string }> {
    try {
      this.logger.log(`Generating ${database.type} query for: ${naturalQuery}`);

      // Call the AI service to generate the query
      const result = await this.aiService.generateDatabaseQuery(
        database.type,
        database.schema,
        naturalQuery
      );

      this.logger.debug(`Generated query: ${result.query}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Error generating query: ${error.message}`);
      throw new BadRequestException(
        `Failed to generate query: ${error.message}`
      );
    }
  }

  private async generateQueryTitle(naturalQuery: string): Promise<string> {
    // Use the AI service to generate a title
    try {
      this.logger.log(`Generating title for query: ${naturalQuery}`);

      // Call the AI service to generate a title
      const title = await this.aiService.generateQueryTitle(naturalQuery);

      this.logger.debug(`Generated title: ${title}`);
      return title;
    } catch (error: any) {
      this.logger.error(`Error generating query title: ${error.message}`);
      // Return a default title if generation fails
      return `Query ${new Date().toISOString()}`;
    }
  }

  private async executeQuery(database: any, query: string): Promise<any[]> {
    switch (database.type) {
      case "mongodb":
        return this.executeMongoDBQuery(database, query);
      case "postgresql":
        return this.executePostgresQuery(database, query);
      default:
        throw new BadRequestException(
          `Unsupported database type: ${database.type}`
        );
    }
  }

  private async executeMongoDBQuery(
    database: any,
    query: string
  ): Promise<any[]> {
    try {
      // Create MongoDB client
      let connectionString: string;
      if (database.connectionURI) {
        connectionString = database.connectionURI;
      } else {
        const { username, password, host, databaseName, ssl } = database;
        connectionString = `mongodb+srv://${username}:${password}@${host}/${databaseName}`;

        if (ssl) {
          connectionString += "?ssl=true";
        }

        connectionString += "&retryWrites=true&w=majority";
      }

      // Extract database name from connection string if not explicitly provided
      let dbName = database.databaseName;
      if (database.connectionURI && (!dbName || dbName.trim() === "")) {
        // Extract database name from the connection URI
        const uri = database.connectionURI;
        const parts = uri.split("/");
        if (parts.length > 3) {
          const dbPart = parts[parts.length - 1].split("?")[0];
          dbName = dbPart;
        }
      }

      if (!dbName) {
        throw new Error("Database name could not be determined");
      }

      const client = new MongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);

      // Parse the query to extract collection name, operation type, and query details
      const lines = query.split("\n");
      let collectionName = "";
      let operationType = "";
      let queryJson = "";

      // Extract collection name and operation type from comments
      for (const line of lines) {
        if (line.startsWith("// Collection:")) {
          collectionName = line.replace("// Collection:", "").trim();
        } else if (line.startsWith("// Operation:")) {
          operationType = line.replace("// Operation:", "").trim();
        } else if (line.trim() && !line.startsWith("//")) {
          // Accumulate non-comment lines as the query JSON
          queryJson += line;
        }
      }

      if (!collectionName) {
        throw new Error("Collection name not specified in the query");
      }

      if (!operationType) {
        throw new Error("Operation type not specified in the query");
      }

      // Clean up the JSON string - remove any extra whitespace or formatting
      queryJson = queryJson.trim();

      // Parse the JSON query
      let parsedQuery: any;
      try {
        this.logger.debug(`Attempting to parse query JSON: ${queryJson}`);
        parsedQuery = JSON.parse(queryJson);
      } catch (error: any) {
        this.logger.error(`JSON parse error: ${error.message}`);

        // Try to fix common JSON formatting issues
        try {
          // Replace any potential duplicate line breaks or spaces
          const cleanedJson = queryJson.replace(/\s+/g, " ").trim();
          this.logger.debug(`Attempting to parse cleaned JSON: ${cleanedJson}`);
          parsedQuery = JSON.parse(cleanedJson);
          this.logger.debug("Successfully parsed cleaned JSON");
        } catch (cleanError: any) {
          throw new Error(
            `Invalid query JSON: ${error.message}. Original query: ${queryJson}`
          );
        }
      }

      let results = [];

      // Execute the query based on operation type
      if (operationType === "find") {
        const cursor = db
          .collection(collectionName)
          .find(parsedQuery)
          .limit(100);
        results = await cursor.toArray();
      } else if (operationType === "aggregate") {
        const cursor = db.collection(collectionName).aggregate(parsedQuery);
        results = await cursor.toArray();
      } else {
        throw new Error(`Unsupported operation type: ${operationType}`);
      }

      await client.close();
      return results;
    } catch (error: any) {
      this.logger.error(
        `Error executing MongoDB query: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to execute MongoDB query: ${error.message}`
      );
    }
  }

  private async executePostgresQuery(
    database: any,
    query: string
  ): Promise<any[]> {
    try {
      const { host, port, username, password, databaseName, ssl } = database;

      // Clean up the query - remove markdown SQL tags if present
      let cleanedQuery = query;
      if (query.startsWith("```sql") || query.startsWith("```")) {
        cleanedQuery = query
          .replace(/^```sql\n/, "") // Remove opening ```sql tag
          .replace(/^```\n/, "") // Remove opening ``` tag
          .replace(/\n```$/, "") // Remove closing ``` tag
          .trim();
      }

      // Create PostgreSQL client
      const client = new Client({
        host,
        port: parseInt(port),
        user: username,
        password,
        database: databaseName,
        ssl: ssl ? { rejectUnauthorized: false } : false,
      });

      // Connect to the database
      this.logger.log(`Connecting to PostgreSQL database: ${databaseName}`);
      await client.connect();

      // Execute the query
      this.logger.debug(`Executing PostgreSQL query: ${cleanedQuery}`);
      const startTime = Date.now();
      const result = await client.query(cleanedQuery);
      const queryTime = Date.now() - startTime;
      this.logger.debug(`Query executed in ${queryTime}ms`);

      // Close the connection
      await client.end();

      // Return the rows from the result
      return result.rows || [];
    } catch (error: any) {
      this.logger.error(
        `Error executing PostgreSQL query: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to execute PostgreSQL query: ${error.message}`
      );
    }
  }
}
