import React, { useState, useMemo } from "react";
import {
  Calendar, BarChart3, Settings, Plus, Check, X, Trash2,
  ChevronLeft, ChevronRight, Coffee, Download, Upload, Pencil, Loader2
} from "lucide-react";
import { loadJSON, saveJSON } from "./storage.js";

/* ---------------------------------- Konstanten ---------------------------------- */

const DEFAULT_PERIODS = [
  { nr: 1, start: "08:00", end: "08:45" },
  { nr: 2, start: "08:50", end: "09:35" },
  { nr: 3, start: "09:55", end: "10:40" },
  { nr: 4, start: "10:45", end: "11:30" },
  { nr: 5, start: "11:35", end: "12:20" },
  { nr: 6, start: "12:25", end: "13:10" },
  { nr: 7, start: "13:15", end: "14:00" },
  { nr: 8, start: "14:05", end: "14:50" },
];

const DEFAULT_ACTIVITIES = [
  "Unterricht", "Vertretungsunterricht", "Unterrichtsvorbereitung", "Unterrichtsnachbereitung",
  "Korrektur", "Elterngespräch", "Gespräch mit Schüler:in", "Gespräch mit Kolleg:in",
  "Konferenz", "Dienstbesprechung", "Pausenaufsicht", "Klassenleitung",
  "Organisation / Verwaltung", "Fortbildung", "Schulveranstaltung", "Klassenfahrt",
  "Projektarbeit", "Eigene Pause", "Sonstiges",
];

const BUNDESLAENDER = [
  { code: "BW", name: "Baden-Württemberg" }, { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" }, { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" }, { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" }, { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" }, { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" }, { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" }, { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" }, { code: "TH", name: "Thüringen" },
];

const NONWORK = new Set(["Eigene Pause", "Ausgefallen"]);
const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Arbeitszeitmodell: Vollzeit-Referenz orientiert sich am niedersächsischen Referenzmodell
// (46:38 h/Woche), ist aber bewusst konfigurierbar und kein gesetzlich verbindlicher Wert.
const DEFAULT_EMPLOYMENT = {
  percentage: 100,
  fullTimeWeeklyReferenceMinutes: 46 * 60 + 38, // 46:38 h
  individualWeeklyTargetMinutes: null, // wenn gesetzt, überschreibt dies percentage-basierte Berechnung
};
const DEFAULT_CONFIG = { periods: DEFAULT_PERIODS, activities: DEFAULT_ACTIVITIES, employment: DEFAULT_EMPLOYMENT };

const DAY_STATUS_LABELS = { WORK: "Arbeit", SICK: "Krank", VACATION: "Urlaub" };

/* ---------------------------------- Helfer ---------------------------------- */

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISODate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const wdIndex = (d) => (d.getDay() + 6) % 7; // 0=Mo .. 6=So
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fromMin = (min) => `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
const addMin = (hhmm, delta) => fromMin(Math.max(0, toMin(hhmm) + delta));
const fmtDur = (min) => {
  const rounded = Math.round(min);
  if (rounded <= 0) return "0 Min";
  const h = Math.floor(rounded / 60), m = rounded % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
};
const fmtDateLong = (d) => d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const fmtDateShort = (d) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isWorkEntry = (e) => !NONWORK.has(e.activity);
const durationOf = (e) => Math.max(0, toMin(e.end) - toMin(e.start));
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeek = (d) => addDays(d, -wdIndex(d));
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const findTemplateFor = (templates, date) => {
  const key = toISODate(date);
  return templates.find((t) => key >= t.from && key <= t.to) || null;
};
const findHolidayFor = (holidays, date) => {
  const key = toISODate(date);
  return holidays.find((h) => key >= h.start && key <= h.end) || null;
};

/* ---------- Soll-Arbeitszeit (Arbeitszeitmodell) ---------- */

// Effektives Wochensoll: individuelle Angabe hat Vorrang vor der prozentualen Berechnung.
const effectiveWeeklyTargetMinutes = (employment) => {
  if (employment.individualWeeklyTargetMinutes != null) return employment.individualWeeklyTargetMinutes;
  return Math.round(employment.fullTimeWeeklyReferenceMinutes * (employment.percentage / 100));
};

// Anzahl geplanter Stunden je Wochentag (Mo–Fr) aus der für das Datum aktiven Stundenplan-Vorlage.
const weekdayPeriodCounts = (templates, date) => {
  const template = findTemplateFor(templates, date);
  if (!template) return null;
  const counts = [0, 0, 0, 0, 0];
  for (let wd = 0; wd < 5; wd++) counts[wd] = Object.keys(template.days[wd] || {}).length;
  return counts;
};

// Tages-Soll: Wochensoll gewichtet nach Anteil der geplanten Stunden an diesem Wochentag.
// Ohne aktive Vorlage (oder ohne geplante Stunden darin) wird gleichmäßig auf 5 Werktage verteilt.
// Am Wochenende ist das Soll 0.
const dailyTargetMinutes = (templates, employment, date) => {
  const wd = wdIndex(date);
  if (wd >= 5) return 0;
  const weeklyTarget = effectiveWeeklyTargetMinutes(employment);
  const counts = weekdayPeriodCounts(templates, date);
  if (!counts) return weeklyTarget / 5;
  const totalWeek = counts.reduce((a, b) => a + b, 0);
  if (totalWeek === 0) return weeklyTarget / 5;
  return weeklyTarget * (counts[wd] / totalWeek);
};

// Anteil eines Tages (0–1), der durch einen Abwesenheitsstatus (Krank/Urlaub) abgedeckt ist.
// Ohne `from`/`to` gilt der ganze Tag als abgedeckt. Mit `from` ("ab Uhrzeit bis Tagesende") bzw.
// `to` ("von Tagesbeginn bis Uhrzeit") wird der Anteil relativ zum Schulstunden-Zeitfenster
// (erste bis letzte konfigurierte Schulstunde) berechnet.
const dayAbsenceFraction = (config, statusEntry) => {
  if (!statusEntry) return 0;
  if (!statusEntry.from && !statusEntry.to) return 1;
  const sorted = [...config.periods].sort((a, b) => a.nr - b.nr);
  if (!sorted.length) return 1;
  const winStart = toMin(sorted[0].start);
  const winEnd = toMin(sorted[sorted.length - 1].end);
  const windowLen = winEnd - winStart;
  if (windowLen <= 0) return 1;
  const from = statusEntry.from ? Math.max(winStart, toMin(statusEntry.from)) : winStart;
  const to = statusEntry.to ? Math.min(winEnd, toMin(statusEntry.to)) : winEnd;
  return Math.max(0, to - from) / windowLen;
};

/* ---------------------------------- Kleinbausteine ---------------------------------- */

function IconBtn({ onClick, children, title, tone = "default" }) {
  const tones = {
    default: "text-stone-500 hover:text-stone-800 hover:bg-stone-200",
    danger: "text-rose-700 hover:bg-rose-100",
    good: "text-emerald-700 hover:bg-emerald-100",
    warn: "text-amber-700 hover:bg-amber-100",
  };
  return (
    <button type="button" onClick={onClick} title={title} className={`p-1.5 shrink-0 ${tones[tone]}`}>
      {children}
    </button>
  );
}

function EntryForm({ initial, activities, onSave, onCancel, onDelete }) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [activity, setActivity] = useState(initial.activity);
  const [note, setNote] = useState(initial.note || "");
  const valid = toMin(end) > toMin(start);

  return (
    <div className="bg-stone-50 border border-stone-300 p-3 space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-stone-500">
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums text-stone-800" />
        </label>
        <label className="flex-1 text-xs text-stone-500">
          Ende
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums text-stone-800" />
        </label>
      </div>
      {!valid && <p className="text-xs text-rose-700">Ende muss nach dem Start liegen.</p>}
      <label className="block text-xs text-stone-500">
        Tätigkeit
        <select value={activity} onChange={(e) => setActivity(e.target.value)}
          className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800">
          {activities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="block text-xs text-stone-500">
        Bemerkung (optional)
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Hof, Klasse 8a …"
          className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800" />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" disabled={!valid}
          onClick={() => onSave({ start, end, activity, note: note.trim() })}
          className="flex-1 bg-emerald-800 disabled:bg-stone-300 disabled:text-stone-500 text-stone-50 text-sm py-2 flex items-center justify-center gap-1.5">
          <Check size={15} /> Speichern
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 border border-stone-300 text-sm text-stone-600">
          Abbrechen
        </button>
        {onDelete && <IconBtn onClick={onDelete} title="Löschen" tone="danger"><Trash2 size={17} /></IconBtn>}
      </div>
    </div>
  );
}

/* ---------------------------------- Tagesansicht ---------------------------------- */

function TagView({ date, setDate, entries, setDayEntries, config, templates, holidays, dayStatus, setDayStatus }) {
  const dateKey = toISODate(date);
  const wd = wdIndex(date);
  const isWeekend = wd >= 5;
  const holiday = findHolidayFor(holidays, date);
  const statusEntry = dayStatus[dateKey] || null;
  const status = statusEntry?.status || "WORK";
  const statusFrom = statusEntry?.from || null;
  const statusTo = statusEntry?.to || null;
  const partialMode = statusFrom ? "FROM" : statusTo ? "TO" : "FULL";
  const isFullDayAbsence = status !== "WORK" && partialMode === "FULL";
  const activeTemplate = findTemplateFor(templates, date);
  const dayTemplate = (!isWeekend && activeTemplate) ? (activeTemplate.days[wd] || {}) : {};
  const showGrid = !isWeekend && !holiday && !isFullDayAbsence;

  const dayList = entries[dateKey] || [];
  const [editKey, setEditKey] = useState(null);

  const periodEntries = {};
  const slotEntries = {};
  const freeEntries = [];
  dayList.forEach((e) => {
    if (e.periodNr != null) periodEntries[e.periodNr] = e;
    else if (e.slot) slotEntries[e.slot] = e;
    else freeEntries.push(e);
  });
  freeEntries.sort((a, b) => toMin(a.start) - toMin(b.start));

  const commit = (nextList) => setDayEntries(dateKey, nextList);
  const upsert = (entry) => {
    const rest = dayList.filter((e) => e.id !== entry.id);
    commit([...rest, entry]);
    setEditKey(null);
  };
  const remove = (id) => { commit(dayList.filter((e) => e.id !== id)); setEditKey(null); };

  const periods = [...config.periods].sort((a, b) => a.nr - b.nr);

  // Zeitfenster, das bei "ab Uhrzeit" / "bis Uhrzeit" durch Krankheit/Urlaub abgedeckt ist.
  const absenceInterval = (status !== "WORK" && !isFullDayAbsence && periods.length)
    ? (statusFrom
        ? [toMin(statusFrom), toMin(periods[periods.length - 1].end)]
        : [toMin(periods[0].start), toMin(statusTo)])
    : null;
  const isCoveredByAbsence = (startHHMM, endHHMM) => {
    if (!absenceInterval) return false;
    const s = toMin(startHHMM), e = toMin(endHHMM);
    return s < absenceInterval[1] && e > absenceInterval[0];
  };

  const setStatus = (patch) => setDayStatus(dateKey, patch === null ? null : { status, ...patch });

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-950 text-stone-100">
        <IconBtn onClick={() => setDate(addDays(date, -1))} title="Vorheriger Tag">
          <ChevronLeft size={20} className="text-stone-200" />
        </IconBtn>
        <div className="text-center">
          <div className="font-serif text-base leading-tight">{fmtDateLong(date)}</div>
          {holiday ? (
            <div className="text-xs text-amber-300 mt-0.5">Ferien · {holiday.name}</div>
          ) : (
            <button className="text-xs text-emerald-300 underline underline-offset-2 mt-0.5" onClick={() => setDate(new Date())}>Heute</button>
          )}
        </div>
        <IconBtn onClick={() => setDate(addDays(date, 1))} title="Nächster Tag">
          <ChevronRight size={20} className="text-stone-200" />
        </IconBtn>
      </div>

      <div className="flex gap-1.5 px-4 pt-3 pb-1">
        {["WORK", "SICK", "VACATION"].map((s) => (
          <button key={s} type="button" onClick={() => setDayStatus(dateKey, s === "WORK" ? null : { status: s })}
            className={`flex-1 py-1.5 text-sm border ${status === s ? "bg-emerald-950 text-stone-100 border-emerald-950" : "border-stone-300 text-stone-600"}`}>
            {DAY_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {status !== "WORK" && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex gap-1.5">
            {[["FULL", "Ganzer Tag"], ["FROM", "Ab Uhrzeit"], ["TO", "Bis Uhrzeit"]].map(([m, label]) => (
              <button key={m} type="button"
                onClick={() => setStatus(
                  m === "FROM" ? { from: statusFrom || "12:00", to: undefined }
                    : m === "TO" ? { to: statusTo || "12:00", from: undefined }
                    : { from: undefined, to: undefined }
                )}
                className={`flex-1 py-1 text-xs border ${partialMode === m ? "bg-amber-700 text-stone-50 border-amber-700" : "border-stone-300 text-stone-500"}`}>
                {label}
              </button>
            ))}
          </div>
          {partialMode === "FROM" && (
            <input type="time" value={statusFrom} onChange={(e) => setStatus({ from: e.target.value })}
              className="border border-stone-300 bg-white px-2 py-1 text-sm tabular-nums" />
          )}
          {partialMode === "TO" && (
            <input type="time" value={statusTo} onChange={(e) => setStatus({ to: e.target.value })}
              className="border border-stone-300 bg-white px-2 py-1 text-sm tabular-nums" />
          )}
          <p className="text-xs text-amber-700">
            Als „{DAY_STATUS_LABELS[status]}“
            {partialMode === "FROM" ? ` ab ${statusFrom} Uhr` : partialMode === "TO" ? ` bis ${statusTo} Uhr` : " (ganzer Tag)"}
            {" "}markiert – zählt nicht als Ist-Arbeitszeit, wird aber anteilig bei der Soll-Erfüllung angerechnet.
          </p>
        </div>
      )}

      {showGrid && (
        <div className="border-t border-stone-300">
          {periods.map((p, i) => {
            const entry = periodEntries[p.nr];
            const templ = dayTemplate[p.nr];
            const key = `period-${p.nr}`;
            const editing = editKey === key;
            const next = periods[i + 1];
            const gap = next ? toMin(next.start) - toMin(p.end) : 0;
            const slotKey = `pause-${p.nr}`;
            const slotEntry = slotEntries[slotKey];
            const slotEditKey = `slot-${slotKey}`;
            const periodCovered = !entry && isCoveredByAbsence(p.start, p.end);
            const gapCovered = !slotEntry && next && isCoveredByAbsence(p.end, next.start);

            return (
              <React.Fragment key={p.nr}>
                <div className="border-b border-stone-300">
                  {editing ? (
                    <div className="p-2">
                      <EntryForm
                        initial={entry ? entry : { start: p.start, end: p.end, activity: templ ? "Unterricht" : config.activities[0], note: templ || "" }}
                        activities={config.activities}
                        onSave={(data) => upsert({ id: entry?.id || uid(), periodNr: p.nr, slot: null, ...data })}
                        onCancel={() => setEditKey(null)}
                        onDelete={entry ? () => remove(entry.id) : undefined}
                      />
                    </div>
                  ) : entry ? (
                    <button onClick={() => setEditKey(key)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-2.5 border-l-4 ${
                        entry.activity === "Ausgefallen" ? "border-rose-700 bg-rose-50/40" : "border-emerald-700"
                      }`}>
                      <div className="w-16 shrink-0 text-xs text-stone-500 tabular-nums leading-tight">
                        <div>{p.nr}. Std</div>
                        <div>{entry.start}–{entry.end}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm text-stone-800 ${entry.activity === "Ausgefallen" ? "line-through text-stone-400" : ""}`}>
                          {entry.activity}
                        </div>
                        {entry.note && <div className="text-xs text-stone-500 truncate">{entry.note}</div>}
                      </div>
                      <div className="text-xs text-stone-500 tabular-nums shrink-0">
                        {isWorkEntry(entry) ? fmtDur(durationOf(entry)) : "—"}
                      </div>
                    </button>
                  ) : periodCovered ? (
                    <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-amber-300 bg-amber-50/40 text-stone-400">
                      <div className="w-16 shrink-0 text-xs tabular-nums leading-tight">
                        <div>{p.nr}. Std</div>
                        <div>{p.start}–{p.end}</div>
                      </div>
                      <div className="flex-1 text-sm italic">{DAY_STATUS_LABELS[status]}</div>
                    </div>
                  ) : templ ? (
                    <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-dashed border-amber-500">
                      <div className="w-16 shrink-0 text-xs text-stone-500 tabular-nums leading-tight">
                        <div>{p.nr}. Std</div>
                        <div>{p.start}–{p.end}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm italic text-stone-600 truncate">{templ}</div>
                        <div className="text-xs text-amber-700">geplant · unbestätigt</div>
                      </div>
                      <div className="flex items-center">
                        <IconBtn tone="good" title="Stunde bestätigen"
                          onClick={() => upsert({ id: uid(), periodNr: p.nr, slot: null, start: p.start, end: p.end, activity: "Unterricht", note: templ })}>
                          <Check size={18} />
                        </IconBtn>
                        <IconBtn title="Bearbeiten" onClick={() => setEditKey(key)}><Pencil size={16} /></IconBtn>
                        <IconBtn tone="danger" title="Als ausgefallen markieren"
                          onClick={() => upsert({ id: uid(), periodNr: p.nr, slot: null, start: p.start, end: p.end, activity: "Ausgefallen", note: templ })}>
                          <X size={18} />
                        </IconBtn>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditKey(key)} className="w-full flex items-center gap-3 px-4 py-2 text-stone-400 hover:bg-stone-100">
                      <div className="w-16 shrink-0 text-xs tabular-nums leading-tight">
                        <div>{p.nr}. Std</div>
                        <div>{p.start}–{p.end}</div>
                      </div>
                      <div className="flex-1 text-left text-sm">—</div>
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                {gap > 0 && !gapCovered && (
                  <div className="border-b border-stone-300 bg-stone-50">
                    {editKey === slotEditKey ? (
                      <div className="p-2">
                        <EntryForm
                          initial={slotEntry ? slotEntry : { start: p.end, end: next.start, activity: "Eigene Pause", note: "" }}
                          activities={config.activities}
                          onSave={(data) => upsert({ id: slotEntry?.id || uid(), periodNr: null, slot: slotKey, ...data })}
                          onCancel={() => setEditKey(null)}
                          onDelete={slotEntry ? () => remove(slotEntry.id) : undefined}
                        />
                      </div>
                    ) : slotEntry ? (
                      <button onClick={() => setEditKey(slotEditKey)} className="w-full flex items-center gap-3 px-4 py-1.5 pl-6 text-left">
                        <Coffee size={13} className="text-stone-400 shrink-0" />
                        <div className="flex-1 min-w-0 text-xs">
                          <span className={isWorkEntry(slotEntry) ? "text-stone-700" : "text-stone-400"}>{slotEntry.activity}</span>
                          <span className="text-stone-400 ml-2 tabular-nums">{slotEntry.start}–{slotEntry.end}</span>
                        </div>
                        <span className="text-xs text-stone-400 tabular-nums">{isWorkEntry(slotEntry) ? fmtDur(durationOf(slotEntry)) : "—"}</span>
                      </button>
                    ) : (
                      <button onClick={() => setEditKey(slotEditKey)} className="w-full flex items-center gap-3 px-4 py-1.5 pl-6 text-left text-stone-400 hover:bg-stone-100">
                        <Coffee size={13} className="shrink-0" />
                        <span className="flex-1 text-xs">Pause {p.end}–{next.start}</span>
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <h3 className="font-serif text-sm text-stone-500">{showGrid ? "Weitere Einträge" : "Einträge"}</h3>
      </div>
      <div className="border-t border-stone-300">
        {freeEntries.map((entry) => {
          const editing = editKey === entry.id;
          return (
            <div key={entry.id} className="border-b border-stone-300">
              {editing ? (
                <div className="p-2">
                  <EntryForm initial={entry} activities={config.activities}
                    onSave={(data) => upsert({ ...entry, ...data })}
                    onCancel={() => setEditKey(null)}
                    onDelete={() => remove(entry.id)} />
                </div>
              ) : (
                <button onClick={() => setEditKey(entry.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-2.5 border-l-4 ${isWorkEntry(entry) ? "border-emerald-700" : "border-stone-300"}`}>
                  <div className="w-24 shrink-0 text-xs text-stone-500 tabular-nums">{entry.start}–{entry.end}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800">{entry.activity}</div>
                    {entry.note && <div className="text-xs text-stone-500 truncate">{entry.note}</div>}
                  </div>
                  <div className="text-xs text-stone-500 tabular-nums shrink-0">{isWorkEntry(entry) ? fmtDur(durationOf(entry)) : "—"}</div>
                </button>
              )}
            </div>
          );
        })}
        {editKey === "new" ? (
          <div className="p-2 border-b border-stone-300">
            <EntryForm
              initial={{
                start: freeEntries.length ? freeEntries[freeEntries.length - 1].end : (showGrid ? (periods[periods.length - 1]?.end || "15:00") : "09:00"),
                end: addMin(freeEntries.length ? freeEntries[freeEntries.length - 1].end : (showGrid ? (periods[periods.length - 1]?.end || "15:00") : "09:00"), 45),
                activity: config.activities[0], note: "",
              }}
              activities={config.activities}
              onSave={(data) => upsert({ id: uid(), periodNr: null, slot: null, ...data })}
              onCancel={() => setEditKey(null)}
            />
          </div>
        ) : (
          <button onClick={() => setEditKey("new")} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-emerald-800 hover:bg-stone-100">
            <Plus size={16} /> Eintrag hinzufügen
          </button>
        )}
        {!showGrid && freeEntries.length === 0 && editKey !== "new" && (
          <p className="px-4 py-3 text-sm text-stone-400">Kein Eintrag für diesen Tag.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Auswertung ---------------------------------- */

function AuswertungView({ entries, templates, dayStatus, employment, config }) {
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(toISODate(startOfWeek(new Date())));
  const [customTo, setCustomTo] = useState(toISODate(new Date()));

  const range = useMemo(() => {
    if (mode === "day") return { from: anchor, to: anchor, label: fmtDateLong(anchor) };
    if (mode === "week") {
      const from = startOfWeek(anchor), to = addDays(from, 6);
      return { from, to, label: `${fmtDateShort(from)} – ${fmtDateShort(to)}` };
    }
    if (mode === "month") {
      const from = startOfMonth(anchor), to = endOfMonth(anchor);
      return { from, to, label: anchor.toLocaleDateString("de-DE", { month: "long", year: "numeric" }) };
    }
    const from = parseISODate(customFrom), to = parseISODate(customTo);
    return { from, to, label: `${fmtDateShort(from)} – ${fmtDateShort(to)}` };
  }, [mode, anchor, customFrom, customTo]);

  const { actual, target, creditedAbsence, byActivity, rows } = useMemo(() => {
    let actual = 0;
    const byActivity = {};
    const rows = [];
    Object.keys(entries).forEach((dateKey) => {
      const d = parseISODate(dateKey);
      if (d < new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate())) return;
      if (d > new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate())) return;
      entries[dateKey].forEach((e) => {
        const dur = durationOf(e);
        rows.push({ date: dateKey, ...e, dur });
        if (isWorkEntry(e)) {
          actual += dur;
          byActivity[e.activity] = (byActivity[e.activity] || 0) + dur;
        }
      });
    });

    // Soll und anrechenbare Abwesenheit (Krankheit/Urlaub) werden Tag für Tag über den Zeitraum ermittelt,
    // unabhängig von den erfassten Einträgen (siehe dailyTargetMinutes).
    let target = 0;
    let creditedAbsence = 0;
    let cursor = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
    const last = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
    while (cursor <= last) {
      const dayTarget = dailyTargetMinutes(templates, employment, cursor);
      target += dayTarget;
      const statusEntry = dayStatus[toISODate(cursor)] || null;
      if (statusEntry) creditedAbsence += dayTarget * dayAbsenceFraction(config, statusEntry);
      cursor = addDays(cursor, 1);
    }

    return { actual, target, creditedAbsence, byActivity, rows };
  }, [entries, range, templates, dayStatus, employment, config]);

  const effective = actual + creditedAbsence;
  const difference = effective - target;

  const activityList = Object.entries(byActivity).sort((a, b) => b[1] - a[1]);
  const maxVal = activityList.length ? activityList[0][1] : 1;

  const shift = (dir) => {
    if (mode === "day") setAnchor(addDays(anchor, dir));
    else if (mode === "week") setAnchor(addDays(anchor, dir * 7));
    else if (mode === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };

  const exportCSV = () => {
    const header = "Datum;Start;Ende;Tätigkeit;Bemerkung;Dauer (Min);Arbeitszeit\n";
    const body = rows
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map((r) => [r.date, r.start, r.end, r.activity, (r.note || "").replace(/;/g, ","), r.dur, isWorkEntry(r) ? "ja" : "nein"].join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arbeitszeit_${toISODate(range.from)}_bis_${toISODate(range.to)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2 flex gap-1.5">
        {[["day", "Tag"], ["week", "Woche"], ["month", "Monat"], ["custom", "Frei"]].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-sm border ${mode === m ? "bg-emerald-950 text-stone-100 border-emerald-950" : "border-stone-300 text-stone-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "custom" ? (
        <div className="px-4 pb-3 flex gap-2 items-center text-sm">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5 flex-1 tabular-nums" />
          <span className="text-stone-400">bis</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-stone-300 px-2 py-1.5 flex-1 tabular-nums" />
        </div>
      ) : (
        <div className="px-4 pb-3 flex items-center justify-between">
          <IconBtn onClick={() => shift(-1)}><ChevronLeft size={20} /></IconBtn>
          <span className="text-sm font-serif text-stone-700">{range.label}</span>
          <IconBtn onClick={() => shift(1)}><ChevronRight size={20} /></IconBtn>
        </div>
      )}

      <div className="border-t border-b border-stone-300 px-4 py-5 bg-stone-50 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-400">Tatsächlich gearbeitet</div>
          <div className="font-serif text-2xl text-stone-800 mt-1 tabular-nums">{fmtDur(actual)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-400">Soll</div>
          <div className="font-serif text-2xl text-stone-800 mt-1 tabular-nums">{fmtDur(target)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-400">Krankheit / Urlaub</div>
          <div className="font-serif text-2xl text-stone-800 mt-1 tabular-nums">{fmtDur(creditedAbsence)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-400">Bilanz</div>
          <div className={`font-serif text-2xl mt-1 tabular-nums ${difference < 0 ? "text-rose-700" : "text-emerald-800"}`}>
            {difference >= 0 ? "+" : "−"}{fmtDur(Math.abs(difference))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {activityList.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Keine Einträge in diesem Zeitraum.</p>}
        {activityList.map(([act, min]) => (
          <div key={act}>
            <div className="flex justify-between text-sm text-stone-700 mb-1">
              <span>{act}</span>
              <span className="tabular-nums text-stone-500">{fmtDur(min)}</span>
            </div>
            <div className="h-2 bg-stone-200 w-full">
              <div className="h-2 bg-emerald-700" style={{ width: `${(min / maxVal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-2">
        <button onClick={exportCSV} className="w-full flex items-center justify-center gap-2 border border-stone-300 py-2.5 text-sm text-stone-700 hover:bg-stone-100">
          <Download size={15} /> Zeitraum als CSV exportieren
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Stundenplan-Vorlagen Editor ---------------------------------- */

function TemplateEditor({ template, config, onChange, onClose }) {
  const [tplDay, setTplDay] = useState(0);

  const setField = (field, value) => onChange({ ...template, [field]: value });
  const setDayValue = (nr, value) => {
    const days = { ...template.days, [tplDay]: { ...(template.days[tplDay] || {}) } };
    if (value.trim()) days[tplDay][nr] = value; else delete days[tplDay][nr];
    onChange({ ...template, days });
  };

  return (
    <div className="border border-stone-300 bg-stone-50 p-3 space-y-3 mt-2">
      <label className="block text-xs text-stone-500">
        Name
        <input type="text" value={template.name} onChange={(e) => setField("name", e.target.value)}
          className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm" placeholder="z. B. 1. Halbjahr 2026/27" />
      </label>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-stone-500">
          Gültig von
          <input type="date" value={template.from} onChange={(e) => setField("from", e.target.value)}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums" />
        </label>
        <label className="flex-1 text-xs text-stone-500">
          Gültig bis
          <input type="date" value={template.to} onChange={(e) => setField("to", e.target.value)}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums" />
        </label>
      </div>

      <div className="flex gap-1 pt-1">
        {WD_SHORT.slice(0, 5).map((label, i) => (
          <button key={i} onClick={() => setTplDay(i)}
            className={`flex-1 py-1.5 text-sm border ${tplDay === i ? "bg-emerald-950 text-stone-100 border-emerald-950" : "border-stone-300 text-stone-600 bg-white"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="border border-stone-300 bg-white">
        {[...config.periods].sort((a, b) => a.nr - b.nr).map((p) => (
          <div key={p.nr} className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 last:border-b-0">
            <span className="w-16 text-xs text-stone-500 tabular-nums">{p.nr}. Std</span>
            <input type="text" placeholder="z. B. Mathematik 8a" value={(template.days[tplDay] || {})[p.nr] || ""}
              onChange={(e) => setDayValue(p.nr, e.target.value)}
              className="flex-1 border border-stone-300 px-2 py-1.5 text-sm" />
          </div>
        ))}
      </div>
      <button onClick={onClose} className="w-full bg-emerald-800 text-stone-50 text-sm py-2">Fertig</button>
    </div>
  );
}

/* ---------------------------------- Einstellungen ---------------------------------- */

function EinstellungenView({ config, setConfig, templates, setTemplates, holidaySettings, setHolidaySettings, entries, setEntries, dayStatus, setDayStatus, resetAll }) {
  const [newActivity, setNewActivity] = useState("");
  const employment = config.employment;
  const setEmployment = (patch) => setConfig({ ...config, employment: { ...employment, ...patch } });
  const weeklyTargetMinutes = effectiveWeeklyTargetMinutes(employment);
  const useIndividualTarget = employment.individualWeeklyTargetMinutes != null;
  const [confirmReset, setConfirmReset] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayError, setHolidayError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const updatePeriod = (nr, field, value) => {
    setConfig({ ...config, periods: config.periods.map((p) => (p.nr === nr ? { ...p, [field]: value } : p)) });
  };
  const addPeriod = () => {
    const nextNr = Math.max(0, ...config.periods.map((p) => p.nr)) + 1;
    const last = config.periods[config.periods.length - 1];
    const start = last ? addMin(last.end, 10) : "08:00";
    setConfig({ ...config, periods: [...config.periods, { nr: nextNr, start, end: addMin(start, 45) }] });
  };
  const removePeriod = (nr) => setConfig({ ...config, periods: config.periods.filter((p) => p.nr !== nr) });

  const addActivity = () => {
    const v = newActivity.trim();
    if (!v || config.activities.includes(v)) return;
    setConfig({ ...config, activities: [...config.activities, v] });
    setNewActivity("");
  };
  const removeActivity = (a) => setConfig({ ...config, activities: config.activities.filter((x) => x !== a) });

  const addTemplate = () => {
    const today = new Date();
    const t = {
      id: uid(),
      name: "Neuer Stundenplan",
      from: toISODate(today),
      to: toISODate(new Date(today.getFullYear(), today.getMonth() + 5, today.getDate())),
      days: {},
    };
    setTemplates([...templates, t]);
    setActiveTemplateId(t.id);
  };
  const updateTemplate = (id, next) => setTemplates(templates.map((t) => (t.id === id ? next : t)));
  const removeTemplate = (id) => { setTemplates(templates.filter((t) => t.id !== id)); if (activeTemplateId === id) setActiveTemplateId(null); };

  const addHoliday = () => {
    const today = toISODate(new Date());
    setHolidaySettings({
      ...holidaySettings,
      holidays: [...holidaySettings.holidays, { id: uid(), name: "Ferien", start: today, end: today }],
    });
  };
  const updateHoliday = (id, field, value) => {
    setHolidaySettings({
      ...holidaySettings,
      holidays: holidaySettings.holidays.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    });
  };
  const removeHoliday = (id) => setHolidaySettings({ ...holidaySettings, holidays: holidaySettings.holidays.filter((h) => h.id !== id) });

  const mergeHolidays = (fetched) => {
    const existingKeys = new Set(holidaySettings.holidays.map((h) => `${h.name}|${h.start}|${h.end}`));
    const merged = [...holidaySettings.holidays, ...fetched.filter((h) => !existingKeys.has(`${h.name}|${h.start}|${h.end}`))];
    merged.sort((a, b) => a.start.localeCompare(b.start));
    setHolidaySettings({ ...holidaySettings, holidays: merged });
  };

  const loadHolidaysOnline = async () => {
    setLoadingHolidays(true);
    setHolidayError("");
    try {
      const year = new Date().getFullYear();
      const years = [year - 1, year, year + 1];
      const results = await Promise.all(
        years.map((y) =>
          fetch(`https://schulferien-api.de/api/v1/${y}/${holidaySettings.bundesland}/`).then((r) => {
            if (!r.ok) throw new Error("Netzwerkfehler");
            return r.json();
          })
        )
      );
      const fetched = results.flat().map((h) => ({
        id: uid(), name: h.name, start: h.start.slice(0, 10), end: h.end.slice(0, 10),
      }));
      mergeHolidays(fetched);
    } catch (e) {
      setHolidayError("Ferien konnten nicht automatisch geladen werden. Bitte alternativ eine ICS-Datei importieren oder manuell eintragen.");
    } finally {
      setLoadingHolidays(false);
    }
  };

  // Sehr einfacher ICS-Parser: liest BEGIN:VEVENT-Blöcke und deren SUMMARY/DTSTART/DTEND.
  const parseICS = (text) => {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    // Zeilen, die mit Leerzeichen/Tab beginnen, gehören zur vorherigen Zeile (ICS-Zeilenumbruch-Regel)
    const unfolded = [];
    lines.forEach((line) => {
      if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
      else unfolded.push(line);
    });
    const toDateStr = (raw) => {
      const digits = raw.replace(/[^0-9]/g, "");
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    };
    const subDay = (dateStr) => { const d = parseISODate(dateStr); d.setDate(d.getDate() - 1); return toISODate(d); };

    const events = [];
    let cur = null;
    unfolded.forEach((line) => {
      if (line.startsWith("BEGIN:VEVENT")) cur = {};
      else if (line.startsWith("END:VEVENT")) { if (cur?.startRaw) events.push(cur); cur = null; }
      else if (cur) {
        const idx = line.indexOf(":");
        if (idx === -1) return;
        const key = line.slice(0, idx).split(";")[0].toUpperCase();
        const value = line.slice(idx + 1).trim();
        if (key === "SUMMARY") cur.name = value.replace(/\\,/g, ",").replace(/\\n/gi, " ");
        else if (key === "DTSTART") cur.startRaw = value;
        else if (key === "DTEND") cur.endRaw = value;
      }
    });

    return events.map((e) => {
      const start = toDateStr(e.startRaw);
      let end = e.endRaw ? toDateStr(e.endRaw) : start;
      // Bei ganztägigen ICS-Terminen ist DTEND laut Standard exklusiv (Folgetag) – daher einen Tag zurückrechnen
      if (end > start) end = subDay(end);
      return { id: uid(), name: e.name || "Ferien", start, end };
    });
  };

  const importICS = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHolidayError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const fetched = parseICS(reader.result);
        if (!fetched.length) { setHolidayError("In der Datei wurden keine Termine gefunden."); return; }
        mergeHolidays(fetched);
      } catch (err) {
        setHolidayError("ICS-Datei konnte nicht gelesen werden.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ config, templates, holidaySettings, entries, dayStatus }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pensum_backup_${toISODate(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.config) setConfig(data.config);
        if (data.templates) setTemplates(data.templates);
        if (data.holidaySettings) setHolidaySettings(data.holidaySettings);
        if (data.entries) setEntries(data.entries);
        if (data.dayStatus) setDayStatus(data.dayStatus);
        setImportMsg("Daten erfolgreich importiert.");
      } catch (err) {
        setImportMsg("Datei konnte nicht gelesen werden – ist es eine gültige Pensum-Sicherung?");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="pb-24 px-4 pt-4 space-y-8">
      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Schulstunden-Zeiten</h3>
        <p className="text-xs text-stone-500 mb-3">Die Anfangs- und Endzeiten deines Stundenrasters.</p>
        <div className="border border-stone-300">
          {[...config.periods].sort((a, b) => a.nr - b.nr).map((p) => (
            <div key={p.nr} className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 last:border-b-0">
              <span className="w-8 text-sm text-stone-500 tabular-nums">{p.nr}.</span>
              <input type="time" value={p.start} onChange={(e) => updatePeriod(p.nr, "start", e.target.value)}
                className="border border-stone-300 px-2 py-1 text-sm tabular-nums flex-1" />
              <span className="text-stone-400">–</span>
              <input type="time" value={p.end} onChange={(e) => updatePeriod(p.nr, "end", e.target.value)}
                className="border border-stone-300 px-2 py-1 text-sm tabular-nums flex-1" />
              <IconBtn tone="danger" onClick={() => removePeriod(p.nr)}><Trash2 size={16} /></IconBtn>
            </div>
          ))}
        </div>
        <button onClick={addPeriod} className="mt-2 flex items-center gap-1.5 text-sm text-emerald-800">
          <Plus size={15} /> Stunde hinzufügen
        </button>
      </section>

      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Arbeitszeitmodell</h3>
        <p className="text-xs text-stone-500 mb-3">
          Bestimmt deine wöchentliche Soll-Arbeitszeit. Sie wird auf die Wochentage verteilt – an Tagen mit mehr
          geplanten Schulstunden entsprechend mehr, an unterrichtsfreien Werktagen entsprechend weniger.
        </p>

        <label className="block text-xs text-stone-500 mb-3">
          Beschäftigungsumfang (%)
          <input type="number" min="1" max="100" value={employment.percentage} disabled={useIndividualTarget}
            onChange={(e) => setEmployment({ percentage: Math.max(1, Math.min(100, Number(e.target.value) || 0)) })}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums disabled:bg-stone-100 disabled:text-stone-400" />
        </label>

        <label className="block text-xs text-stone-500 mb-3">
          Vollzeit-Wochenreferenz
          <div className="mt-0.5 flex items-center gap-2">
            <input type="number" min="0" disabled={useIndividualTarget}
              value={Math.floor(employment.fullTimeWeeklyReferenceMinutes / 60)}
              onChange={(e) => {
                const h = Math.max(0, Number(e.target.value) || 0);
                setEmployment({ fullTimeWeeklyReferenceMinutes: h * 60 + (employment.fullTimeWeeklyReferenceMinutes % 60) });
              }}
              className="w-20 border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums disabled:bg-stone-100 disabled:text-stone-400" />
            <span className="text-stone-400 text-sm">Std</span>
            <input type="number" min="0" max="59" disabled={useIndividualTarget}
              value={employment.fullTimeWeeklyReferenceMinutes % 60}
              onChange={(e) => {
                const m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                setEmployment({ fullTimeWeeklyReferenceMinutes: Math.floor(employment.fullTimeWeeklyReferenceMinutes / 60) * 60 + m });
              }}
              className="w-20 border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums disabled:bg-stone-100 disabled:text-stone-400" />
            <span className="text-stone-400 text-sm">Min</span>
          </div>
          <span className="block mt-1 text-xs text-stone-400">
            Der Standardwert 46:38 h orientiert sich am niedersächsischen Referenzmodell und ist kein allgemeingültiger
            gesetzlicher Wert – frei änderbar.
          </span>
        </label>

        <label className="flex items-center gap-2 text-xs text-stone-500 mb-2">
          <input type="checkbox" checked={useIndividualTarget}
            onChange={(e) => setEmployment({ individualWeeklyTargetMinutes: e.target.checked ? weeklyTargetMinutes : null })} />
          Eigene Wochen-Sollzeit statt Beschäftigungsumfang verwenden
        </label>

        {useIndividualTarget && (
          <label className="block text-xs text-stone-500 mb-3">
            Individuelle Wochen-Sollzeit
            <div className="mt-0.5 flex items-center gap-2">
              <input type="number" min="0" value={Math.floor(employment.individualWeeklyTargetMinutes / 60)}
                onChange={(e) => {
                  const h = Math.max(0, Number(e.target.value) || 0);
                  setEmployment({ individualWeeklyTargetMinutes: h * 60 + (employment.individualWeeklyTargetMinutes % 60) });
                }}
                className="w-20 border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums" />
              <span className="text-stone-400 text-sm">Std</span>
              <input type="number" min="0" max="59" value={employment.individualWeeklyTargetMinutes % 60}
                onChange={(e) => {
                  const m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                  setEmployment({ individualWeeklyTargetMinutes: Math.floor(employment.individualWeeklyTargetMinutes / 60) * 60 + m });
                }}
                className="w-20 border border-stone-300 bg-white px-2 py-1.5 text-sm tabular-nums" />
              <span className="text-stone-400 text-sm">Min</span>
            </div>
          </label>
        )}

        <p className="text-xs text-stone-600">
          Aktuelles Wochen-Soll: <span className="tabular-nums font-medium">{fmtDur(weeklyTargetMinutes)}</span>
        </p>
      </section>

      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Stundenplan-Vorlagen</h3>
        <p className="text-xs text-stone-500 mb-3">
          Jede Vorlage gilt nur für einen bestimmten Zeitraum (z. B. ein Halbjahr). Für ein neues Halbjahr legst du
          einfach eine neue Vorlage an, ohne die aktuelle zu überschreiben.
        </p>
        <div className="border border-stone-300">
          {templates.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">Noch keine Vorlage angelegt.</p>}
          {templates
            .slice()
            .sort((a, b) => a.from.localeCompare(b.from))
            .map((t) => (
              <div key={t.id} className="border-b border-stone-200 last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800 truncate">{t.name || "(ohne Namen)"}</div>
                    <div className="text-xs text-stone-500 tabular-nums">{fmtDateShort(parseISODate(t.from))} – {fmtDateShort(parseISODate(t.to))}</div>
                  </div>
                  <IconBtn onClick={() => setActiveTemplateId(activeTemplateId === t.id ? null : t.id)} title="Bearbeiten"><Pencil size={16} /></IconBtn>
                  <IconBtn tone="danger" onClick={() => removeTemplate(t.id)} title="Löschen"><Trash2 size={16} /></IconBtn>
                </div>
                {activeTemplateId === t.id && (
                  <div className="px-3 pb-3">
                    <TemplateEditor template={t} config={config} onChange={(next) => updateTemplate(t.id, next)} onClose={() => setActiveTemplateId(null)} />
                  </div>
                )}
              </div>
            ))}
        </div>
        <button onClick={addTemplate} className="mt-2 flex items-center gap-1.5 text-sm text-emerald-800">
          <Plus size={15} /> Neue Stundenplan-Vorlage
        </button>
      </section>

      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Schulferien</h3>
        <p className="text-xs text-stone-500 mb-3">
          An Ferientagen wird kein Schulstundenraster angezeigt – nur frei buchbare Zeitblöcke.
        </p>
        <label className="block text-xs text-stone-500 mb-3">
          Bundesland
          <select value={holidaySettings.bundesland} onChange={(e) => setHolidaySettings({ ...holidaySettings, bundesland: e.target.value })}
            className="mt-0.5 w-full border border-stone-300 bg-white px-2 py-1.5 text-sm">
            {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </label>
        <button onClick={loadHolidaysOnline} disabled={loadingHolidays}
          className="w-full flex items-center justify-center gap-2 border border-stone-300 py-2.5 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-60 mb-2">
          {loadingHolidays ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {loadingHolidays ? "Lade Ferientermine …" : "Ferien automatisch laden"}
        </button>
        <label className="w-full flex items-center justify-center gap-2 border border-stone-300 py-2.5 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer mb-2">
          <Upload size={15} /> Ferien aus ICS-Datei importieren
          <input type="file" accept=".ics,text/calendar" onChange={importICS} className="hidden" />
        </label>
        <p className="text-xs text-stone-400 mb-2">
          ICS-Dateien bekommst du z. B. von der Website deines Kultusministeriums oder von Kalender-Anbietern, die
          Schulferien als Kalender zum Download anbieten – Vorschau/Prüfung nach dem Import empfohlen.
        </p>
        {holidayError && <p className="text-xs text-rose-700 mb-2">{holidayError}</p>}

        <div className="border border-stone-300">
          {holidaySettings.holidays.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">Noch keine Ferien hinterlegt.</p>}
          {holidaySettings.holidays
            .slice()
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((h) => (
              <div key={h.id} className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 last:border-b-0">
                <input type="text" value={h.name} onChange={(e) => updateHoliday(h.id, "name", e.target.value)}
                  className="w-28 border border-stone-300 px-2 py-1 text-sm" />
                <input type="date" value={h.start} onChange={(e) => updateHoliday(h.id, "start", e.target.value)}
                  className="border border-stone-300 px-1 py-1 text-xs tabular-nums flex-1 min-w-0" />
                <span className="text-stone-400 text-xs">–</span>
                <input type="date" value={h.end} onChange={(e) => updateHoliday(h.id, "end", e.target.value)}
                  className="border border-stone-300 px-1 py-1 text-xs tabular-nums flex-1 min-w-0" />
                <IconBtn tone="danger" onClick={() => removeHoliday(h.id)}><Trash2 size={15} /></IconBtn>
              </div>
            ))}
        </div>
        <button onClick={addHoliday} className="mt-2 flex items-center gap-1.5 text-sm text-emerald-800">
          <Plus size={15} /> Ferien manuell hinzufügen
        </button>
      </section>

      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Tätigkeiten</h3>
        <p className="text-xs text-stone-500 mb-3">„Eigene Pause“ und „Ausgefallen“ zählen automatisch nicht als Arbeitszeit.</p>
        <div className="border border-stone-300">
          {config.activities.map((a) => (
            <div key={a} className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 last:border-b-0">
              <span className="flex-1 text-sm text-stone-700">{a}</span>
              {a !== "Eigene Pause" && <IconBtn tone="danger" onClick={() => removeActivity(a)}><Trash2 size={15} /></IconBtn>}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input type="text" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Neue Tätigkeit …"
            className="flex-1 border border-stone-300 px-2 py-1.5 text-sm" />
          <button onClick={addActivity} className="px-3 border border-stone-300 text-emerald-800"><Plus size={16} /></button>
        </div>
      </section>

      <section>
        <h3 className="font-serif text-base text-stone-800 mb-1">Daten</h3>
        <div className="space-y-2 mt-2">
          <button onClick={exportJSON} className="w-full flex items-center justify-center gap-2 border border-stone-300 py-2.5 text-sm text-stone-700 hover:bg-stone-100">
            <Download size={15} /> Alle Daten als JSON sichern
          </button>
          <label className="w-full flex items-center justify-center gap-2 border border-stone-300 py-2.5 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer">
            <Upload size={15} /> Daten aus Sicherung importieren
            <input type="file" accept="application/json" onChange={importJSON} className="hidden" />
          </label>
          {importMsg && <p className="text-xs text-stone-500">{importMsg}</p>}
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="w-full py-2.5 text-sm text-rose-700 border border-rose-300 hover:bg-rose-50">
              Alle Daten zurücksetzen
            </button>
          ) : (
            <div className="border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 space-y-2">
              <p>Wirklich alle Einträge, Vorlagen und Einstellungen löschen? Das kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-2">
                <button onClick={() => { resetAll(); setConfirmReset(false); }} className="flex-1 bg-rose-700 text-white py-1.5">Ja, löschen</button>
                <button onClick={() => setConfirmReset(false)} className="flex-1 border border-rose-300 py-1.5">Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-stone-400 pt-2 pb-4 leading-relaxed">
        Alle Daten liegen ausschließlich in diesem Browser auf diesem Gerät (localStorage) – es gibt keinen Server
        und kein Konto. Lösche daher niemals deine Browserdaten, ohne vorher eine JSON-Sicherung zu erstellen.
        Die automatischen Ferientermine stammen von einem öffentlichen Kalender-Dienst und sollten geprüft werden.
      </p>
    </div>
  );
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  const [config, setConfigState] = useState(() => {
    const loaded = loadJSON("config", DEFAULT_CONFIG);
    // Bestehende gespeicherte Configs kennen `employment` ggf. noch nicht – additiv ergänzen.
    return { ...DEFAULT_CONFIG, ...loaded, employment: { ...DEFAULT_EMPLOYMENT, ...(loaded.employment || {}) } };
  });
  const [templates, setTemplatesState] = useState(() => loadJSON("templates", []));
  const [holidaySettings, setHolidaySettingsState] = useState(() => loadJSON("holidays", { bundesland: "NW", holidays: [] }));
  const [entries, setEntriesState] = useState(() => loadJSON("entries", {}));
  const [dayStatus, setDayStatusState] = useState(() => loadJSON("dayStatus", {}));
  const [tab, setTab] = useState("tag");
  const [date, setDate] = useState(new Date());

  const setConfig = (next) => { setConfigState(next); saveJSON("config", next); };
  const setTemplates = (next) => { setTemplatesState(next); saveJSON("templates", next); };
  const setHolidaySettings = (next) => { setHolidaySettingsState(next); saveJSON("holidays", next); };
  const setEntries = (next) => { setEntriesState(next); saveJSON("entries", next); };
  const setDayStatus = (next) => { setDayStatusState(next); saveJSON("dayStatus", next); };
  const setDayEntries = (dateKey, list) => {
    const next = { ...entries };
    if (list.length) next[dateKey] = list; else delete next[dateKey];
    setEntries(next);
  };
  const setDayStatusFor = (dateKey, value) => {
    const next = { ...dayStatus };
    if (value) next[dateKey] = value; else delete next[dateKey];
    setDayStatus(next);
  };
  const resetAll = () => {
    setConfig(DEFAULT_CONFIG);
    setTemplates([]);
    setHolidaySettings({ bundesland: "NW", holidays: [] });
    setEntries({});
    setDayStatus({});
  };

  const tabs = [
    { id: "tag", label: "Tag", icon: Calendar },
    { id: "auswertung", label: "Auswertung", icon: BarChart3 },
    { id: "einstellungen", label: "Einstellungen", icon: Settings },
  ];

  return (
    <div className="max-w-md mx-auto bg-stone-100 min-h-screen font-sans relative" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="sticky top-0 z-10 bg-emerald-950 text-stone-100 px-4 py-2.5 flex items-center justify-between">
        <span className="font-serif text-lg tracking-tight">Pensum</span>
        <span className="text-xs text-emerald-300">Arbeitszeit für Lehrkräfte</span>
      </div>

      {tab === "tag" && (
        <TagView date={date} setDate={setDate} entries={entries} setDayEntries={setDayEntries} config={config}
          templates={templates} holidays={holidaySettings.holidays} dayStatus={dayStatus} setDayStatus={setDayStatusFor} />
      )}
      {tab === "auswertung" && (
        <AuswertungView entries={entries} templates={templates} dayStatus={dayStatus} employment={config.employment} config={config} />
      )}
      {tab === "einstellungen" && (
        <EinstellungenView
          config={config} setConfig={setConfig}
          templates={templates} setTemplates={setTemplates}
          holidaySettings={holidaySettings} setHolidaySettings={setHolidaySettings}
          entries={entries} setEntries={setEntries}
          dayStatus={dayStatus} setDayStatus={setDayStatus}
          resetAll={resetAll}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-emerald-950 border-t border-emerald-900 flex">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${active ? "text-amber-400" : "text-emerald-300"}`}>
              <Icon size={19} />
              <span className="text-[11px]">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
