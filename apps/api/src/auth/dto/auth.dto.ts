import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dr.otieno', description: 'Username or email' })
  username!: string;

  @ApiProperty({ example: 'Password123!', description: 'Account password' })
  password!: string;
}

export class MfaVerifyDto {
  @ApiProperty({ description: 'MFA challenge token received during initial login' })
  mfaToken!: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP authentication code' })
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token to renew session' })
  refreshToken!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'dr.otieno@nmhg.demo.afyapoa.co.ke', description: 'Registered user email' })
  email!: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty({ description: 'Password reset token from email/SMS' })
  token!: string;

  @ApiProperty({ example: 'NewSecurePassword123!', description: 'New password meeting complexity requirements' })
  newPassword!: string;
}

export class SwitchFacilityDto {
  @ApiProperty({ example: 'FID-01-000102-2', description: 'Target facility KMFL code under same tenant' })
  facilityKmflCode!: string;
}
