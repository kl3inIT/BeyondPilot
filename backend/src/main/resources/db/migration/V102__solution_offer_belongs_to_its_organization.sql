-- Every offer belongs to the organization that gives it, and only its solutions come with it (BEY-217). GenAI Fund's
-- list, which any solution could choose, put a partner's credits on the card of a solution that had none of them.
-- What GenAI Fund arranged with the partner is a mark an operator sets instead.
alter table offer add column from_genai_fund boolean not null default false;

-- An offer of the old list goes to each organization whose solutions come with it, as a copy of its own marked as
-- arranged by GenAI Fund, and those solutions come with the copy. One no solution comes with has no organization to
-- go to and is deleted.
create temporary table offer_move on commit drop as
select o.id as list_offer_id, s.organization_id, gen_random_uuid() as offer_id
from offer o
join solution_offer so on so.offer_id = o.id
join solution s on s.id = so.solution_id
where o.organization_id is null
group by o.id, s.organization_id;

insert into offer (id, organization_id, title, url, closed_at, from_genai_fund, created_at, updated_at)
select m.offer_id, m.organization_id, o.title, o.url, o.closed_at, true, o.created_at, now()
from offer_move m
join offer o on o.id = m.list_offer_id;

update solution_offer so
set offer_id = m.offer_id
from offer_move m, solution s
where so.offer_id = m.list_offer_id and s.id = so.solution_id and s.organization_id = m.organization_id;

delete from offer where organization_id is null;

-- The titles of an organization's offers are kept apart by the service, as before.
drop index offer_title_key;
alter table offer alter column organization_id set not null;
