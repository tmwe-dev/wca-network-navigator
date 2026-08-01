import { describe, it, expect } from "vitest";
import { detectSmalltalk } from "../smalltalkDetector";

describe("detectSmalltalk", () => {
  it.each([
    ["C'è qualcuno in ascolto", "presence"],
    ["c'è qualcuno?", "presence"],
    ["c'è nessuno in ascolto", "presence"],
    ["c'è nessuno", "presence"],
    ["c’è nessuno", "presence"],
    ["mi senti?", "presence"],
    ["ci sei", "presence"],
    ["prova", "presence"],
    ["ciao", "greeting"],
    ["buongiorno", "greeting"],
    ["grazie", "ack"],
    ["come stai?", "status"],
    ["arrivederci", "farewell"],
  ])("riconosce %j come %s", (input, kind) => {
    const r = detectSmalltalk(input);
    expect(r).not.toBeNull();
    expect(r?.kind).toBe(kind);
    expect((r?.reply ?? "").length).toBeGreaterThan(0);
  });

  it.each([
    "Mostrami i partner italiani senza email",
    "fai un audit completo del sistema",
    "quanti partner abbiamo a Malta",
    "scrivi una mail di presentazione ai partner tedeschi",
    "crea contatto Mario Rossi",
  ])("NON considera %j smalltalk", (input) => {
    expect(detectSmalltalk(input)).toBeNull();
  });
});