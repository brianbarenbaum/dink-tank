with corrected_matchups as (
	select
		m.matchup_id,
		((m.scheduled_time at time zone 'UTC') at time zone 'America/New_York') as corrected_scheduled_time
	from public.matchups m
	join public.divisions d on d.division_id = m.division_id
	join public.regions r on r.region_id = d.region_id
	where m.scheduled_time is not null
		and upper(replace(coalesce(r.location, ''), ' ', '')) = 'NJ/PA'
)
update public.matchups m
set
	scheduled_time = c.corrected_scheduled_time,
	updated_at = now()
from corrected_matchups c
where m.matchup_id = c.matchup_id
	and m.scheduled_time is distinct from c.corrected_scheduled_time;
