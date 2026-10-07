-- A budget keeps the currency its organization writes it in (BEY-75). The old platform priced some use cases in
-- Vietnamese đồng ("VND 200M"), and an amount is never converted on the way in: the amounts are whole units of
-- `currency`, wide enough for đồng. Ordering the public list by budget converts to US dollars at a configured rate
-- and shows no converted amount.
alter table use_case
    add column currency text not null default 'USD' check (currency in ('USD', 'VND')),
    alter column budget_min type bigint,
    alter column budget_max type bigint;
