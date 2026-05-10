-- Dry-run backfill based on inferred cutoff (first 70-day creation time)
select public.backfill_trial_periods(
  timestamp '2025-08-07 09:00:08.306142+00',
  30,
  70,
  false,
  true
) as result;