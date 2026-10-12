-- The title an operator gives a date the application window puts on the program's timeline: the opening, the close
-- and the day outcomes are due. Null shows the default words in the reader's language. The dates stay the window's.
alter table program
    add column applications_open_title  text check (char_length(applications_open_title) between 1 and 160),
    add column applications_close_title text check (char_length(applications_close_title) between 1 and 160),
    add column outcomes_due_title       text check (char_length(outcomes_due_title) between 1 and 160);
