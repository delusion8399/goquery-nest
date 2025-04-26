import { Injectable, Logger } from "@nestjs/common";
import { EnvoyService } from "src/envoy/envoy.service";
import config from "src/configuration";

interface OpenRouterChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterChatMessage[];
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly envoyService: EnvoyService) {}

  /**
   * Find the closest matching table/collection in the schema for a natural language query
   * This helps optimize token usage by only including relevant schema information
   */
  async findMatchingSchemaTable(
    _databaseType: string,
    schema: any,
    naturalQuery: string
  ): Promise<string> {
    this.logger.debug(
      `Finding matching schema table for query: ${naturalQuery}`
    );
    const startTime = Date.now();

    if (!schema || !schema.tables || schema.tables.length === 0) {
      this.logger.warn("No schema tables available for matching");
      return "";
    }

    // Build a list of table names only
    let tableNames = "";
    for (const table of schema.tables) {
      tableNames += `- ${table.name}\n`;
    }

    // Build a prompt to find the matching table
    const prompt = `You are a database expert. Given a natural language query and a list of table/collection names,
identify which table or collection is most likely being referenced in the query.
Return ONLY the name of the table/collection, nothing else.

Available tables/collections:
${tableNames}

Natural language query: ${naturalQuery}

Most relevant table/collection name:`;

    // Call OpenRouter API
    const matchingTable = await this.callOpenRouter(prompt);

    const endTime = Date.now();
    this.logger.debug(
      `Schema matching completed in ${endTime - startTime}ms. Matched table: ${matchingTable}`
    );

    return matchingTable.trim();
  }

  /**
   * Generate a database query based on the natural language query
   * Uses a two-step approach to optimize token usage:
   * 1. First find the matching table
   * 2. Then generate the query using only the relevant schema information
   */
  async generateDatabaseQuery(
    databaseType: string,
    schema: any,
    naturalQuery: string
  ): Promise<{ query: string; prompt: string }> {
    this.logger.debug(`Generating ${databaseType} query for: ${naturalQuery}`);
    const startTime = Date.now();

    // Step 1: Find the matching table to optimize token usage
    let matchingTable = "";
    try {
      matchingTable = await this.findMatchingSchemaTable(
        databaseType,
        schema,
        naturalQuery
      );
    } catch (error) {
      this.logger.error(`Error finding matching table: ${error.message}`);
      // Continue with full schema if matching fails
    }

    // Step 2: Build schema description (either focused or full)
    let schemaDesc = "";
    if (schema && schema.tables) {
      if (matchingTable && schema.tables.length > 1) {
        // If we found a matching table and have multiple tables, only include the matching one
        const matchingTableObj = schema.tables.find(
          (t: any) => t.name === matchingTable
        );

        if (matchingTableObj) {
          schemaDesc += `Table/Collection: ${matchingTableObj.name}\nColumns/Fields:\n`;
          for (const column of matchingTableObj.columns) {
            schemaDesc += `- ${column.name} (${column.type})${column.primaryKey ? " (PRIMARY KEY)" : ""}${column.nullable ? " (NULLABLE)" : ""}\n`;

            // Include nested fields for MongoDB
            if (column.fields && column.fields.length > 0) {
              schemaDesc = this.addNestedFields(schemaDesc, column.fields, 1);
            }
          }
          schemaDesc += "\n";
        } else {
          // If matching table not found in schema, fall back to full schema
          this.logger.warn(
            `Matching table "${matchingTable}" not found in schema, using full schema`
          );
          schemaDesc = this.buildFullSchemaDescription(schema, schemaDesc);
        }
      } else {
        // Use full schema if no matching table or only one table
        schemaDesc = this.buildFullSchemaDescription(schema, schemaDesc);
      }
    }

    // Build prompt based on database type
    let prompt = "";
    if (databaseType === "mongodb") {
      prompt = this.buildMongoDBPrompt(schemaDesc, naturalQuery);
    } else if (databaseType === "postgresql") {
      prompt = this.buildPostgresPrompt(schemaDesc, naturalQuery);
    } else {
      throw new Error(`Unsupported database type: ${databaseType}`);
    }

    // Call OpenRouter API
    let generatedQuery = await this.callOpenRouter(prompt);

    // For MongoDB queries, ensure the JSON part is properly formatted
    if (databaseType === "mongodb") {
      // Extract the JSON part (after the comments)
      const lines = generatedQuery.split("\n");
      let commentLines = [];
      let jsonPart = "";

      for (const line of lines) {
        if (line.startsWith("//")) {
          commentLines.push(line);
        } else if (line.trim()) {
          jsonPart += line;
        }
      }

      // If we have JSON content, try to format it properly
      if (jsonPart) {
        try {
          // Parse and re-stringify to ensure valid JSON format
          const parsedJson = JSON.parse(jsonPart);
          const formattedJson = JSON.stringify(parsedJson);

          // Reconstruct the query with comments and formatted JSON
          generatedQuery = commentLines.join("\n") + "\n" + formattedJson;
        } catch (error) {
          this.logger.warn(
            `Could not parse generated MongoDB query JSON: ${error.message}`
          );
          // Keep the original if parsing fails
        }
      }
    }

    const endTime = Date.now();
    this.logger.debug(`Query generation completed in ${endTime - startTime}ms`);

    // Return both the generated query and the prompt used
    return {
      query: generatedQuery,
      prompt: prompt,
    };
  }

  /**
   * Helper method to build the full schema description
   */
  private buildFullSchemaDescription(schema: any, schemaDesc: string): string {
    let result = schemaDesc;
    for (const table of schema.tables) {
      result += `Table/Collection: ${table.name}\nColumns/Fields:\n`;
      for (const column of table.columns) {
        result += `- ${column.name} (${column.type})${column.primaryKey ? " (PRIMARY KEY)" : ""}${column.nullable ? " (NULLABLE)" : ""}\n`;

        // Include nested fields for MongoDB
        if (column.fields && column.fields.length > 0) {
          result = this.addNestedFields(result, column.fields, 1);
        }
      }
      result += "\n";
    }
    return result;
  }

  async generateQueryTitle(naturalQuery: string): Promise<string> {
    const prompt = `Generate a concise, descriptive title (maximum 50 characters) for the following database query:\n\n${naturalQuery}\n\nTitle:`;

    return this.callOpenRouter(prompt);
  }

  private addNestedFields(
    schemaDesc: string,
    fields: any[],
    level: number
  ): string {
    let result = schemaDesc;
    const indent = "  ".repeat(level);

    for (const field of fields) {
      result += `${indent}- ${field.name} (${field.type})\n`;

      if (field.fields && field.fields.length > 0) {
        result = this.addNestedFields(result, field.fields, level + 1);
      }
    }

    return result;
  }

  private buildMongoDBPrompt(schemaDesc: string, naturalQuery: string): string {
    return `You are a MongoDB query generator for NestJS applications. Generate a MongoDB query based on the following schema and natural language query.

Schema:
${schemaDesc}

For MongoDB queries, follow these rules:
1. Return ONLY a valid JSON array containing the MongoDB pipeline stages that can be directly passed to .aggregate() or a JSON object for .find()
2. First line should be a comment specifying the collection name: // Collection: collection_name
3. Second line should be a comment specifying the operation type: // Operation: find or // Operation: aggregate
4. For find operations, return a single JSON object representing the filter
5. For aggregate operations, return a JSON array of pipeline stages
6. Use proper MongoDB operators like $match, $group, $project, $sort, etc.
7. For numeric operations, ensure values are properly parsed to numbers (use $toInt, $toDouble as needed)
8. When using $subtract, always provide exactly 2 arguments
9. When performing calculations, first use $project to convert string fields to numbers if needed
10. Do not include any explanations, only the JSON pipeline/filter
11. Ensure the output is valid JSON that can be parsed with JSON.parse()
12. Limit results to 100 if not otherwise specified
13. IMPORTANT: Output the JSON as a single line without any line breaks, indentation, or extra spaces
14. Do not use any markdown formatting

Natural Language Query: ${naturalQuery}

MongoDB Query:`;
  }

  private buildPostgresPrompt(
    schemaDesc: string,
    naturalQuery: string
  ): string {
    return `You are a PostgreSQL query generator. Generate a SQL query based on the following schema and natural language query.

Schema:
${schemaDesc}

For PostgreSQL queries, follow these rules:
1. Use standard SQL syntax compatible with PostgreSQL
2. Include proper table aliases when joining tables
3. Use appropriate WHERE clauses for filtering
4. Use GROUP BY, HAVING, ORDER BY as needed
5. Limit results to a reasonable number (e.g., LIMIT 100) if not specified
6. Use proper SQL functions for calculations
7. Do not include any comments or explanations in the output

Natural Language Query: ${naturalQuery}

SQL Query:`;
  }

  private async callOpenRouter(prompt: string): Promise<string> {
    try {
      const request: OpenRouterRequest = {
        model: config.openRouter.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      };

      const response = await this.envoyService.fetch(
        config.openRouter.baseUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.openRouter.apiKey}`,
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenRouter API error: ${response.status} ${errorText}`
        );
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenRouterResponse;

      return data.choices[0].message.content.trim();
    } catch (error) {
      this.logger.error(`Error calling OpenRouter API: ${error.message}`);
      throw error;
    }
  }
}
