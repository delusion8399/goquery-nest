import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDatabaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  port?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  databaseName: string;

  @IsBoolean()
  @IsOptional()
  ssl?: boolean;

  @IsString()
  @IsOptional()
  connectionURI?: string;
}
