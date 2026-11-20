// Bottega's "open now" status around public holidays: the next opening skips
// them, and Easter Monday moves every year.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const bundled = await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "src/templates/bottega/status.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { statusAt, easterSunday, isHoliday } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`
);

const week = ["mo", "tu", "we", "th", "fr", "sa"];
const hours = [
  { days: week, opens: "09:00", closes: "13:00" },
  { days: week, opens: "15:00", closes: "19:30" },
];
const labels = {
  statusOpen: "Aperto ora · chiude alle {time}",
  statusOpensLater: "Chiuso ora · apre alle {time}",
  statusReopens: "Chiuso ora · riapre {day} alle {time}",
  statusClosedToday: "Oggi chiuso · riapre {day} alle {time}",
  tomorrow: "domani",
};
/** Minutes since the epoch for a wall-clock time in Rome (UTC+1 in winter, +2 in summer). */
const rome = (iso, offset) => Date.parse(`${iso}:00${offset}`) / 60000;
const status = (minute) =>
  statusAt(minute, hours, "Europe/Rome", "it", "IT", labels);

test("Easter Sunday follows the Gregorian computus", () => {
  assert.deepEqual(easterSunday(2024), { month: 3, day: 31 });
  assert.deepEqual(easterSunday(2025), { month: 4, day: 20 });
  assert.deepEqual(easterSunday(2026), { month: 4, day: 5 });
  assert.deepEqual(easterSunday(2027), { month: 3, day: 28 });
  assert.equal(isHoliday("IT", 2027, 3, 29), true, "Easter Monday 2027");
  assert.equal(isHoliday("IT", 2027, 3, 30), false);
  assert.equal(
    isHoliday(undefined, 2026, 12, 25),
    false,
    "no country, no holidays",
  );
});

test("an ordinary evening points to the next opening", () => {
  assert.deepEqual(status(rome("2026-11-20T10:00", "+01:00")), {
    open: true,
    text: "Aperto ora · chiude alle 13:00",
  });
  assert.equal(
    status(rome("2026-11-20T20:00", "+01:00")).text,
    "Chiuso ora · riapre domani alle 09:00",
  );
  assert.equal(
    status(rome("2026-11-21T20:00", "+01:00")).text,
    "Chiuso ora · riapre lunedì alle 09:00",
  );
});

test("the evening before a holiday skips it", () => {
  // Thursday 24 December: 25 and 26 are holidays, 27 is a Sunday.
  assert.equal(
    status(rome("2026-12-24T20:00", "+01:00")).text,
    "Chiuso ora · riapre lunedì alle 09:00",
  );
  // Saturday before Easter: Sunday closed, Easter Monday a holiday.
  assert.equal(
    status(rome("2027-03-27T20:00", "+01:00")).text,
    "Chiuso ora · riapre martedì alle 09:00",
  );
});

test("a holiday shows no status", () => {
  assert.equal(status(rome("2026-12-25T10:00", "+01:00")), null);
  assert.equal(
    status(rome("2027-03-29T10:30", "+02:00")),
    null,
    "Easter Monday",
  );
});
