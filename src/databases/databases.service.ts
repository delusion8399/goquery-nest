import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { TestConnectionDto } from "./dto/test-connection.dto";
import * as mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { Client } from "pg";

@Injectable()
export class DatabasesService {
  constructor(private readonly ds: DatabaseService) {}

  async createDatabase(userId: string, createDatabaseDto: CreateDatabaseDto) {
    const databaseData = { ...createDatabaseDto };

    if (databaseData.type === "mongodb" && databaseData.connectionURI) {
      try {
        const dbName = this.extractDatabaseNameFromURI(
          databaseData.connectionURI
        );
        if (dbName) {
          databaseData.databaseName = dbName;
        }
      } catch (error) {
        console.warn(error.message);
      }
    }

    // First, test the connection to ensure it's valid
    try {
      await this.testConnection(databaseData);
    } catch (error) {
      throw new BadRequestException(
        `Failed to create database: ${error.message}`
      );
    }

    // Create the database with lastConnected timestamp
    const newDatabase = await this.ds.databaseModel.create({
      userId: this.ds.ObjectId(userId),
      ...databaseData,
      lastConnected: new Date(),
    });

    try {
      // Fetch schema and stats
      let schema: { tables: any[] };
      let stats: { tableCount: number; size: string };

      switch (databaseData.type) {
        case "mongodb":
          schema = await this.fetchMongoDBSchema(newDatabase);
          stats = await this.fetchMongoDBStats(newDatabase);
          break;
        case "postgresql":
          schema = await this.fetchPostgresSchema(newDatabase);
          stats = await this.fetchPostgresStats(newDatabase);
          break;
        default:
          throw new BadRequestException(
            `Unsupported database type: ${databaseData.type}`
          );
      }

      // Update the database with schema and stats
      await this.ds.databaseModel.updateOne(
        { _id: newDatabase._id },
        {
          $set: {
            schema,
            stats,
            updatedAt: new Date(),
          },
        }
      );

      // Refresh the database object to include the schema and stats
      return this.getDatabase(userId, newDatabase._id.toString());
    } catch (error) {
      console.error(`Error fetching schema for new database: ${error.message}`);
      // Return the database even if schema fetching fails
      return newDatabase;
    }
  }

  private extractDatabaseNameFromURI(uri: string): string | null {
    try {
      // Handle standard MongoDB connection strings
      // Format: mongodb://username:password@host:port/database?options
      // or mongodb+srv://username:password@host/database?options

      // Remove protocol part
      let connectionString = uri;
      if (connectionString.startsWith("mongodb://")) {
        connectionString = connectionString.substring("mongodb://".length);
      } else if (connectionString.startsWith("mongodb+srv://")) {
        connectionString = connectionString.substring("mongodb+srv://".length);
      } else {
        return null;
      }

      // Skip username:password@ part if present
      const atIndex = connectionString.indexOf("@");
      if (atIndex !== -1) {
        connectionString = connectionString.substring(atIndex + 1);
      }

      // Find the database name part (between / and ?)
      const slashIndex = connectionString.indexOf("/");
      if (slashIndex === -1) {
        return null;
      }

      connectionString = connectionString.substring(slashIndex + 1);

      // Remove query parameters if present
      const questionMarkIndex = connectionString.indexOf("?");
      if (questionMarkIndex !== -1) {
        connectionString = connectionString.substring(0, questionMarkIndex);
      }

      // If we have a non-empty database name, return it
      return connectionString.trim() || null;
    } catch (error) {
      console.error("Error extracting database name from URI:", error);
      return null;
    }
  }

  async getDatabases(userId: string) {
    return this.ds.databaseModel.find({
      userId: this.ds.ObjectId(userId),
    });
  }

  async getDatabase(userId: string, databaseId: string) {
    const database = await this.ds.databaseModel.findOne({
      _id: this.ds.ObjectId(databaseId),
      userId: this.ds.ObjectId(userId),
    });

    if (!database) {
      throw new NotFoundException("Database not found");
    }

    return database;
  }

  async deleteDatabase(userId: string, databaseId: string) {
    const database = await this.ds.databaseModel.findOneAndDelete({
      _id: this.ds.ObjectId(databaseId),
      userId: this.ds.ObjectId(userId),
    });

    if (!database) {
      throw new NotFoundException("Database not found");
    }

    return { success: true };
  }

  async testConnection(testConnectionDto: TestConnectionDto) {
    try {
      const connectionData = { ...testConnectionDto };

      if (connectionData.type === "mongodb" && connectionData.connectionURI) {
        try {
          // Extract database name from the connection URI
          const dbName = this.extractDatabaseNameFromURI(
            connectionData.connectionURI
          );
          if (dbName) {
            connectionData.databaseName = dbName;
          }
        } catch (error) {
          console.warn(
            "Failed to extract database name from URI:",
            error.message
          );
        }
      }

      switch (connectionData.type) {
        case "mongodb":
          await this.testMongoDBConnection(connectionData);
          break;
        case "postgresql":
          await this.testPostgresConnection(connectionData);
          break;
        default:
          throw new BadRequestException(
            `Unsupported database type: ${connectionData.type}`
          );
      }

      return { success: true };
    } catch (error) {
      throw new BadRequestException(`Connection failed: ${error.message}`);
    }
  }

  async getDatabaseQueries(
    userId: string,
    databaseId: string,
    page = 1,
    limit = 10
  ) {
    const skip = (page - 1) * limit;

    const [queries, total] = await Promise.all([
      this.ds.queryModel
        .find({
          userId: this.ds.ObjectId(userId),
          databaseId: this.ds.ObjectId(databaseId),
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.ds.queryModel.countDocuments({
        userId: this.ds.ObjectId(userId),
        databaseId: this.ds.ObjectId(databaseId),
      }),
    ]);

    return {
      queries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async testMongoDBConnection(testConnectionDto: TestConnectionDto) {
    let connectionString: string;

    if (testConnectionDto.connectionURI) {
      connectionString = testConnectionDto.connectionURI;
    } else {
      const { username, password, host, databaseName, ssl } = testConnectionDto;
      connectionString = `mongodb+srv://${username}:${password}@${host}/${databaseName}`;

      if (ssl) {
        connectionString += "?ssl=true";
      }

      connectionString += "&retryWrites=true&w=majority";
    }

    const client = new MongoClient(connectionString);

    await client.connect();
    await client.db().admin().ping();
    await client.close();
  }

  private async testPostgresConnection(testConnectionDto: TestConnectionDto) {
    const { host, port, username, password, databaseName, ssl } =
      testConnectionDto;

    const client = new Client({
      host,
      port: parseInt(port),
      user: username,
      password,
      database: databaseName,
      ssl: ssl ? { rejectUnauthorized: false } : false,
    });

    await client.connect();
    await client.query("SELECT 1");
    await client.end();
  }

  async fetchDatabaseSchema(userId: string, databaseId: string) {
    const database = await this.getDatabase(userId, databaseId);

    try {
      // Define schema type with tables array
      let schema: { tables: any[] };
      let stats: { tableCount: number; size: string };

      switch (database.type) {
        case "mongodb":
          schema = await this.fetchMongoDBSchema(database);
          stats = await this.fetchMongoDBStats(database);
          break;
        case "postgresql":
          schema = await this.fetchPostgresSchema(database);
          stats = await this.fetchPostgresStats(database);
          break;
        default:
          throw new BadRequestException(
            `Unsupported database type: ${database.type}`
          );
      }

      // Update database with schema and stats
      await this.ds.databaseModel.updateOne(
        { _id: database._id },
        {
          $set: {
            schema,
            stats,
            lastConnected: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return { schema, stats };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch schema: ${error.message}`);
    }
  }

  // Helper function to format file size
  private formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Fetch MongoDB database statistics
  private async fetchMongoDBStats(
    database: any
  ): Promise<{ tableCount: number; size: string }> {
    console.log(`Fetching stats for MongoDB database: ${database.name}`);

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
        dbName = this.extractDatabaseNameFromURI(database.connectionURI);
      }

      if (!dbName) {
        throw new Error("Database name could not be determined");
      }

      const client = new MongoClient(connectionString);
      await client.connect();

      // Get database and list collections
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();

      // Count non-system collections
      let collectionCount = 0;
      for (const collection of collections) {
        if (!collection.name.startsWith("system.")) {
          collectionCount++;
        }
      }

      // Get database stats
      const stats = await db.stats();
      const sizeBytes = stats.dataSize || 0;
      const size = this.formatSize(sizeBytes);

      await client.close();

      return {
        tableCount: collectionCount,
        size,
      };
    } catch (error) {
      console.error("Error fetching MongoDB stats:", error);
      return {
        tableCount: 0,
        size: "Unknown",
      };
    }
  }

  // Fetch PostgreSQL database statistics
  private async fetchPostgresStats(
    database: any
  ): Promise<{ tableCount: number; size: string }> {
    console.log(`Fetching stats for PostgreSQL database: ${database.name}`);

    try {
      const { host, port, username, password, databaseName, ssl } = database;

      // Create PostgreSQL client
      const client = new Client({
        host,
        port: parseInt(port),
        user: username,
        password,
        database: databaseName,
        ssl: ssl ? { rejectUnauthorized: false } : false,
      });

      await client.connect();

      // Query to get table count
      const tableCountQuery = `
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `;

      const tableCountResult = await client.query(tableCountQuery);
      const tableCount = parseInt(tableCountResult.rows[0].count) || 0;

      // Query to get database size
      const sizeQuery = `
        SELECT pg_database_size(current_database())
      `;

      const sizeResult = await client.query(sizeQuery);
      const sizeBytes = parseInt(sizeResult.rows[0].pg_database_size) || 0;
      const size = this.formatSize(sizeBytes);

      await client.end();

      return {
        tableCount,
        size,
      };
    } catch (error) {
      console.error("Error fetching PostgreSQL stats:", error);
      return {
        tableCount: 0,
        size: "Unknown",
      };
    }
  }

  private async fetchMongoDBSchema(database: any): Promise<{ tables: any[] }> {
    console.log(`Fetching schema for MongoDB database: ${database.name}`);

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
        dbName = this.extractDatabaseNameFromURI(database.connectionURI);
      }

      if (!dbName) {
        throw new Error("Database name could not be determined");
      }

      const client = new MongoClient(connectionString);
      await client.connect();

      // Get database and list collections
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();

      const tables = [];

      // Process each collection
      for (const collection of collections) {
        const collName = collection.name;

        // Skip system collections
        if (collName.startsWith("system.")) {
          continue;
        }

        const coll = db.collection(collName);

        // Sample documents to build a comprehensive schema
        // Limit to 100 documents to avoid performance issues with large collections
        const cursor = coll.find({}).limit(100);

        let mergedColumns = [];
        let docsProcessed = 0;

        // Process each document and merge schemas
        const documents = await cursor.toArray();
        for (const doc of documents) {
          if (docsProcessed === 0) {
            // For the first document, initialize the schema
            mergedColumns = this.inferMongoDBColumns(doc);
          } else {
            // For subsequent documents, merge with existing schema
            const currentColumns = this.inferMongoDBColumns(doc);
            mergedColumns = this.mergeMongoDBColumns(
              mergedColumns,
              currentColumns
            );
          }

          docsProcessed++;
        }

        console.log({ name: collName, columns: mergedColumns });

        tables.push({
          name: collName,
          columns: mergedColumns,
        });
      }

      await client.close();

      return { tables };
    } catch (error) {
      console.error("Error fetching MongoDB schema:", error);
      return { tables: [] };
    }
  }

  // Infer columns from a MongoDB document
  private inferMongoDBColumns(doc: any): any[] {
    return this.inferMongoDBColumnsWithPath(doc, "");
  }

  // Infer columns from a MongoDB document with path tracking
  private inferMongoDBColumnsWithPath(doc: any, parentPath: string): any[] {
    const columns = [];

    for (const [key, value] of Object.entries(doc)) {
      // Build the full path for this field
      const path = parentPath ? `${parentPath}.${key}` : key;

      if (key === "_id") {
        columns.push({
          name: "_id",
          type: "ObjectID",
          nullable: false,
          primaryKey: true,
          path: path,
        });
        continue;
      }

      let dataType = "unknown";
      let fields = [];

      if (value === null) {
        dataType = "null";
      } else if (typeof value === "string") {
        dataType = "string";
      } else if (typeof value === "number") {
        dataType = "number";
      } else if (typeof value === "boolean") {
        dataType = "boolean";
      } else if (value instanceof Date) {
        dataType = "date";
      } else if (Array.isArray(value)) {
        dataType = "array";
        // Process array elements if not empty
        if (
          value.length > 0 &&
          typeof value[0] === "object" &&
          value[0] !== null
        ) {
          fields = this.inferMongoDBColumnsWithPath(value[0], path);
        }
      } else if (typeof value === "object") {
        dataType = "object";
        fields = this.inferMongoDBColumnsWithPath(value, path);
      }

      columns.push({
        name: key,
        type: dataType,
        nullable: true,
        primaryKey: false,
        fields: fields,
        path: path,
      });
    }

    return columns;
  }

  // Merge two sets of columns to create a comprehensive schema
  private mergeMongoDBColumns(existing: any[], newColumns: any[]): any[] {
    // Create a map of existing columns by name for easy lookup
    const existingMap = new Map();
    existing.forEach((col, index) => {
      existingMap.set(col.name, index);
    });

    // Process each column in the new set
    for (const newCol of newColumns) {
      if (existingMap.has(newCol.name)) {
        // Column already exists, merge if needed
        const existingIdx = existingMap.get(newCol.name);
        const existingCol = existing[existingIdx];

        // If types are different, prefer more specific types over "null"
        if (existingCol.type === "null" && newCol.type !== "null") {
          existing[existingIdx].type = newCol.type;
        }

        // For arrays, if existing has no fields but new does, use the new fields
        if (
          existingCol.type === "array" &&
          (!existingCol.fields || existingCol.fields.length === 0) &&
          newCol.fields &&
          newCol.fields.length > 0
        ) {
          existing[existingIdx].fields = newCol.fields;
        } else if (
          existingCol.type === "array" &&
          newCol.type === "array" &&
          newCol.fields &&
          newCol.fields.length > 0
        ) {
          // If both are arrays with fields, merge the fields
          existing[existingIdx].fields = this.mergeMongoDBColumns(
            existingCol.fields || [],
            newCol.fields
          );
        }

        // For objects, merge their fields
        if (existingCol.type === "object" && newCol.type === "object") {
          existing[existingIdx].fields = this.mergeMongoDBColumns(
            existingCol.fields || [],
            newCol.fields || []
          );
        }
      } else {
        // Column doesn't exist, add it
        existing.push(newCol);
        existingMap.set(newCol.name, existing.length - 1);
      }
    }

    return existing;
  }

  private async fetchPostgresSchema(database: any): Promise<{ tables: any[] }> {
    console.log(`Fetching schema for PostgreSQL database: ${database.name}`);

    try {
      const { host, port, username, password, databaseName, ssl } = database;

      // Create PostgreSQL client
      const client = new Client({
        host,
        port: parseInt(port),
        user: username,
        password,
        database: databaseName,
        ssl: ssl ? { rejectUnauthorized: false } : false,
      });

      await client.connect();

      // Query to get all tables in the public schema
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const tablesResult = await client.query(tablesQuery);
      const tables = [];

      // Process each table
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;

        // Get columns for this table
        const columns = await this.fetchPostgresColumns(client, tableName);

        tables.push({
          name: tableName,
          columns: columns,
        });
      }

      await client.end();

      return { tables };
    } catch (error) {
      console.error("Error fetching PostgreSQL schema:", error);
      return { tables: [] };
    }
  }

  // Fetch columns for a PostgreSQL table
  private async fetchPostgresColumns(
    client: Client,
    tableName: string
  ): Promise<any[]> {
    try {
      // Query to get column information including primary key status
      const query = `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable = 'YES' as is_nullable,
          pg_constraint.contype = 'p' as is_primary_key
        FROM
          information_schema.columns c
        LEFT JOIN
          information_schema.key_column_usage kcu
          ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
        LEFT JOIN
          pg_constraint
          ON kcu.constraint_name = pg_constraint.conname
        WHERE
          c.table_name = $1
        ORDER BY
          c.ordinal_position
      `;

      const result = await client.query(query, [tableName]);
      const columns = [];

      for (const row of result.rows) {
        columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
          primaryKey: row.is_primary_key,
        });
      }

      return columns;
    } catch (error) {
      console.error(`Error fetching columns for table ${tableName}:`, error);
      return [];
    }
  }
}
