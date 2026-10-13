-- Conversations replace the two flows that ended in an exchange of email addresses: the messages sent through a talent
-- profile (talent_enquiry) and the requests for an introduction to the organization behind a solution
-- (introduction_request). Every row of both becomes a conversation with its text as the first message.
--
-- Kept: who wrote and for which organization, who or which organization was written to, the profile or solution and
-- the name it is shown by, the text, the status, and when the row was written, answered and reminded; for an
-- introduction also who answered it. A conversation keeps the identifier of the row it comes from.
-- Converted: an introduction's status 'replied' becomes 'accepted'. A person has at most one conversation that waits
-- or is open with a profile or a solution, so when one person has several such rows for the same one, they become
-- one conversation: it keeps the identifier of the latest, starts when the earliest was written, and holds every text
-- as a message, in the order they were written. It is open when any of the rows was accepted, since the two sides
-- had agreed to talk, and keeps that acceptance's time and answerer; otherwise it waits. A row that was declined,
-- reported or closed stays a conversation of its own. A request for an introduction never closed, where a request in
-- a conversation closes after fourteen days: one that still waits starts those days when this migration runs, so its
-- provider has them to answer it. Its message keeps the time it was written. An enquiry already closed after
-- fourteen days, and keeps its time.
-- Dropped: an enquiry's topic and the name its sender signed it with, which a conversation does not have; the status
-- and answer time of a row folded into another, beyond the acceptance that opened the conversation; what a text holds
-- beyond 2000 characters, the length of a
-- message; a row whose text is blank, which has no message to become; an operator's wording of the emails these flows
-- sent; and the two tables. The email log and the audit trail keep what they recorded.

-- One row per enquiry and request that has a text, with the conversation it goes to.
create temporary table messaging_moved as
with legacy as (
    select 'talent'                 as kind,
           e.id,
           e.profile_id             as talent_profile_id,
           cast(null as uuid)       as solution_id,
           p.name                   as subject_name,
           e.sender_account_id      as starter_account_id,
           e.sender_organization_id as starter_organization_id,
           p.account_id             as recipient_account_id,
           cast(null as uuid)       as recipient_organization_id,
           e.status,
           e.created_at,
           e.answered_at,
           cast(null as uuid)       as answered_by_account_id,
           e.reminded_at,
           left(e.message, 2000)    as body
    from talent_enquiry e
             join talent_profile p on p.id = e.profile_id
    where e.message ~ '\S'
    union all
    select 'solution',
           i.id,
           null,
           i.solution_id,
           i.solution_name,
           i.sender_account_id,
           i.sender_organization_id,
           null,
           i.provider_organization_id,
           case i.status when 'replied' then 'accepted' else i.status end,
           i.created_at,
           i.answered_at,
           i.answered_by_account_id,
           null,
           left(i.message, 2000)
    from introduction_request i
    where i.message ~ '\S'
),
-- A database that ran V87 before this migration may already hold a conversation that waits or is open for the same
-- person and subject. The row then cannot wait or be open beside it, and becomes a closed conversation of its own.
placed as (
    select l.kind, l.id, l.talent_profile_id, l.solution_id, l.subject_name, l.starter_account_id,
           l.starter_organization_id, l.recipient_account_id, l.recipient_organization_id, l.created_at, l.answered_at,
           l.answered_by_account_id, l.reminded_at, l.body,
           case
               when l.status in ('pending', 'accepted') and exists (
                   select 1
                   from messaging_conversation c
                   where c.starter_account_id = l.starter_account_id
                     and c.status in ('pending', 'accepted')
                     and (c.talent_profile_id = l.talent_profile_id or c.solution_id = l.solution_id)) then 'closed'
               else l.status
               end as status
    from legacy l
)
select p.*,
       case
           when p.status in ('pending', 'accepted') then first_value(p.id) over (
               partition by p.kind, p.starter_account_id, coalesce(p.talent_profile_id, p.solution_id),
                   p.status in ('pending', 'accepted')
               order by p.created_at desc, p.id desc)
           else p.id
           end as conversation_id
from placed p;

insert into messaging_conversation (id, kind, talent_profile_id, solution_id, subject_name, starter_account_id,
                                    starter_organization_id, recipient_account_id, recipient_organization_id, status,
                                    created_at, answered_at, answered_by_account_id, reminded_at, last_message_at)
select m.id,
       m.kind,
       m.talent_profile_id,
       m.solution_id,
       m.subject_name,
       m.starter_account_id,
       m.starter_organization_id,
       m.recipient_account_id,
       m.recipient_organization_id,
       coalesce(accepted.status, m.status),
       case
           when m.kind = 'solution' and coalesce(accepted.status, m.status) = 'pending' then now()
           else (select min(folded.created_at) from messaging_moved folded where folded.conversation_id = m.id)
           end,
       coalesce(accepted.answered_at, m.answered_at),
       coalesce(accepted.answered_by_account_id, m.answered_by_account_id),
       m.reminded_at,
       (select max(folded.created_at) from messaging_moved folded where folded.conversation_id = m.id)
from messaging_moved m
         -- The latest acceptance among the rows that become this conversation, when there is one.
         left join lateral (select folded.status, folded.answered_at, folded.answered_by_account_id
                            from messaging_moved folded
                            where folded.conversation_id = m.id
                              and folded.status = 'accepted'
                            order by folded.created_at desc, folded.id desc
                            limit 1) accepted on true
where m.id = m.conversation_id;

-- In the order they were written, so the sequence that orders the messages of a conversation follows time.
insert into messaging_message (id, conversation_id, sender_account_id, body, created_at)
select gen_random_uuid(), m.conversation_id, m.starter_account_id, m.body, m.created_at
from messaging_moved m
order by m.created_at, m.id;

-- Whoever accepted has read what was written by then: the person behind the profile, or the owner who answered for
-- the provider. Without this every conversation that was accepted would open with unread messages. A text written
-- after the acceptance, which waited for an answer of its own, stays unread.
insert into messaging_read (conversation_id, account_id, read_seq)
select c.id,
       coalesce(c.recipient_account_id, c.answered_by_account_id),
       read.seq
from messaging_conversation c
         cross join lateral (select max(written.seq) as seq
                             from messaging_message written
                             where written.conversation_id = c.id
                               and written.created_at <= c.answered_at) read
where c.id in (select m.conversation_id from messaging_moved m)
  and c.status = 'accepted'
  and read.seq is not null
  and coalesce(c.recipient_account_id, c.answered_by_account_id) is not null;

drop table messaging_moved;

-- The wording operators gave the emails that are no longer sent.
delete
from email_template
where kind in ('talent_enquiry', 'talent_enquiry_reminder', 'talent_introduction', 'talent_enquiry_declined',
               'talent_enquiry_closed', 'introduction_request', 'introduction_made', 'introduction_declined');

drop table talent_enquiry;
drop table introduction_request;
