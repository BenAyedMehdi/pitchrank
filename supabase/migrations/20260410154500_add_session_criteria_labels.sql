alter table public.sessions
add column criteria_labels text[];

update public.sessions
set criteria_labels = array['Criteria 1', 'Criteria 2']
where criteria_labels is null;

alter table public.sessions
add constraint sessions_criteria_labels_length_check
check (
  criteria_labels is null
  or array_length(criteria_labels, 1) >= 2
);

alter table public.sessions
add constraint sessions_criteria_labels_non_empty_check
check (
  criteria_labels is null
  or array_position(criteria_labels, '') is null
);

alter table public.votes
add column criteria_scores integer[];

update public.votes
set criteria_scores = array_remove(
  array[
    score_technicality,
    score_pitch,
    score_functionality,
    score_innovation
  ],
  null
)
where criteria_scores is null;

alter table public.votes
alter column criteria_scores set not null;

alter table public.votes
add constraint votes_criteria_scores_length_check
check (array_length(criteria_scores, 1) >= 2);

alter table public.votes
add constraint votes_criteria_scores_range_check
check (criteria_scores <@ array[1, 2, 3, 4, 5]::integer[]);

alter table public.votes
alter column score_technicality drop not null;

alter table public.votes
alter column score_pitch drop not null;

alter table public.votes
alter column score_functionality drop not null;

alter table public.votes
alter column score_innovation drop not null;

alter table public.votes
drop column total_score;

alter table public.votes
add column total_score integer generated always as (
  coalesce(score_technicality, 0) +
  coalesce(score_pitch, 0) +
  coalesce(score_functionality, 0) +
  coalesce(score_innovation, 0)
) stored;
