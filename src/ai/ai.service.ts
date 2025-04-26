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

    // Build a system prompt and user prompt to find the matching table
    const systemPrompt = `You are a database schema expert. Your task is to identify which table or collection from a database schema is most relevant to a given query.
You must follow these strict guidelines:
- Return ONLY the exact name of the most relevant table/collection
- Do not include any explanations, comments, or additional text
- If no table seems relevant, return the most likely one based on context`;

    const prompt = `

Available tables/collections:
${tableNames}

Natural language query: ${naturalQuery}

Most relevant table/collection name:`;

    // Call OpenRouter API with system prompt
    const matchingTable = await this.callOpenRouter(prompt, systemPrompt);

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
    let promptData: { prompt: string; systemPrompt: string };
    if (databaseType === "mongodb") {
      promptData = this.buildMongoDBPrompt(schemaDesc, naturalQuery);
    } else if (databaseType === "postgresql") {
      promptData = this.buildPostgresPrompt(schemaDesc, naturalQuery);
    } else {
      throw new Error(`Unsupported database type: ${databaseType}`);
    }

    // Call OpenRouter API with system prompt
    let generatedQuery = await this.callOpenRouter(
      promptData.prompt,
      promptData.systemPrompt
    );

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
      prompt: promptData.prompt,
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
    const systemPrompt = `You are a database query title generator. Your task is to create concise, descriptive titles for database queries.
You must follow these strict guidelines:
- Generate titles that are maximum 50 characters long
- Titles should be descriptive of the query's purpose
- Return ONLY the title text, no additional explanations or formatting`;

    const prompt = `Generate a concise, descriptive title (maximum 50 characters) for the following database query:

${naturalQuery}

Title:`;

    return this.callOpenRouter(prompt, systemPrompt);
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

  private buildMongoDBPrompt(
    schemaDesc: string,
    naturalQuery: string
  ): { prompt: string; systemPrompt: string } {
    const systemPrompt = `You are a MongoDB query generator for NestJS applications. Your task is to convert natural language queries into valid MongoDB queries.
Guidelines for MongoDB queries:
1. Return ONLY a valid JSON array for .aggregate() or JSON object for .find(), parseable by JSON.parse()
2. First line: Comment with collection name: // Collection: collection_name
3. Second line: Comment with operation type: // Operation: find or // Operation: aggregate
4. For .find(): Return a single JSON object with filter conditions
5. For .aggregate(): Return a JSON array of pipeline stages
6. Use MongoDB operators ($match, $group, $project, $sort, etc.) correctly
7. Convert string numbers to proper numeric types using $toInt or $toDouble in $project before calculations
8. Ensure $subtract operations have exactly two arguments
9. Perform type conversions in $project before calculations or comparisons
10. Output JSON in a single line without breaks, indentation, or extra spaces
11. Exclude explanations, markdown, or any non-JSON content
12. Apply $limit: 100 if no limit specified
13. Validate schema field references to match provided schema
14. Handle date operations with $dateFromString or $dateToString when needed
15. Use $exists for null/undefined checks
16. For text searches, use $text with $search when appropriate`;

    const prompt = `Schema:
${schemaDesc}



Natural Language Query:
${naturalQuery}

MongoDB Query:`;

    return { prompt, systemPrompt };
  }

  private buildPostgresPrompt(
    schemaDesc: string,
    naturalQuery: string
  ): { prompt: string; systemPrompt: string } {
    const systemPrompt = `You are a PostgreSQL query generator. Your task is to convert natural language queries into valid PostgreSQL queries.
For PostgreSQL queries, follow these rules:
1. Use standard SQL syntax compatible with PostgreSQL
2. Include proper table aliases when joining tables
3. Use appropriate WHERE clauses for filtering
4. Use GROUP BY, HAVING, ORDER BY as needed
5. Limit results to a reasonable number (e.g., LIMIT 100) if not specified
6. Use proper SQL functions for calculations
7. Do not include any comments or explanations in the output
8. Do not include markdown formatting (no \`\`\`sql tags)
9. Return only the raw SQL query text
`;

    const prompt = `Schema:
${schemaDesc}


Natural Language Query: ${naturalQuery}

SQL Query:`;

    return { prompt, systemPrompt };
  }

  private async callOpenRouter(
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const messages: OpenRouterChatMessage[] = [];

      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      const request: OpenRouterRequest = {
        model: config.openRouter.model,
        messages: messages,
      };

      const startTime = Date.now();

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

      const endTime = Date.now();
      this.logger.debug(
        `OpenRouter API call completed in ${endTime - startTime}ms`
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
