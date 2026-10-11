-- A question answered by several of its choices (BEY-129), beside the one answered by one. Its choices are kept in
-- `options`, as a `single_choice` question's are.
alter table program_question drop constraint program_question_kind_check;
alter table program_question
    add constraint program_question_kind_check
        check (kind in ('short_text', 'long_text', 'single_choice', 'multi_choice', 'file', 'link', 'confirm'));
