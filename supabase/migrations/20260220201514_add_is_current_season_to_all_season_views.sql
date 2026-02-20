do $$
declare
  secure_views text[] := array[
    'vw_player_stats_per_season',
    'vw_player_stats_per_match',
    'vw_player_game_history',
    'vw_match_game_lineups_scores',
    'vw_team_matches'
  ];
  non_secure_views text[] := array[
    'vw_team_standings'
  ];
  view_name text;
  view_sql text;
begin
  foreach view_name in array secure_views
  loop
    select pg_get_viewdef(format('public.%I', view_name)::regclass, true)
      into view_sql;
    view_sql := btrim(view_sql);
    if right(view_sql, 1) = ';' then
      view_sql := left(view_sql, length(view_sql) - 1);
    end if;

    execute format(
      $sql$
      create or replace view public.%I
      with (security_invoker = true) as
      with current_season as (
        select
          pr.season_year,
          max(pr.season_number) as season_number
        from public.player_rosters pr
        where pr.season_year = (
          select max(pr2.season_year)
          from public.player_rosters pr2
        )
        group by pr.season_year
      ),
      base as (
        %s
      )
      select
        base.*,
        (
          base.season_year = cs.season_year
          and base.season_number = cs.season_number
        ) as is_current_season
      from base
      cross join current_season cs
      $sql$,
      view_name,
      view_sql
    );
  end loop;

  foreach view_name in array non_secure_views
  loop
    select pg_get_viewdef(format('public.%I', view_name)::regclass, true)
      into view_sql;
    view_sql := btrim(view_sql);
    if right(view_sql, 1) = ';' then
      view_sql := left(view_sql, length(view_sql) - 1);
    end if;

    execute format(
      $sql$
      create or replace view public.%I as
      with current_season as (
        select
          pr.season_year,
          max(pr.season_number) as season_number
        from public.player_rosters pr
        where pr.season_year = (
          select max(pr2.season_year)
          from public.player_rosters pr2
        )
        group by pr.season_year
      ),
      base as (
        %s
      )
      select
        base.*,
        (
          base.season_year = cs.season_year
          and base.season_number = cs.season_number
        ) as is_current_season
      from base
      cross join current_season cs
      $sql$,
      view_name,
      view_sql
    );
  end loop;
end $$;

create or replace view public.vw_player_status_per_season
with (security_invoker = true) as
select *
from public.vw_player_stats_per_season;
