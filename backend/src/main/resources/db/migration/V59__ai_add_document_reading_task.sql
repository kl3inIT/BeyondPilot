-- A second task: copying the text of a page that is only a picture, such as a slide of a deck (BEY-39). It has its
-- own model, which must read images, and its calls are recorded apart from matching's.
alter table ai_task_model
    drop constraint ai_task_model_task,
    add constraint ai_task_model_task check (task in ('matching', 'document_reading'));

insert into ai_task_model (task) values ('document_reading');
