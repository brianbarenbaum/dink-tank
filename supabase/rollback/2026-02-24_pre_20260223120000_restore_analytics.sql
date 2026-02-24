-- Restores pre-20260223120000 analytics objects by replaying the
-- already-applied analytics migrations in canonical version order.

do $$
declare
  migration_row record;
  stmt text;
  versions text[] := array[
    '20260221220759',
    '20260221221231',
    '20260221221548',
    '20260221222041',
    '20260221222409',
    '20260221222847',
    '20260221223043'
  ];
begin
  for migration_row in
    select version, statements
    from supabase_migrations.schema_migrations
    where version = any(versions)
    order by version asc
  loop
    if migration_row.statements is null or array_length(migration_row.statements, 1) is null then
      raise exception 'Missing statements payload for migration version % in schema_migrations.', migration_row.version;
    end if;

    foreach stmt in array migration_row.statements loop
      execute stmt;
    end loop;
  end loop;
end
$$;
