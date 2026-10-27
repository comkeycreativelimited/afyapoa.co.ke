import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReconcilePatientDto {
  @ApiProperty({ description: 'Target survivor patient UUID that will remain active' })
  @IsString()
  @IsNotEmpty()
  targetPatientId!: string;

  @ApiProperty({ description: 'Source duplicate patient UUID that will be merged and deprecated' })
  @IsString()
  @IsNotEmpty()
  sourcePatientId!: string;

  @ApiProperty({ description: 'Clinical or administrative justification for the merge' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Optional ID of the reconciliation candidate record' })
  @IsString()
  @IsOptional()
  reconciliationId?: string;
}
