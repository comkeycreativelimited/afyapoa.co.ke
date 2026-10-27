import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShiftType,
} from '@afyapoa/domain-core';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Department code', example: 'DEPT-SURG' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Department name', example: 'Department of General Surgery' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Head of Department User UUID' })
  @IsUUID()
  @IsOptional()
  headOfDepartmentId?: string;
}

export class CreateStaffRosterDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Department UUID' })
  @IsUUID()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ description: 'Roster month in YYYY-MM format', example: '2026-11' })
  @IsString()
  @IsNotEmpty()
  rosterMonth!: string;
}

export class AssignShiftDto {
  @ApiProperty({ description: 'Staff User UUID' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Shift date in YYYY-MM-DD format', example: '2026-11-01' })
  @IsString()
  @IsNotEmpty()
  shiftDate!: string;

  @ApiProperty({ enum: ShiftType, default: ShiftType.MORNING })
  @IsEnum(ShiftType)
  @IsNotEmpty()
  shiftType!: ShiftType;

  @ApiPropertyOptional({ description: 'Assigned Ward UUID if ward duty' })
  @IsUUID()
  @IsOptional()
  assignedWardId?: string;

  @ApiPropertyOptional({ description: 'Clinical handover notes / specific tasking' })
  @IsString()
  @IsOptional()
  handoverNotes?: string;
}
