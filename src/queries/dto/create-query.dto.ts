import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQueryDto {
  @IsMongoId()
  @IsNotEmpty()
  databaseId: string;

  @IsString()
  @IsNotEmpty()
  query: string;

  @IsString()
  @IsOptional()
  name?: string;
}
