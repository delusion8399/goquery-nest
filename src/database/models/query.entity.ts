import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import * as mongoose from "mongoose";

export type QueryDocument = Query & Document;

export enum QueryStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export type QueryResult = Record<string, any>;

@Schema({ timestamps: true })
export class Query {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  userId: mongoose.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "Database",
  })
  databaseId: mongoose.Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ required: true })
  naturalQuery: string;

  @Prop()
  generatedSQL: string;

  @Prop()
  prompt: string;

  @Prop({
    type: String,
    enum: Object.values(QueryStatus),
    default: QueryStatus.PENDING,
  })
  status: QueryStatus;

  @Prop({ type: [Object], default: [] })
  results: QueryResult[];

  @Prop()
  error: string;

  @Prop()
  executionTime: string;
}

export const QuerySchema = SchemaFactory.createForClass(Query);
