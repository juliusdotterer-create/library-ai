import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { detectTimetableDay, localDateKey, type TimetableText } from "./timetable-today";
const item = (text: string, x: number, y: number): TimetableText => ({ text, x, y, width: 45, height: 10 });
describe("current timetable date", () => {
  test("finds the actual dated row, not every Friday", () => {
    const data = [item("Stundenplan_2026/2027", 200, 20), item("Fr 16.10.", 35, 100), item("Do 22.10.", 35, 200), item("Fr 23.10.", 35, 240)];
    const result = detectTimetableDay(data, 595, 842, "2026-10-23");
    assert.equal(result.regions.length, 1);
    assert.equal(result.regions[0]?.y, 225);
    assert.equal(detectTimetableDay(data, 595, 842, "2026-10-24").regions.length, 0);
  });
  test("finds a date column and ignores a wrong explicit year", () => {
    const data = [item("23.10.2026", 100, 50), item("24.10.2026", 200, 50), item("25.10.2026", 300, 50)];
    assert.equal(detectTimetableDay(data, 595, 842, "2026-10-24").regions[0]?.x, 172.5);
    assert.equal(detectTimetableDay(data, 595, 842, "2027-10-24").regions.length, 0);
  });
  test("joins separate weekday and date text and respects academic year rollover", () => {
    const data = [item("2026/2027", 200, 20), item("Mo", 10, 100), item("4.1.", 60, 100)];
    assert.equal(detectTimetableDay(data, 595, 842, "2027-01-04").regions.length, 1);
  });
  test("local date changes at midnight", () => {
    assert.equal(localDateKey(new Date(2026, 9, 23, 23, 59)), "2026-10-23");
    assert.equal(localDateKey(new Date(2026, 9, 24, 0, 0)), "2026-10-24");
  });
});