-- A third task: suggesting a shortlist tier for each submission to a program, with the evidence behind it (BEY-234).
-- It starts on the model matching uses, which judges the same material, until an operator chooses another.
alter table ai_task_model
    drop constraint ai_task_model_task,
    add constraint ai_task_model_task check (task in ('matching', 'document_reading', 'evaluation'));

insert into ai_task_model (task, model_id)
select 'evaluation', model_id from ai_task_model where task = 'matching';
