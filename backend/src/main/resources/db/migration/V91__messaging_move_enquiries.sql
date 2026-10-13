-- Conversations replace the messages sent through a talent profile (talent_enquiry), which ended in an exchange of
-- email addresses. Every enquiry becomes a conversation with its text as the first message.
--
-- Kept: who wrote and for which organization, who was written to, the profile and the name it is shown by, the text,
-- the status, and when the enquiry was written, answered and reminded. A conversation keeps the identifier of the
-- enquiry it comes from.
-- Converted: a person has at most one conversation that waits or is open with a profile, so when one person has
-- several such enquiries to the same profile, they become one conversation: it keeps the identifier of the latest,
-- starts when the earliest was written, and holds every text as a message, in the order they were written. It is
-- open when any of them was accepted, since the two sides had agreed to talk, and keeps that acceptance's time;
-- otherwise it waits. An enquiry that was declined, reported or closed stays a conversation of its own.
-- Dropped: an enquiry's topic and the name its sender signed it with, which a conversation does not have; the status
-- and answer time of an enquiry folded into another, beyond the acceptance that opened the conversation; what a text
-- holds beyond 2000 characters, the length of a message; an enquiry whose text is blank, which has no message to
-- become; an operator's wording of the emails this flow sent; and the table. The email log and the audit trail keep
-- what they recorded.

-- One row per enquiry that has a text, with the conversation it goes to.
create temporary table messaging_moved as
with legacy as (
    select e.id,
           e.profile_id             as talent_profile_id,
           p.name                   as subject_name,
           e.sender_account_id      as starter_account_id,
           e.sender_organization_id as starter_organization_id,
           p.account_id             as recipient_account_id,
           e.status,
           e.created_at,
           e.answered_at,
           e.reminded_at,
           left(e.message, 2000)    as body
    from talent_enquiry e
             join talent_profile p on p.id = e.profile_id
    where e.message ~ '\S'
),
-- A database that ran V90 before this migration may already hold a conversation that waits or is open for the same
-- person and profile. The enquiry then cannot wait or be open beside it, and becomes a closed conversation of its
-- own.
placed as (
    select l.id, l.talent_profile_id, l.subject_name, l.starter_account_id, l.starter_organization_id,
           l.recipient_account_id, l.created_at, l.answered_at, l.reminded_at, l.body,
           case
               when l.status in ('pending', 'accepted') and exists (
                   select 1
                   from messaging_conversation c
                   where c.starter_account_id = l.starter_account_id
                     and c.status in ('pending', 'accepted')
                     and c.talent_profile_id = l.talent_profile_id) then 'closed'
               else l.status
               end as status
    from legacy l
)
select p.*,
       case
           when p.status in ('pending', 'accepted') then first_value(p.id) over (
               partition by p.starter_account_id, p.talent_profile_id, p.status in ('pending', 'accepted')
               order by p.created_at desc, p.id desc)
           else p.id
           end as conversation_id
from placed p;

insert into messaging_conversation (id, kind, talent_profile_id, subject_name, starter_account_id,
                                    starter_organization_id, recipient_account_id, status, created_at, answered_at,
                                    reminded_at, last_message_at)
select m.id,
       'talent',
       m.talent_profile_id,
       m.subject_name,
       m.starter_account_id,
       m.starter_organization_id,
       m.recipient_account_id,
       coalesce(accepted.status, m.status),
       (select min(folded.created_at) from messaging_moved folded where folded.conversation_id = m.id),
       coalesce(accepted.answered_at, m.answered_at),
       m.reminded_at,
       (select max(folded.created_at) from messaging_moved folded where folded.conversation_id = m.id)
from messaging_moved m
         -- The latest acceptance among the enquiries that become this conversation, when there is one.
         left join lateral (select folded.status, folded.answered_at
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

-- The person behind the profile has read what was written by the time they accepted. Without this every
-- conversation that was accepted would open with unread messages. A text written after the acceptance, which
-- waited for an answer of its own, stays unread.
insert into messaging_read (conversation_id, account_id, read_seq)
select c.id, c.recipient_account_id, read.seq
from messaging_conversation c
         cross join lateral (select max(written.seq) as seq
                             from messaging_message written
                             where written.conversation_id = c.id
                               and written.created_at <= c.answered_at) read
where c.id in (select m.conversation_id from messaging_moved m)
  and c.status = 'accepted'
  and read.seq is not null;

drop table messaging_moved;

-- The wording operators gave the emails that are no longer sent.
delete
from email_template
where kind in ('talent_enquiry', 'talent_enquiry_reminder', 'talent_introduction', 'talent_enquiry_declined',
               'talent_enquiry_closed');

drop table talent_enquiry;
