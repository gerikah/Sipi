-- READ ONLY, trusted SQL Editor. Execute sections separately if a schema is absent.
select version,name from supabase_migrations.schema_migrations order by version;
select extname,extversion from pg_extension where extname='pg_cron';
select current_setting('cron.timezone',true) as cron_timezone;
select jobid,jobname,schedule,command,username,active from cron.job
where command ilike '%cleanup_imports%' or jobname='sipi-import-retention';
select j.jobname,r.status,r.return_message,r.start_time,r.end_time
from cron.job_run_details r join cron.job j using(jobid)
where j.jobname='sipi-import-retention' order by r.start_time desc limit 10;
-- Aggregate inspection does not return private identifiers or raw imports.
select status,count(*) from public.theses group by status;
select name,coverage_start_year,coverage_end_year,coverage_verified from public.sources;
select status,count(*) as batches,count(*) filter(where created_at<now()-interval '30 days') as older_than_30_days
from private.import_batches group by status;
select has_function_privilege('anon','private.cleanup_imports()','EXECUTE') as anon_execute,
has_function_privilege('authenticated','private.cleanup_imports()','EXECUTE') as authenticated_execute;
