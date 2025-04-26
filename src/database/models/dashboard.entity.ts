import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import * as mongoose from 'mongoose';

export type DashboardDocument = Dashboard & Document;

export enum CardType {
  QUERY = 'query',
  CHART = 'chart',
}

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  TABLE = 'table',
}

export class CardPosition {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  w: number;

  @Prop({ required: true })
  h: number;
}

@Schema({ timestamps: true })
export class DashboardCard {
  @Prop({ type: MongooseSchema.Types.ObjectId, auto: true })
  _id: mongoose.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ 
    type: String, 
    enum: Object.values(CardType), 
    default: CardType.QUERY 
  })
  type: CardType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Query' })
  queryId: mongoose.Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: Object.values(ChartType)
  })
  chartType: ChartType;

  @Prop({ type: Object, required: true })
  position: CardPosition;
}

const DashboardCardSchema = SchemaFactory.createForClass(DashboardCard);

@Schema({ timestamps: true })
export class Dashboard {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  userId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: [DashboardCardSchema], default: [] })
  cards: DashboardCard[];

  @Prop({ default: false })
  isDefault: boolean;
}

export const DashboardSchema = SchemaFactory.createForClass(Dashboard);
