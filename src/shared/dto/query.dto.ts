import { IsString, IsISO8601 } from "class-validator";

export class NumberRange {
  @IsString()
  from: number;

  @IsString()
  to: number;
}

export class DateRange {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;
}
