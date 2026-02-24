do $$
declare
  target_view text;
  view_sql text;
begin
  foreach target_view in array array['vw_player_team', 'vw_team_standings']
  loop
    select pg_get_viewdef(format('public.%I', target_view)::regclass, true)
      into view_sql;

    view_sql := btrim(view_sql);
    if right(view_sql, 1) = ';' then
      view_sql := left(view_sql, length(view_sql) - 1);
    end if;

    execute format(
      'create or replace view public.%I with (security_invoker = true) as %s',
      target_view,
      view_sql
    );
  end loop;
end $$;
