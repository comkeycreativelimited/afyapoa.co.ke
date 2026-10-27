import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  LoginDto,
  MfaVerifyDto,
  RefreshTokenDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  SwitchFacilityDto,
} from './dto/auth.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentTenantContext } from './decorators/auth.decorators.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { TenantContext } from '@afyapoa/domain-core';
import { Request } from 'express';

@ApiTags('Authentication & IAM')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user credentials with password and MFA check' })
  @ApiResponse({ status: 200, description: 'Authentication successful or MFA required' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return await this.authService.login(
      dto.username,
      dto.password,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP MFA code and issue session tokens' })
  @ApiResponse({ status: 200, description: 'MFA verified and tokens issued' })
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return await this.authService.verifyMfa(
      dto.mfaToken,
      dto.code,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh access token with active session token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return await this.authService.refreshSession(
      dto.refreshToken,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Terminate active session and revoke refresh tokens' })
  @ApiResponse({ status: 200, description: 'Session terminated' })
  async logout(@CurrentTenantContext() ctx: TenantContext, @Req() req: any) {
    const sessionId = ctx.sessionId || req.user?.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('No active session associated with token');
    }
    return await this.authService.logout(
      sessionId,
      ctx.userId,
      ctx.tenantId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request self-service password reset token' })
  @ApiResponse({ status: 200, description: 'Reset dispatch confirmation' })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    return await this.authService.requestPasswordReset(
      dto.email,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset and set new password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: Request) {
    return await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Retrieve verified tenant and user identity context' })
  @ApiResponse({ status: 200, description: 'Verified TenantContext' })
  async getMe(@CurrentTenantContext() ctx: TenantContext) {
    return {
      authenticated: true,
      tenantContext: ctx,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-facility')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Switch active facility under the current tenant organization' })
  @ApiResponse({ status: 200, description: 'New token scoped to target facility' })
  async switchFacility(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: SwitchFacilityDto,
  ) {
    return await this.authService.switchFacility(
      ctx.userId,
      ctx.tenantId,
      dto.facilityKmflCode,
    );
  }
}
