-- READ ONLY. Run on the intended project using trusted SQL access.
-- Contains schema metadata, not thesis contents, user IDs or credentials.
select jsonb_build_object(
  'columns', (select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.ordinal_position) from (
    select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,
      is_identity,identity_generation,is_generated,generation_expression,
      has_column_privilege('anon',format('%I.%I',table_schema,table_name),column_name,'SELECT') as anon_read,
      has_column_privilege('authenticated',format('%I.%I',table_schema,table_name),column_name,'SELECT') as authenticated_read
    from information_schema.columns where table_schema in ('public','private')
  ) x),
  'tables', (select jsonb_agg(to_jsonb(x) order by x.schema,x.name) from (
    select n.nspname as schema,c.relname as name,c.relrowsecurity,c.relforcerowsecurity,
      has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') as anon_write,
      has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as authenticated_write
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'
  ) x),
  'constraints', (select jsonb_agg(to_jsonb(x) order by x.schema,x.table_name,x.name) from (
    select n.nspname as schema,c.relname as table_name,k.conname as name,k.contype,pg_get_constraintdef(k.oid) as definition
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
  ) x),
  'indexes', (select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.indexname) from (
    select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','private')
  ) x),
  'policies', (select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.policyname) from (
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private')
  ) x),
  'triggers', (select jsonb_agg(to_jsonb(x) order by x.schema,x.table_name,x.name) from (
    select n.nspname as schema,c.relname as table_name,t.tgname as name,pg_get_triggerdef(t.oid) as definition
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and not t.tgisinternal
  ) x),
  'functions', (select jsonb_agg(to_jsonb(x) order by x.schema,x.name,x.arguments) from (
    select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer,p.proconfig as settings,pg_get_functiondef(p.oid) as definition,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'
  ) x)
) as schema_audit;
