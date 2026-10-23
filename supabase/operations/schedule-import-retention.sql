-- PREPARED, NOT APPLIED. Run only in an explicitly authorized development project.
-- The project currently backing the live site needs separate production approval.
-- Enable pg_cron through trusted administration first. Do not grant browser access.
begin;
do $$
begin
  if current_user <> 'postgres' then raise exception 'Use the trusted postgres administrator'; end if;
  if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Enable pg_cron before scheduling'; end if;
  if coalesce(current_setting('cron.timezone',true),'GMT') not in ('GMT','UTC') then raise exception 'Review scheduler timezone before applying'; end if;
  if has_function_privilege('anon','private.cleanup_imports()','EXECUTE') or has_function_privilege('authenticated','private.cleanup_imports()','EXECUTE') then
    raise exception 'Cleanup must not be executable by browser roles';
  end if;
  if exists(select 1 from cron.job where (command ilike '%cleanup_imports%' or jobname='sipi-import-retention')
    and not(jobname='sipi-import-retention' and schedule='0 19 * * *' and command='select private.cleanup_imports();' and username='postgres' and active)) then
    raise exception 'An existing cleanup job differs; review it without creating a duplicate';
  end if;
end; $$;
-- 19:00 UTC = 03:00 Asia/Manila, daily. Nothing runs immediately.
select cron.schedule('sipi-import-retention','0 19 * * *','select private.cleanup_imports();')
where not exists(select 1 from cron.job where jobname='sipi-import-retention');
commit;
