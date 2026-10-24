import { describe, expect, test } from "bun:test";
import { detectTimetableDay, localDateKey, type TimetableText } from "./timetable-today";
const item = (text: string, x: number, y: number): TimetableText => ({ text, x, y, width: 45, height: 10 });
describe("current timetable date", () => {
  test("finds the actual dated row, not every Friday", () => {
    const data = [item("Stundenplan_2026/2027", 200, 20), item("Fr 16.10.", 35, 100), item("Do 22.10.", 35, 200), item("Fr 23.10.", 35, 240)];
    const result = detectTimetableDay(data, 595, 842, "2026-10-23");
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.y).toBe(225);
    expect(detectTimetableDay(data, 595, 842, "2026-10-24").regions).toHaveLength(0);
  });
  test("finds a date column and ignores a wrong explicit year", () => {
    const data = [item("23.10.2026", 100, 50), item("24.10.2026", 200, 50), item("25.10.2026", 300, 50)];
    expect(detectTimetableDay(data, 595, 842, "2026-10-24").regions[0]?.x).toBe(172.5);
    expect(detectTimetableDay(data, 595, 842, "2027-10-24").regions).toHaveLength(0);
  });
  test("joins separate weekday and date text and respects academic year rollover", () => {
    const data = [item("2026/2027", 200, 20), item("Mo", 10, 100), item("4.1.", 60, 100)];
    expect(detectTimetableDay(data, 595, 842, "2027-01-04").regions).toHaveLength(1);
  });
  test("local date changes at midnight", () => {
    expect(localDateKey(new Date(2026, 9, 23, 23, 59))).toBe("2026-10-23");
    expect(localDateKey(new Date(2026, 9, 24, 0, 0))).toBe("2026-10-24");
  });
});