import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import * as mongoose from 'mongoose';

export type DatabaseDocument = Database & Document;

// Column schema
export class Column {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: false })
  nullable: boolean;

  @Prop({ default: false })
  primaryKey: boolean;

  @Prop({ type: [Object], default: [] })
  fields?: Column[];

  @Prop()
  path?: string;
}

// Table schema
export class Table {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [Object], default: [] })
  columns: Column[];
}

// Schema definition
export class SchemaDefinition {
  @Prop({ type: [Object], default: [] })
  tables: Table[];
}

// Database stats
export class DatabaseStats {
  @Prop({ default: 0 })
  tableCount: number;

  @Prop({ default: 'Unknown' })
  size: string;
}

@Schema({ timestamps: true })
export class Database {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  userId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  host: string;

  @Prop()
  port: string;

  @Prop()
  username: string;

  @Prop()
  password: string;

  @Prop({ required: true })
  databaseName: string;

  @Prop({ default: false })
  ssl: boolean;

  @Prop()
  connectionURI: string;

  @Prop({ type: Object, default: null })
  schema: SchemaDefinition;

  @Prop({ type: Object, default: null })
  stats: DatabaseStats;

  @Prop({ type: Date, default: null })
  lastConnected: Date;
}

export const DatabaseSchema = SchemaFactory.createForClass(Database);
