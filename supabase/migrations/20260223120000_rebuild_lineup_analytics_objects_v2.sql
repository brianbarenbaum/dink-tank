create schema if not exists analytics;

-- Drop in dependency order.
drop function if exists analytics.fn_lineup_lab_feature_bundle(uuid, integer, integer, uuid, uuid, uuid[], integer);
drop function if exists analytics.fn_lineup_lab_feature_bundle(uuid, integer, integer, uuid, uuid, uuid[], integer, uuid, timestamptz);
drop function if exists analytics.refresh_lineup_analytics_views();

drop view if exists analytics.vw_team_game_pairs;
drop view if exists analytics.vw_game_events_canonical;
drop view if exists analytics.vw_pair_vs_pair_features;
drop view if exists analytics.vw_pair_baseline_features;
drop view if exists analytics.vw_opponent_pairing_scenarios;

drop materialized view if exists analytics.mv_pair_vs_pair_features;
drop materialized view if exists analytics.mv_pair_baseline_features;
drop materialized view if exists analytics.mv_opponent_pairing_scenarios;
drop materialized view if exists analytics.mv_team_game_pairs;
drop materialized view if exists analytics.mv_game_events_canonical;

create materialized view analytics.mv_game_events_canonical as
with game_agg as (
	select
		nullif(ls.raw_json ->> 'matchupId', '')::uuid as matchup_id,
		nullif(ls.raw_json ->> 'gameNumber', '')::integer as game_number,
		max(ls.created_at) as event_created_at,
		max(nullif(ls.raw_json ->> 'lineupId', ''))::uuid as lineup_event_id,
		max(nullif(ls.raw_json ->> 'matchType', '')) as match_type,
		max(nullif(ls.raw_json ->> 'awayScore', '')::integer) as away_score,
		max(nullif(ls.raw_json ->> 'homeScore', '')::integer) as home_score,
		max(nullif(ls.raw_json ->> 'awayPlayerId1', ''))::uuid as away_player_1,
		max(nullif(ls.raw_json ->> 'awayPlayerId2', ''))::uuid as away_player_2,
		max(nullif(ls.raw_json ->> 'homePlayerId1', ''))::uuid as home_player_1,
		max(nullif(ls.raw_json ->> 'homePlayerId2', ''))::uuid as home_player_2,
		count(*) filter (where ls.role = 'home') as home_rows,
		count(*) filter (where ls.role = 'away') as away_rows
	from public.lineup_slots ls
	where ls.raw_json is not null
		and ls.raw_json ? 'matchupId'
		and ls.raw_json ? 'gameNumber'
	group by
		nullif(ls.raw_json ->> 'matchupId', '')::uuid,
		nullif(ls.raw_json ->> 'gameNumber', '')::integer
)
select
	ga.matchup_id,
	ga.game_number,
	ga.lineup_event_id,
	ga.event_created_at,
	m.division_id,
	d.season_year,
	d.season_number,
	m.snapshot_date,
	m.home_team_id,
	m.away_team_id,
	ga.match_type,
	ga.home_player_1,
	ga.home_player_2,
	ga.away_player_1,
	ga.away_player_2,
	ga.home_score,
	ga.away_score,
	ga.home_rows,
	ga.away_rows,
	ga.home_rows = 2
		and ga.away_rows = 2
		and ga.home_score is not null
		and ga.away_score is not null
		and ga.home_player_1 is not null
		and ga.home_player_2 is not null
		and ga.away_player_1 is not null
		and ga.away_player_2 is not null as is_complete_game,
	case
		when ga.home_score > ga.away_score then 'home'
		when ga.away_score > ga.home_score then 'away'
		else 'draw'
	end as winner_side,
	abs(coalesce(ga.home_score, 0) - coalesce(ga.away_score, 0)) as point_margin
from game_agg ga
join public.matchups m
	on m.matchup_id = ga.matchup_id
join public.divisions d
	on d.division_id = m.division_id;

create unique index mv_game_events_canonical_matchup_game_uidx
	on analytics.mv_game_events_canonical(matchup_id, game_number);

create index mv_game_events_canonical_division_idx
	on analytics.mv_game_events_canonical(division_id, season_year, season_number);

create index mv_game_events_canonical_match_type_idx
	on analytics.mv_game_events_canonical(match_type);

create index mv_game_events_canonical_complete_idx
	on analytics.mv_game_events_canonical(is_complete_game);

create materialized view analytics.mv_team_game_pairs as
with canonical as (
	select *
	from analytics.mv_game_events_canonical
	where is_complete_game = true
)
select
	c.matchup_id,
	c.game_number,
	c.lineup_event_id,
	c.event_created_at,
	c.division_id,
	c.season_year,
	c.season_number,
	c.snapshot_date,
	c.match_type,
	'home'::text as team_side,
	c.home_team_id as team_id,
	c.away_team_id as opp_team_id,
	c.home_player_1 as player_1_id,
	c.home_player_2 as player_2_id,
	least(c.home_player_1::text, c.home_player_2::text)::uuid as pair_player_low_id,
	greatest(c.home_player_1::text, c.home_player_2::text)::uuid as pair_player_high_id,
	concat_ws(':', least(c.home_player_1::text, c.home_player_2::text), greatest(c.home_player_1::text, c.home_player_2::text)) as pair_key,
	c.home_score as team_score,
	c.away_score as opp_score,
	c.home_score - c.away_score as point_diff,
	c.winner_side = 'home' as won_game
from canonical c
union all
select
	c.matchup_id,
	c.game_number,
	c.lineup_event_id,
	c.event_created_at,
	c.division_id,
	c.season_year,
	c.season_number,
	c.snapshot_date,
	c.match_type,
	'away'::text as team_side,
	c.away_team_id as team_id,
	c.home_team_id as opp_team_id,
	c.away_player_1 as player_1_id,
	c.away_player_2 as player_2_id,
	least(c.away_player_1::text, c.away_player_2::text)::uuid as pair_player_low_id,
	greatest(c.away_player_1::text, c.away_player_2::text)::uuid as pair_player_high_id,
	concat_ws(':', least(c.away_player_1::text, c.away_player_2::text), greatest(c.away_player_1::text, c.away_player_2::text)) as pair_key,
	c.away_score as team_score,
	c.home_score as opp_score,
	c.away_score - c.home_score as point_diff,
	c.winner_side = 'away' as won_game
from canonical c;

create unique index mv_team_game_pairs_matchup_game_side_uidx
	on analytics.mv_team_game_pairs(matchup_id, game_number, team_side);

create index mv_team_game_pairs_team_idx
	on analytics.mv_team_game_pairs(division_id, season_year, season_number, team_id);

create index mv_team_game_pairs_opp_team_idx
	on analytics.mv_team_game_pairs(division_id, season_year, season_number, opp_team_id);

create index mv_team_game_pairs_pair_idx
	on analytics.mv_team_game_pairs(pair_player_low_id, pair_player_high_id);

create index mv_team_game_pairs_pair_key_idx
	on analytics.mv_team_game_pairs(pair_key);

create index mv_team_game_pairs_match_type_idx
	on analytics.mv_team_game_pairs(match_type);

create index mv_team_game_pairs_matchup_game_idx
	on analytics.mv_team_game_pairs(matchup_id, game_number);

create materialized view analytics.mv_pair_baseline_features as
with base as (
	select
		tgp.division_id,
		tgp.season_year,
		tgp.season_number,
		tgp.team_id,
		tgp.pair_player_low_id,
		tgp.pair_player_high_id,
		tgp.pair_key,
		coalesce(lower(tgp.match_type), 'unknown') as match_type,
		tgp.won_game,
		tgp.point_diff,
		tgp.team_score,
		tgp.opp_score,
		tgp.event_created_at
	from analytics.mv_team_game_pairs tgp
),
division_priors as (
	select
		base.division_id,
		base.season_year,
		base.season_number,
		avg(case when base.won_game then 1.0 else 0.0 end)::numeric(10, 6) as division_win_rate_prior,
		avg(
			case
				when base.match_type = 'mixed' then
					case when base.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as mixed_win_rate_prior,
		avg(
			case
				when base.match_type = any(array['female', 'women', 'womens']) then
					case when base.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as female_win_rate_prior,
		avg(
			case
				when base.match_type = any(array['male', 'men', 'mens']) then
					case when base.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as male_win_rate_prior
	from base
	group by base.division_id, base.season_year, base.season_number
),
agg as (
	select
		b.division_id,
		b.season_year,
		b.season_number,
		b.team_id,
		b.pair_player_low_id,
		b.pair_player_high_id,
		b.pair_key,
		count(*)::integer as games_played,
		sum(case when b.won_game then 1 else 0 end)::integer as wins,
		sum(case when b.won_game then 0 else 1 end)::integer as losses,
		avg(case when b.won_game then 1.0 else 0.0 end)::numeric(10, 6) as win_rate,
		avg(b.point_diff::numeric)::numeric(10, 6) as avg_point_diff,
		stddev_pop(b.point_diff::numeric)::numeric(10, 6) as point_diff_volatility,
		avg(b.team_score::numeric)::numeric(10, 6) as avg_points_for,
		avg(b.opp_score::numeric)::numeric(10, 6) as avg_points_against,
		count(*) filter (where b.match_type = 'mixed')::integer as mixed_games,
		sum(
			case
				when b.match_type = 'mixed' and b.won_game then 1
				else 0
			end
		)::integer as mixed_wins,
		avg(
			case
				when b.match_type = 'mixed' then
					case when b.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as mixed_win_rate,
		avg(case when b.match_type = 'mixed' then b.point_diff::numeric else null::numeric end)::numeric(10, 6) as mixed_avg_point_diff,
		count(*) filter (where b.match_type = any(array['female', 'women', 'womens']))::integer as female_games,
		sum(
			case
				when b.match_type = any(array['female', 'women', 'womens']) and b.won_game then 1
				else 0
			end
		)::integer as female_wins,
		avg(
			case
				when b.match_type = any(array['female', 'women', 'womens']) then
					case when b.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as female_win_rate,
		avg(case when b.match_type = any(array['female', 'women', 'womens']) then b.point_diff::numeric else null::numeric end)::numeric(10, 6) as female_avg_point_diff,
		count(*) filter (where b.match_type = any(array['male', 'men', 'mens']))::integer as male_games,
		sum(
			case
				when b.match_type = any(array['male', 'men', 'mens']) and b.won_game then 1
				else 0
			end
		)::integer as male_wins,
		avg(
			case
				when b.match_type = any(array['male', 'men', 'mens']) then
					case when b.won_game then 1.0 else 0.0 end
				else null::numeric
			end
		)::numeric(10, 6) as male_win_rate,
		avg(case when b.match_type = any(array['male', 'men', 'mens']) then b.point_diff::numeric else null::numeric end)::numeric(10, 6) as male_avg_point_diff,
		max(b.event_created_at) as last_seen_at
	from base b
	group by b.division_id, b.season_year, b.season_number, b.team_id, b.pair_player_low_id, b.pair_player_high_id, b.pair_key
)
select
	a.division_id,
	a.season_year,
	a.season_number,
	a.team_id,
	a.pair_player_low_id,
	a.pair_player_high_id,
	a.pair_key,
	a.games_played,
	a.wins,
	a.losses,
	a.win_rate,
	((a.wins::numeric + 8.0 * dp.division_win_rate_prior) / nullif(a.games_played::numeric + 8.0, 0::numeric))::numeric(10, 6) as win_rate_shrunk,
	a.avg_point_diff,
	(1::numeric / (1::numeric + exp((-0.22)::numeric * coalesce(a.avg_point_diff, 0::numeric))))::numeric(10, 6) as pd_win_probability,
	a.point_diff_volatility,
	a.avg_points_for,
	a.avg_points_against,
	dp.division_win_rate_prior,
	dp.mixed_win_rate_prior,
	dp.female_win_rate_prior,
	dp.male_win_rate_prior,
	(1::numeric - exp((-a.games_played::numeric) / 20.0))::numeric(10, 6) as sample_reliability,
	a.mixed_games,
	a.mixed_win_rate,
	(
		(
			a.mixed_wins::numeric +
			4.0 * coalesce(dp.mixed_win_rate_prior, dp.division_win_rate_prior)
		) /
		nullif(a.mixed_games::numeric + 4.0, 0::numeric)
	)::numeric(10, 6) as mixed_win_rate_shrunk,
	(1::numeric / (1::numeric + exp((-0.22)::numeric * coalesce(a.mixed_avg_point_diff, 0::numeric))))::numeric(10, 6) as mixed_pd_win_probability,
	a.mixed_avg_point_diff,
	a.female_games,
	a.female_win_rate,
	(
		(
			a.female_wins::numeric +
			4.0 * coalesce(dp.female_win_rate_prior, dp.division_win_rate_prior)
		) /
		nullif(a.female_games::numeric + 4.0, 0::numeric)
	)::numeric(10, 6) as female_win_rate_shrunk,
	(1::numeric / (1::numeric + exp((-0.22)::numeric * coalesce(a.female_avg_point_diff, 0::numeric))))::numeric(10, 6) as female_pd_win_probability,
	a.female_avg_point_diff,
	a.male_games,
	a.male_win_rate,
	(
		(
			a.male_wins::numeric +
			4.0 * coalesce(dp.male_win_rate_prior, dp.division_win_rate_prior)
		) /
		nullif(a.male_games::numeric + 4.0, 0::numeric)
	)::numeric(10, 6) as male_win_rate_shrunk,
	(1::numeric / (1::numeric + exp((-0.22)::numeric * coalesce(a.male_avg_point_diff, 0::numeric))))::numeric(10, 6) as male_pd_win_probability,
	a.male_avg_point_diff,
	a.last_seen_at
from agg a
join division_priors dp
	on dp.division_id = a.division_id
	and dp.season_year = a.season_year
	and dp.season_number = a.season_number;

create unique index mv_pair_baseline_features_team_pair_uidx
	on analytics.mv_pair_baseline_features(division_id, season_year, season_number, team_id, pair_key);

create index mv_pair_baseline_features_team_idx
	on analytics.mv_pair_baseline_features(team_id, win_rate_shrunk desc);

create index mv_pair_baseline_features_division_idx
	on analytics.mv_pair_baseline_features(division_id, season_year, season_number);

create index mv_pair_baseline_features_players_idx
	on analytics.mv_pair_baseline_features(pair_player_low_id, pair_player_high_id);

create materialized view analytics.mv_pair_vs_pair_features as
with games as (
	select
		c.division_id,
		c.season_year,
		c.season_number,
		c.matchup_id,
		c.game_number,
		coalesce(lower(c.match_type), 'unknown') as match_type,
		least(c.home_player_1::text, c.home_player_2::text)::uuid as home_pair_low_id,
		greatest(c.home_player_1::text, c.home_player_2::text)::uuid as home_pair_high_id,
		least(c.away_player_1::text, c.away_player_2::text)::uuid as away_pair_low_id,
		greatest(c.away_player_1::text, c.away_player_2::text)::uuid as away_pair_high_id,
		c.home_score > c.away_score as home_won,
		c.home_score - c.away_score as home_point_diff,
		c.event_created_at
	from analytics.mv_game_events_canonical c
	where c.is_complete_game = true
),
expanded as (
	select
		g.division_id,
		g.season_year,
		g.season_number,
		g.matchup_id,
		g.game_number,
		g.match_type,
		g.home_pair_low_id as our_pair_low_id,
		g.home_pair_high_id as our_pair_high_id,
		g.away_pair_low_id as opp_pair_low_id,
		g.away_pair_high_id as opp_pair_high_id,
		g.home_won as won_game,
		g.home_point_diff as point_diff,
		g.event_created_at
	from games g
	union all
	select
		g.division_id,
		g.season_year,
		g.season_number,
		g.matchup_id,
		g.game_number,
		g.match_type,
		g.away_pair_low_id as our_pair_low_id,
		g.away_pair_high_id as our_pair_high_id,
		g.home_pair_low_id as opp_pair_low_id,
		g.home_pair_high_id as opp_pair_high_id,
		not g.home_won as won_game,
		-1 * g.home_point_diff as point_diff,
		g.event_created_at
	from games g
),
matchup_agg as (
	select
		e.division_id,
		e.season_year,
		e.season_number,
		e.match_type,
		e.our_pair_low_id,
		e.our_pair_high_id,
		e.opp_pair_low_id,
		e.opp_pair_high_id,
		count(*)::integer as games_played,
		sum(case when e.won_game then 1 else 0 end)::integer as wins,
		sum(case when e.won_game then 0 else 1 end)::integer as losses,
		avg(case when e.won_game then 1.0 else 0.0 end)::numeric(10, 6) as win_rate,
		avg(e.point_diff::numeric)::numeric(10, 6) as avg_point_diff,
		stddev_pop(e.point_diff::numeric)::numeric(10, 6) as point_diff_volatility,
		max(e.event_created_at) as last_seen_at
	from expanded e
	group by e.division_id, e.season_year, e.season_number, e.match_type, e.our_pair_low_id, e.our_pair_high_id, e.opp_pair_low_id, e.opp_pair_high_id
),
priors as (
	select
		e.division_id,
		e.season_year,
		e.season_number,
		e.match_type,
		avg(case when e.won_game then 1.0 else 0.0 end)::numeric(10, 6) as win_rate_prior
	from expanded e
	group by e.division_id, e.season_year, e.season_number, e.match_type
)
select
	ma.division_id,
	ma.season_year,
	ma.season_number,
	ma.match_type,
	ma.our_pair_low_id,
	ma.our_pair_high_id,
	ma.opp_pair_low_id,
	ma.opp_pair_high_id,
	concat_ws(':', ma.our_pair_low_id::text, ma.our_pair_high_id::text) as our_pair_key,
	concat_ws(':', ma.opp_pair_low_id::text, ma.opp_pair_high_id::text) as opp_pair_key,
	ma.games_played,
	ma.wins,
	ma.losses,
	ma.win_rate,
	((ma.wins::numeric + 6.0 * p.win_rate_prior) / nullif(ma.games_played::numeric + 6.0, 0::numeric))::numeric(10, 6) as win_rate_shrunk,
	ma.avg_point_diff,
	(1::numeric / (1::numeric + exp((-0.22)::numeric * coalesce(ma.avg_point_diff, 0::numeric))))::numeric(10, 6) as pd_win_probability,
	ma.point_diff_volatility,
	p.win_rate_prior as division_match_type_prior,
	(1::numeric - exp((-ma.games_played::numeric) / 12.0))::numeric(10, 6) as sample_reliability,
	ma.last_seen_at
from matchup_agg ma
join priors p
	on p.division_id = ma.division_id
	and p.season_year = ma.season_year
	and p.season_number = ma.season_number
	and p.match_type = ma.match_type;

create unique index mv_pair_vs_pair_features_uidx
	on analytics.mv_pair_vs_pair_features(
		division_id,
		season_year,
		season_number,
		match_type,
		our_pair_low_id,
		our_pair_high_id,
		opp_pair_low_id,
		opp_pair_high_id
	);

create index mv_pair_vs_pair_features_our_pair_idx
	on analytics.mv_pair_vs_pair_features(division_id, season_year, season_number, our_pair_low_id, our_pair_high_id);

create index mv_pair_vs_pair_features_opp_pair_idx
	on analytics.mv_pair_vs_pair_features(division_id, season_year, season_number, opp_pair_low_id, opp_pair_high_id);

create index mv_pair_vs_pair_features_winrate_idx
	on analytics.mv_pair_vs_pair_features(division_id, season_year, season_number, win_rate_shrunk desc);

create materialized view analytics.mv_opponent_pairing_scenarios as
with team_matchup_pairs as (
	select
		tgp.division_id,
		tgp.season_year,
		tgp.season_number,
		tgp.team_id,
		tgp.matchup_id,
		coalesce(max(m.scheduled_time), max(tgp.event_created_at)) as matchup_ts,
		coalesce(lower(tgp.match_type), 'unknown') as match_type,
		tgp.pair_key,
		tgp.pair_player_low_id,
		tgp.pair_player_high_id,
		count(*)::integer as games_with_pair
	from analytics.mv_team_game_pairs tgp
	left join public.matchups m
		on m.matchup_id = tgp.matchup_id
	group by
		tgp.division_id,
		tgp.season_year,
		tgp.season_number,
		tgp.team_id,
		tgp.matchup_id,
		coalesce(lower(tgp.match_type), 'unknown'),
		tgp.pair_key,
		tgp.pair_player_low_id,
		tgp.pair_player_high_id
),
matchup_scenarios as (
	select
		tmp.division_id,
		tmp.season_year,
		tmp.season_number,
		tmp.team_id,
		tmp.matchup_id,
		tmp.matchup_ts,
		string_agg(
			format('%s~%s~%s', tmp.match_type, tmp.pair_key, tmp.games_with_pair),
			'|' order by tmp.match_type, tmp.pair_key
		) as scenario_signature,
		jsonb_agg(
			jsonb_build_object(
				'match_type', tmp.match_type,
				'pair_key', tmp.pair_key,
				'pair_player_low_id', tmp.pair_player_low_id,
				'pair_player_high_id', tmp.pair_player_high_id,
				'games_with_pair', tmp.games_with_pair
			)
			order by tmp.match_type, tmp.pair_key
		) as scenario_pairs
	from team_matchup_pairs tmp
	group by tmp.division_id, tmp.season_year, tmp.season_number, tmp.team_id, tmp.matchup_id, tmp.matchup_ts
),
ranked as (
	select
		ms.division_id,
		ms.season_year,
		ms.season_number,
		ms.team_id,
		ms.matchup_id,
		ms.matchup_ts,
		ms.scenario_signature,
		ms.scenario_pairs,
		row_number() over (
			partition by ms.division_id, ms.season_year, ms.season_number, ms.team_id
			order by ms.matchup_ts desc nulls last, ms.matchup_id desc
		) as recency_rank,
		count(*) over (
			partition by ms.division_id, ms.season_year, ms.season_number, ms.team_id
		) as total_matchups
	from matchup_scenarios ms
),
weighted as (
	select
		r.division_id,
		r.season_year,
		r.season_number,
		r.team_id,
		r.matchup_id,
		r.matchup_ts,
		r.scenario_signature,
		r.scenario_pairs,
		r.recency_rank,
		r.total_matchups,
		case
			when r.recency_rank <= 3 then 0.65 / 3.0
			when r.recency_rank <= 6 then 0.30 / 3.0
			else 0.05 / greatest((r.total_matchups - 6)::numeric, 1::numeric)
		end as recency_weight
	from ranked r
),
aggregated as (
	select
		w.division_id,
		w.season_year,
		w.season_number,
		w.team_id,
		md5(w.scenario_signature) as scenario_id,
		w.scenario_signature,
		(array_agg(w.scenario_pairs order by w.matchup_ts desc nulls last))[1] as scenario_pairs,
		count(*)::integer as scenario_occurrences,
		sum(w.recency_weight)::numeric(12, 8) as sample_weight,
		min(w.recency_rank)::integer as best_recency_rank,
		max(w.matchup_ts) as last_seen_at,
		bool_or(w.recency_rank <= 3) as seen_in_last_3,
		bool_or(w.recency_rank <= 6) as seen_in_last_6
	from weighted w
	group by w.division_id, w.season_year, w.season_number, w.team_id, w.scenario_signature
)
select
	division_id,
	season_year,
	season_number,
	team_id,
	scenario_id,
	scenario_signature,
	scenario_pairs,
	scenario_occurrences,
	sample_weight,
	(sample_weight / nullif(sum(sample_weight) over (partition by division_id, season_year, season_number, team_id), 0::numeric))::numeric(12, 8) as scenario_probability,
	best_recency_rank,
	last_seen_at,
	seen_in_last_3,
	seen_in_last_6,
	row_number() over (
		partition by division_id, season_year, season_number, team_id
		order by sample_weight desc, last_seen_at desc nulls last
	) as scenario_rank
from aggregated a;

create unique index mv_opponent_pairing_scenarios_team_scenario_uidx
	on analytics.mv_opponent_pairing_scenarios(division_id, season_year, season_number, team_id, scenario_id);

create index mv_opponent_pairing_scenarios_team_rank_idx
	on analytics.mv_opponent_pairing_scenarios(division_id, season_year, season_number, team_id, scenario_rank);

create index mv_opponent_pairing_scenarios_team_prob_idx
	on analytics.mv_opponent_pairing_scenarios(team_id, scenario_probability desc);

create view analytics.vw_game_events_canonical as
select
	matchup_id,
	game_number,
	lineup_event_id,
	event_created_at,
	division_id,
	season_year,
	season_number,
	snapshot_date,
	home_team_id,
	away_team_id,
	match_type,
	home_player_1,
	home_player_2,
	away_player_1,
	away_player_2,
	home_score,
	away_score,
	home_rows,
	away_rows,
	is_complete_game,
	winner_side,
	point_margin
from analytics.mv_game_events_canonical;

create view analytics.vw_team_game_pairs as
select
	matchup_id,
	game_number,
	lineup_event_id,
	event_created_at,
	division_id,
	season_year,
	season_number,
	snapshot_date,
	match_type,
	team_side,
	team_id,
	opp_team_id,
	player_1_id,
	player_2_id,
	pair_player_low_id,
	pair_player_high_id,
	pair_key,
	team_score,
	opp_score,
	point_diff,
	won_game
from analytics.mv_team_game_pairs;

create view analytics.vw_pair_baseline_features as
select
	division_id,
	season_year,
	season_number,
	team_id,
	pair_player_low_id,
	pair_player_high_id,
	pair_key,
	games_played,
	wins,
	losses,
	win_rate,
	win_rate_shrunk,
	avg_point_diff,
	pd_win_probability,
	point_diff_volatility,
	avg_points_for,
	avg_points_against,
	division_win_rate_prior,
	mixed_win_rate_prior,
	female_win_rate_prior,
	male_win_rate_prior,
	sample_reliability,
	mixed_games,
	mixed_win_rate,
	mixed_win_rate_shrunk,
	mixed_pd_win_probability,
	mixed_avg_point_diff,
	female_games,
	female_win_rate,
	female_win_rate_shrunk,
	female_pd_win_probability,
	female_avg_point_diff,
	male_games,
	male_win_rate,
	male_win_rate_shrunk,
	male_pd_win_probability,
	male_avg_point_diff,
	last_seen_at
from analytics.mv_pair_baseline_features;

create view analytics.vw_pair_vs_pair_features as
select
	division_id,
	season_year,
	season_number,
	match_type,
	our_pair_low_id,
	our_pair_high_id,
	opp_pair_low_id,
	opp_pair_high_id,
	our_pair_key,
	opp_pair_key,
	games_played,
	wins,
	losses,
	win_rate,
	win_rate_shrunk,
	avg_point_diff,
	pd_win_probability,
	point_diff_volatility,
	division_match_type_prior,
	sample_reliability,
	last_seen_at
from analytics.mv_pair_vs_pair_features;

create view analytics.vw_opponent_pairing_scenarios as
select
	division_id,
	season_year,
	season_number,
	team_id,
	scenario_id,
	scenario_signature,
	scenario_pairs,
	scenario_occurrences,
	sample_weight,
	scenario_probability,
	best_recency_rank,
	last_seen_at,
	seen_in_last_3,
	seen_in_last_6,
	scenario_rank
from analytics.mv_opponent_pairing_scenarios;

create or replace function analytics.refresh_lineup_analytics_views()
returns void
language plpgsql
as $function$
begin
	refresh materialized view analytics.mv_game_events_canonical;
	refresh materialized view analytics.mv_team_game_pairs;
	refresh materialized view analytics.mv_opponent_pairing_scenarios;
	refresh materialized view analytics.mv_pair_baseline_features;
	refresh materialized view analytics.mv_pair_vs_pair_features;
end;
$function$;

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

comment on materialized view analytics.mv_game_events_canonical is 'lineup_analytics_v2';
comment on materialized view analytics.mv_team_game_pairs is 'lineup_analytics_v2';
comment on materialized view analytics.mv_pair_baseline_features is 'lineup_analytics_v2';
comment on materialized view analytics.mv_pair_vs_pair_features is 'lineup_analytics_v2';
comment on materialized view analytics.mv_opponent_pairing_scenarios is 'lineup_analytics_v2';
comment on view analytics.vw_game_events_canonical is 'lineup_analytics_v2';
comment on view analytics.vw_team_game_pairs is 'lineup_analytics_v2';
comment on view analytics.vw_pair_baseline_features is 'lineup_analytics_v2';
comment on view analytics.vw_pair_vs_pair_features is 'lineup_analytics_v2';
comment on view analytics.vw_opponent_pairing_scenarios is 'lineup_analytics_v2';
comment on function analytics.fn_lineup_lab_feature_bundle(uuid, integer, integer, uuid, uuid, uuid[], integer, uuid, timestamptz) is 'lineup_analytics_v2';
comment on function analytics.refresh_lineup_analytics_views() is 'lineup_analytics_v2';
