import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createIntegrationClients } from '@afyapoa/integration-adapters';
import { config } from '@afyapoa/config';

@ApiTags('National Integrations (DHA / SHA / eTIMS)')
@Controller('integrations')
export class IntegrationsController {
  private readonly clients = createIntegrationClients(config.INTEGRATION_MODE);

  @Get('status')
  @ApiOperation({ summary: 'Check status of national integration adapters' })
  getStatus() {
    return {
      activeMode: config.INTEGRATION_MODE,
      dhaHieBaseUrl: config.DHA_HIE_BASE_URL,
      shaClaimsBaseUrl: config.SHA_CLAIMS_BASE_URL,
      kraEtimsBaseUrl: config.KRA_ETIMS_BASE_URL,
      isMock: config.INTEGRATION_MODE === 'MOCK',
    };
  }

  @Get('dha/client-lookup')
  @ApiOperation({ summary: 'Test DHA Client Registry lookup' })
  async testDhaLookup(@Query('nationalId') nationalId: string = '12345678') {
    const res = await this.clients.dhaHie.lookupClientByNationalId(nationalId);
    if (res.isSuccess()) {
      return res.getValue();
    }
    throw res.getError();
  }

  @Get('sha/eligibility-check')
  @ApiOperation({ summary: 'Test SHA eligibility check' })
  async testShaEligibility(
    @Query('identificationNumber') identificationNumber: string = '12345678',
    @Query('identificationType') identificationType: string = 'KENYA_NATIONAL_ID',
    @Query('facilityCode') facilityCode: string = config.SHA_FACILITY_CODE,
  ) {
    const res = await this.clients.shaEligibility.checkEligibility(
      identificationType,
      identificationNumber,
      facilityCode,
    );
    if (res.isSuccess()) {
      return res.getValue();
    }
    throw res.getError();
  }
}
