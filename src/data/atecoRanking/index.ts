export type { AtecoRank } from "./types";
export { calcScore } from "./types";
import type { AtecoRank } from "./types";
import { ATECO_RANKING_1 } from "./ranking1";
import { ATECO_RANKING_2 } from "./ranking2";
import { ATECO_RANKING_3 } from "./ranking3";

export const ATECO_RANKING: Record<string, AtecoRank> = {
  ...ATECO_RANKING_1,
  ...ATECO_RANKING_2,
  ...ATECO_RANKING_3,
};
