import { describe, it, expect } from "vitest";
import { pickDefaultEmailTypeId, pickDefaultEmailType } from "@/data/pickDefaultEmailType";
describe("DAL — pickDefaultEmailType", () => {
  it("returns primo_contatto by default", () => expect(pickDefaultEmailTypeId()).toBe("primo_contatto"));
  it("returns contesto_email on reply", () => expect(pickDefaultEmailTypeId({ isReply: true })).toBe("contesto_email"));
  it("returns email type object", () => {
    expect(pickDefaultEmailType()).toBeTruthy();
    expect(pickDefaultEmailType({ isReply: true })).toBeTruthy();
  });
});
