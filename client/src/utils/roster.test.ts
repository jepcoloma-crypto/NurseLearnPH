import { describe, it, expect } from "vitest";
import { parseRosterCsv, buildRosterTemplate } from "./roster";

describe("parseRosterCsv", () => {
  it("parses one email per line", () => {
    expect(parseRosterCsv("a@x.com\nb@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("handles CRLF line endings and blank lines", () => {
    expect(parseRosterCsv("a@x.com\r\n\r\nb@x.com\r\n")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("skips a header row", () => {
    expect(parseRosterCsv("email,section\na@x.com,S1")).toEqual(["a@x.com"]);
    expect(parseRosterCsv("Username\njuan")).toEqual(["juan"]);
    expect(parseRosterCsv("Student Number\n2026-0001")).toEqual(["2026-0001"]);
  });

  it("uses the first column of multi-column rows", () => {
    expect(parseRosterCsv("a@x.com,Juan,Dela Cruz\nb@x.com,Jane,Doe")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("handles quoted cells with commas", () => {
    expect(parseRosterCsv('"Dela Cruz, Juan",a@x.com')).toEqual(["Dela Cruz, Juan"]);
  });

  it("de-duplicates case-insensitively, preserving order", () => {
    expect(parseRosterCsv("A@x.com\na@x.com\nB@x.com")).toEqual(["A@x.com", "B@x.com"]);
  });

  it("ignores rows whose first cell is empty", () => {
    expect(parseRosterCsv(",x@y.com\na@x.com")).toEqual(["a@x.com"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseRosterCsv("")).toEqual([]);
    expect(parseRosterCsv("  \n  ")).toEqual([]);
  });

  it("template has an email header and parses down to its example row", () => {
    const template = buildRosterTemplate();
    expect(template.split(/\r?\n/)[0]).toBe("email");
    expect(parseRosterCsv(template)).toEqual(["juan.dela.cruz@example.com"]);
  });
});
