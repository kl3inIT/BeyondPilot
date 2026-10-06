-- Who sent a solution for review, so an operator knows whom the decision goes back to. The account that created a
-- draft is not always the one that submits it, so the solutions submitted before this column exists keep it empty:
-- their sender is unknown, and nothing is filled in from created_by_account_id.
alter table solution
    add column submitted_by_account_id uuid references identity_account (id);
