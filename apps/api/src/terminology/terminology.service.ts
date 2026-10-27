import {
  Injectable,
  Inject,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import {
  terminologyCatalogues,
  terminologyConcepts,
  withSuperAdminContext,
} from '@afyapoa/database';
import {
  CodingSystem,
  TerminologyCatalogueStatus,
  AuditEventType,
  TenantContext,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  TerminologySearchQueryDto,
  ImportCatalogueDto,
} from './dto/terminology.dto.js';
import { SEED_CATALOGUES } from './seed-data.js';

@Injectable()
export class TerminologyService implements OnModuleInit {
  private readonly logger = new Logger(TerminologyService.name);

  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultCatalogues();
  }

  /**
   * Seeds authentic Kenyan standard catalogues (WHO ICD-11, ICD-10, LOINC, Kenya EML/ATC)
   * on application initialization if they do not yet exist.
   */
  async seedDefaultCatalogues() {
    try {
      this.logger.log('Verifying standard Kenyan clinical terminology catalogues...');

      await withSuperAdminContext(async (txDb) => {
        for (const cat of SEED_CATALOGUES) {
          const [existing] = await txDb
            .select()
            .from(terminologyCatalogues)
            .where(
              and(
                eq(terminologyCatalogues.system, cat.system),
                eq(terminologyCatalogues.version, cat.version),
              ),
            )
            .limit(1);

          let catalogueId: string;

          if (!existing) {
            this.logger.log(
              `Seeding catalogue ${cat.system} v${cat.version} (${cat.name})...`,
            );
            const [inserted] = await txDb
              .insert(terminologyCatalogues)
              .values({
                system: cat.system,
                version: cat.version,
                name: cat.name,
                authority: cat.authority,
                releaseDate: cat.releaseDate,
                status: cat.status,
                conceptCount: cat.concepts.length,
              })
              .returning();
            if (!inserted) continue;
            catalogueId = inserted.id;
          } else {
            catalogueId = existing.id;
          }

          // Insert or ignore concepts
          for (const concept of cat.concepts) {
            const [existingConcept] = await txDb
              .select()
              .from(terminologyConcepts)
              .where(
                and(
                  eq(terminologyConcepts.system, cat.system),
                  eq(terminologyConcepts.code, concept.code),
                ),
              )
              .limit(1);

            if (!existingConcept) {
              await txDb.insert(terminologyConcepts).values({
                catalogueId,
                code: concept.code,
                display: concept.display,
                definition: concept.definition,
                system: cat.system,
                version: cat.version,
                effectiveStartDate: concept.effectiveStartDate,
                isActive: true,
                synonyms: concept.synonyms || [],
                parentCode: concept.parentCode,
                category: concept.category,
              });
            }
          }
        }
      });

      this.logger.log('Kenyan clinical terminology catalogues successfully verified & active.');
    } catch (error) {
      this.logger.error('Failed to seed terminology catalogues:', error);
    }
  }

  /**
   * List all imported terminology catalogues with provenance, version, and status.
   */
  async listCatalogues() {
    return await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(terminologyCatalogues)
        .orderBy(desc(terminologyCatalogues.createdAt));
    });
  }

  /**
   * Search concepts across clinical terminology systems with prefix, substring, and synonym matching.
   */
  async searchConcepts(dto: TerminologySearchQueryDto) {
    const limit = Math.max(1, Math.min(100, dto.limit || 20));

    const conditions = [eq(terminologyConcepts.isActive, true)];

    if (dto.system) {
      conditions.push(eq(terminologyConcepts.system, dto.system));
    }

    if (dto.category) {
      conditions.push(eq(terminologyConcepts.category, dto.category));
    }

    if (dto.query && dto.query.trim().length > 0) {
      const q = `%${dto.query.trim()}%`;
      conditions.push(
        or(
          ilike(terminologyConcepts.code, q),
          ilike(terminologyConcepts.display, q),
          sql`${terminologyConcepts.synonyms}::text ILIKE ${q}`,
        )!,
      );
    }

    return await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(terminologyConcepts)
        .where(and(...conditions))
        .limit(limit)
        .orderBy(terminologyConcepts.code);
    });
  }

  /**
   * Strict code validator: Checks whether the given code exists in the active catalogue.
   * Throws BadRequestException if code is invalid, unknown, or inactive.
   * Prevents invented codes or silent substitutions.
   */
  async validateConcept(system: CodingSystem, code: string) {
    if (!system || !code) {
      throw new BadRequestException('Both codingSystem and code are required for validation.');
    }

    const [concept] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(terminologyConcepts)
        .where(
          and(
            eq(terminologyConcepts.system, system),
            eq(terminologyConcepts.code, code.trim()),
            eq(terminologyConcepts.isActive, true),
          ),
        )
        .limit(1);
    });

    if (!concept) {
      throw new BadRequestException(
        `Invalid or unrecognized terminology code "${code}" for system "${system}". Must be a verified code from Kenyan authorized catalogues. Invented or unverified codes are strictly prohibited.`,
      );
    }

    return concept;
  }

  /**
   * Authorize and import an updated or new versioned terminology catalogue.
   */
  async importCatalogue(dto: ImportCatalogueDto, context: TenantContext) {
    this.logger.log(
      `Importing catalogue ${dto.system} version ${dto.version} by user ${context.userId}`,
    );

    return await withSuperAdminContext(async (txDb) => {
      const [existing] = await txDb
        .select()
        .from(terminologyCatalogues)
        .where(
          and(
            eq(terminologyCatalogues.system, dto.system),
            eq(terminologyCatalogues.version, dto.version),
          ),
        )
        .limit(1);

      let catalogueId: string;

      if (existing) {
        // Update metadata and status
        const [updated] = await txDb
          .update(terminologyCatalogues)
          .set({
            name: dto.name,
            authority: dto.authority,
            releaseDate: dto.releaseDate,
            conceptCount: dto.concepts.length,
            updatedAt: new Date(),
          })
          .where(eq(terminologyCatalogues.id, existing.id))
          .returning();
        if (!updated) {
          throw new BadRequestException('Failed to update catalogue metadata.');
        }
        catalogueId = updated.id;
      } else {
        const [inserted] = await txDb
          .insert(terminologyCatalogues)
          .values({
            system: dto.system,
            version: dto.version,
            name: dto.name,
            authority: dto.authority,
            releaseDate: dto.releaseDate,
            status: TerminologyCatalogueStatus.ACTIVE,
            conceptCount: dto.concepts.length,
          })
          .returning();
        if (!inserted) {
          throw new BadRequestException('Failed to insert new catalogue.');
        }
        catalogueId = inserted.id;
      }

      let insertedCount = 0;
      let updatedCount = 0;

      for (const item of dto.concepts) {
        const [existingItem] = await txDb
          .select()
          .from(terminologyConcepts)
          .where(
            and(
              eq(terminologyConcepts.system, dto.system),
              eq(terminologyConcepts.code, item.code),
            ),
          )
          .limit(1);

        if (existingItem) {
          await txDb
            .update(terminologyConcepts)
            .set({
              catalogueId,
              display: item.display,
              definition: item.definition,
              version: dto.version,
              effectiveStartDate: item.effectiveStartDate,
              effectiveEndDate: item.effectiveEndDate,
              synonyms: item.synonyms || [],
              parentCode: item.parentCode,
              category: item.category,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(terminologyConcepts.id, existingItem.id));
          updatedCount++;
        } else {
          await txDb.insert(terminologyConcepts).values({
            catalogueId,
            code: item.code,
            display: item.display,
            definition: item.definition,
            system: dto.system,
            version: dto.version,
            effectiveStartDate: item.effectiveStartDate,
            effectiveEndDate: item.effectiveEndDate,
            isActive: true,
            synonyms: item.synonyms || [],
            parentCode: item.parentCode,
            category: item.category,
          });
          insertedCount++;
        }
      }

      // Record audit event
      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.TERMINOLOGY_CATALOGUE_IMPORTED,
        resource: 'TerminologyCatalogue',
        resourceId: catalogueId,
        details: {
          system: dto.system,
          version: dto.version,
          name: dto.name,
          authority: dto.authority,
          insertedCount,
          updatedCount,
        },
      });

      return {
        catalogueId,
        system: dto.system,
        version: dto.version,
        insertedCount,
        updatedCount,
        totalConcepts: dto.concepts.length,
        status: 'SUCCESS',
      };
    });
  }
}
