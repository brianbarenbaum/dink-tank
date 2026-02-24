-- Ensure feature-bundle player catalog always includes explicitly selected
-- available players, even when historical candidate pairs are empty.
create or replace function analytics.fn_lineup_lab_feature_bundle(
	p_division_id uuid,
	p_season_year integer,
	p_season_number integer,
	p_team_id uuid,
	p_opp_team_id uuid,
	p_available_player_ids uuid[] default null,
	p_limit_scenarios integer default 12,
	p_matchup_id uuid default null,
	p_matchup_scheduled_time timestamptz default null
)
returns jsonb
language sql
stable
as $function$
with candidate_pairs as (
	select
		pbf.division_id,
		pbf.season_year,
		pbf.season_number,
		pbf.team_id,
		pbf.pair_player_low_id,
		pbf.pair_player_high_id,
		pbf.pair_key,
		pbf.games_played,
		pbf.wins,
		pbf.losses,
		pbf.win_rate,
		pbf.win_rate_shrunk,
		pbf.avg_point_diff,
		pbf.pd_win_probability,
		pbf.point_diff_volatility,
		pbf.division_win_rate_prior,
		pbf.mixed_win_rate_prior,
		pbf.female_win_rate_prior,
		pbf.male_win_rate_prior,
		pbf.sample_reliability,
		pbf.mixed_games,
		pbf.mixed_win_rate,
		pbf.mixed_win_rate_shrunk,
		pbf.mixed_pd_win_probability,
		pbf.female_games,
		pbf.female_win_rate,
		pbf.female_win_rate_shrunk,
		pbf.female_pd_win_probability,
		pbf.male_games,
		pbf.male_win_rate,
		pbf.male_win_rate_shrunk,
		pbf.male_pd_win_probability,
		pbf.last_seen_at
	from analytics.vw_pair_baseline_features pbf
	where pbf.division_id = p_division_id
		and pbf.season_year = p_season_year
		and pbf.season_number = p_season_number
		and pbf.team_id = p_team_id
		and (
			p_matchup_scheduled_time is null
			or pbf.last_seen_at is null
			or pbf.last_seen_at < p_matchup_scheduled_time
		)
		and (
			p_available_player_ids is null
			or (
				pbf.pair_player_low_id = any(p_available_player_ids)
				and pbf.pair_player_high_id = any(p_available_player_ids)
			)
		)
),
scenarios as (
	select
		ops.division_id,
		ops.season_year,
		ops.season_number,
		ops.team_id,
		ops.scenario_id,
		ops.scenario_signature,
		ops.scenario_pairs,
		ops.scenario_occurrences,
		ops.sample_weight,
		ops.scenario_probability,
		ops.best_recency_rank,
		ops.last_seen_at,
		ops.seen_in_last_3,
		ops.seen_in_last_6,
		ops.scenario_rank
	from analytics.vw_opponent_pairing_scenarios ops
	where ops.division_id = p_division_id
		and ops.season_year = p_season_year
		and ops.season_number = p_season_number
		and ops.team_id = p_opp_team_id
		and (
			p_matchup_scheduled_time is null
			or ops.last_seen_at is null
			or ops.last_seen_at < p_matchup_scheduled_time
		)
		and ops.scenario_rank <= greatest(p_limit_scenarios, 1)
),
opponent_pairs as (
	select distinct
		(pair_obj->>'pair_player_low_id')::uuid as opp_pair_low_id,
		(pair_obj->>'pair_player_high_id')::uuid as opp_pair_high_id,
		coalesce(lower(pair_obj->>'match_type'), 'unknown') as match_type
	from scenarios s
	cross join lateral jsonb_array_elements(s.scenario_pairs) as pair_obj
	where pair_obj ? 'pair_player_low_id'
		and pair_obj ? 'pair_player_high_id'
),
pair_matchups as (
	select
		pvp.division_id,
		pvp.season_year,
		pvp.season_number,
		pvp.match_type,
		pvp.our_pair_low_id,
		pvp.our_pair_high_id,
		pvp.opp_pair_low_id,
		pvp.opp_pair_high_id,
		pvp.our_pair_key,
		pvp.opp_pair_key,
		pvp.games_played,
		pvp.wins,
		pvp.losses,
		pvp.win_rate,
		pvp.win_rate_shrunk,
		pvp.avg_point_diff,
		pvp.pd_win_probability,
		pvp.point_diff_volatility,
		pvp.sample_reliability,
		pvp.last_seen_at
	from analytics.vw_pair_vs_pair_features pvp
	join candidate_pairs cp
		on cp.pair_player_low_id = pvp.our_pair_low_id
		and cp.pair_player_high_id = pvp.our_pair_high_id
	join opponent_pairs op
		on op.opp_pair_low_id = pvp.opp_pair_low_id
		and op.opp_pair_high_id = pvp.opp_pair_high_id
		and op.match_type = pvp.match_type
	where pvp.division_id = p_division_id
		and pvp.season_year = p_season_year
		and pvp.season_number = p_season_number
		and (
			p_matchup_scheduled_time is null
			or pvp.last_seen_at is null
			or pvp.last_seen_at < p_matchup_scheduled_time
		)
),
players_catalog as (
	select
		p.player_id,
		p.first_name,
		p.last_name,
		p.gender,
		p.team_id
	from public.players p
	where p.player_id in (
		select cp.pair_player_low_id from candidate_pairs cp
		union
		select cp.pair_player_high_id from candidate_pairs cp
		union
		select op.opp_pair_low_id from opponent_pairs op
		union
		select op.opp_pair_high_id from opponent_pairs op
		union
		select unnest(coalesce(p_available_player_ids, array[]::uuid[]))
	)
),
freshness as (
	select max(last_seen_at) as max_last_seen_at
	from (
		select cp.last_seen_at from candidate_pairs cp
		union all
		select s.last_seen_at from scenarios s
		union all
		select pm.last_seen_at from pair_matchups pm
	) all_last_seen
)
select jsonb_build_object(
	'generated_at', now(),
	'max_last_seen_at', (select f.max_last_seen_at from freshness f),
	'data_staleness_hours', (
		select
			case
				when f.max_last_seen_at is null then null
				else round(
					greatest(
						extract(epoch from (coalesce(p_matchup_scheduled_time, now()) - f.max_last_seen_at)) / 3600.0,
						0
					)::numeric,
					3
				)
			end
		from freshness f
	),
	'inputs', jsonb_build_object(
		'division_id', p_division_id,
		'season_year', p_season_year,
		'season_number', p_season_number,
		'team_id', p_team_id,
		'opp_team_id', p_opp_team_id,
		'matchup_id', p_matchup_id,
		'matchup_scheduled_time', p_matchup_scheduled_time,
		'available_player_ids', p_available_player_ids,
		'limit_scenarios', p_limit_scenarios
	),
	'counts', jsonb_build_object(
		'candidate_pairs', (select count(*) from candidate_pairs),
		'scenarios', (select count(*) from scenarios),
		'opponent_pairs', (select count(*) from opponent_pairs),
		'pair_matchups', (select count(*) from pair_matchups),
		'players_catalog', (select count(*) from players_catalog)
	),
	'candidate_pairs', coalesce(
		(select jsonb_agg(to_jsonb(cp) order by cp.win_rate_shrunk desc, cp.games_played desc) from candidate_pairs cp),
		'[]'::jsonb
	),
	'opponent_scenarios', coalesce(
		(select jsonb_agg(to_jsonb(s) order by s.scenario_rank asc) from scenarios s),
		'[]'::jsonb
	),
	'pair_matchups', coalesce(
		(select jsonb_agg(to_jsonb(pm) order by pm.win_rate_shrunk desc, pm.games_played desc) from pair_matchups pm),
		'[]'::jsonb
	),
	'players_catalog', coalesce(
		(select jsonb_agg(to_jsonb(pc) order by pc.last_name, pc.first_name) from players_catalog pc),
		'[]'::jsonb
	)
);
$function$;

comment on function analytics.fn_lineup_lab_feature_bundle(uuid, integer, integer, uuid, uuid, uuid[], integer, uuid, timestamptz) is 'lineup_analytics_v2';
