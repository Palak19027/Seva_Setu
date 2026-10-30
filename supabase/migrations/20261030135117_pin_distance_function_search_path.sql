/*
# Pin search path on the distance helper

Plain English: the helper that measures distance between two points is now locked to the
public schema, so it cannot be redirected to another schema by a caller.

## Modified functions
- distance_km: search path fixed to public.

## Important notes
1. No data changes. Re-running is safe.
*/

ALTER FUNCTION public.distance_km(double precision, double precision, double precision, double precision) SET search_path = public;
