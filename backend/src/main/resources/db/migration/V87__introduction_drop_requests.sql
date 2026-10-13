-- The request for an introduction to a solution's provider is removed (BEY-172): the brief never asked for it, the
-- action had left the solution page, and no request was ever sent in any environment. Its emails are deleted with
-- it; none was sent, and no operator had reworded a template.
drop table introduction_request;

delete from email_template where kind in ('introduction_request', 'introduction_made', 'introduction_declined');
