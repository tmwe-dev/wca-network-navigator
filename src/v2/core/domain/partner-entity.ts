/**
 * Domain Entity: Partner — matches actual DB structure
 */
import type { PartnerId, UserId } from "./entities";

export interface PartnerV2 {
  readonly id: PartnerId;
  readonly companyName: string;
  readonly wcaId: number | null;
  readonly countryCode: string;
  readonly countryName: string;
  readonly city: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly memberSince: string | null;
  readonly officeType: string | null;
  readonly partnerType: string | null;
  readonly isActive: boolean;
  readonly isFavorite: boolean;
  readonly leadStatus: string;
  readonly logoUrl: string | null;
  readonly rating: number | null;
  readonly enrichmentData: Readonly<Record<string, unknown>> | null;
  readonly companyAlias: string | null;
  readonly interactionCount: number;
  readonly lastInteractionAt: string | null;
  readonly profileDescription: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly userId: UserId | null;
}
