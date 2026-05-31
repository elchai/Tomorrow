/* ============================================================
   TOMORROW — Archive engine
   localStorage runs out of room after ~30 days of demo use. This
   module compacts event-style state (intel_log entries, dispatched
   units history, daily forecast snapshots) older than 14 days into
   weekly summaries stored under State.history[weekISO]. Source
   records are then dropped so the live State stays small while
   long-term trends survive for insights.js to read.

   Public API:
     TomorrowArchive.compact()          → run aggregation
     TomorrowArchive.estimateSize()     → bytes used by current state
     TomorrowArchive.purgeIfOverLimit() → aggressive trim if near 5MB cap

   compact() is invoked by app.saveState() before every localStorage
   write so we never blow past the quota.
   ============================================================ */

window.TomorrowArchive = (function () {

  const State = window.TomorrowState;

  const ARCHIVE_TTL_DAYS = 14;          // entries older than this get rolled into history
  const SIZE_LIMIT_BYTES = 3.5 * 1024 * 1024;  // 3.5MB safety cap (real limit ~5MB)
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // ---------- ISO week helpers ----------
  function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / MS_PER_DAY + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  // ---------- Aggregation helpers ----------
  function ensureBucket(key) {
    if (!State.history) State.history = {};
    if (!State.history[key]) {
      State.history[key] = {
        prevented: 0, occurred: 0,
        intel_count: 0, dispatch_count: 0,
        crime_breakdown: {},
        station_breakdown: {},
        urgency_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        first_seen: null, last_seen: null
      };
    }
    return State.history[key];
  }

  function bumpDate(bucket, dateIso) {
    if (!bucket.first_seen || dateIso < bucket.first_seen) bucket.first_seen = dateIso;
    if (!bucket.last_seen  || dateIso > bucket.last_seen)  bucket.last_seen  = dateIso;
  }

  // ---------- Main compaction ----------
  function compact() {
    const cutoff = Date.now() - ARCHIVE_TTL_DAYS * MS_PER_DAY;
    let archived = 0;

    // 1. intel_log entries
    if (Array.isArray(State.intel_log) && State.intel_log.length) {
      const keep = [];
      State.intel_log.forEach(entry => {
        const ts = entry.ts || entry.time || entry.timestamp;
        const epoch = typeof ts === 'number' ? ts : (typeof ts === 'string' ? Date.parse(ts) : NaN);
        if (!epoch || epoch >= cutoff) { keep.push(entry); return; }
        const wk = isoWeekKey(new Date(epoch));
        const bucket = ensureBucket(wk);
        bucket.intel_count++;
        const urg = entry.urgency || entry.level || 3;
        if (bucket.urgency_breakdown[urg] != null) bucket.urgency_breakdown[urg]++;
        const cat = (entry.category || entry.type || 'system').toLowerCase();
        bucket.station_breakdown[entry.station_id || 'unknown'] =
          (bucket.station_breakdown[entry.station_id || 'unknown'] || 0) + 1;
        bumpDate(bucket, new Date(epoch).toISOString().slice(0, 10));
        archived++;
      });
      State.intel_log = keep;
    }

    // 2. Sim ledger (prevented/occurred) — roll the running totals into THIS week
    //    so we can chart prevention rates over time without bloating sim itself.
    if (State.sim && (State.sim.prevented || State.sim.occurred)) {
      const wk = isoWeekKey(new Date());
      const bucket = ensureBucket(wk);
      // delta = whatever isn't already booked into this week
      const seenKey = '__sim_seen';
      const seen = bucket[seenKey] || { prevented: 0, occurred: 0 };
      bucket.prevented += Math.max(0, State.sim.prevented - seen.prevented);
      bucket.occurred  += Math.max(0, State.sim.occurred  - seen.occurred);
      bucket[seenKey]  = { prevented: State.sim.prevented, occurred: State.sim.occurred };
    }

    // 3. Forecast snapshot — if a previous forecast set exists and is stale (>14d)
    //    its hotspot count joins last week's bucket. We only summarize, never store
    //    the hotspot blobs (those are several KB each).
    if (Array.isArray(State.forecast) && State.forecast.length && State._forecast_savedAt) {
      const epoch = State._forecast_savedAt;
      if (epoch < cutoff) {
        const wk = isoWeekKey(new Date(epoch));
        const bucket = ensureBucket(wk);
        State.forecast.forEach(h => {
          const crime = h.crime_type || h.crimeType || 'unknown';
          bucket.crime_breakdown[crime] = (bucket.crime_breakdown[crime] || 0) + 1;
        });
        bumpDate(bucket, new Date(epoch).toISOString().slice(0, 10));
        State.forecast = [];
        delete State._forecast_savedAt;
        archived++;
      }
    }

    // 4. shifts: keep current + previous week; archive older weeks just as a count
    if (State.shifts && typeof State.shifts === 'object') {
      const currentWk = isoWeekKey(new Date());
      const prevWk = isoWeekKey(new Date(Date.now() - 7 * MS_PER_DAY));
      const newShifts = {};
      Object.entries(State.shifts).forEach(([wk, data]) => {
        if (wk === currentWk || wk === prevWk) { newShifts[wk] = data; return; }
        const bucket = ensureBucket(wk);
        // Count total filled slots across the week as an "active_assignments" stat
        let filled = 0;
        Object.values(data || {}).forEach(day =>
          Object.values(day || {}).forEach(slot => { filled += Array.isArray(slot) ? slot.length : 0; })
        );
        bucket.shift_assignments = (bucket.shift_assignments || 0) + filled;
        archived++;
      });
      State.shifts = newShifts;
    }

    return archived;
  }

  // ---------- Size monitoring ----------
  function estimateSize() {
    try { return JSON.stringify(State).length; }
    catch { return 0; }
  }

  function purgeIfOverLimit(limitBytes = SIZE_LIMIT_BYTES) {
    if (estimateSize() <= limitBytes) return 0;
    // Drop oldest history bucket first; if still over limit, truncate intel_log.
    let trimmed = 0;
    while (estimateSize() > limitBytes && State.history && Object.keys(State.history).length > 4) {
      const oldest = Object.keys(State.history).sort()[0];
      delete State.history[oldest];
      trimmed++;
    }
    if (estimateSize() > limitBytes && Array.isArray(State.intel_log)) {
      State.intel_log = State.intel_log.slice(-100);   // keep only most recent 100
      trimmed++;
    }
    return trimmed;
  }

  return { compact, estimateSize, purgeIfOverLimit, isoWeekKey };
})();
