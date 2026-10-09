-- A model's price follows the bundled catalog unless an operator sets one (BEY-103): a row without prices is
-- charged at the catalog's, read when a call is made, and a row with prices keeps its own. Until now the catalog's
-- prices were copied into the row when the model was added, so every price stored so far is a copy, not a choice:
-- read on 9 October 2026, the prices on staging all equal the catalog's and production has no model yet. They are
-- emptied here so that these models follow the catalog from now on. Usage rows keep the prices of their time.
update ai_model
set input_price = null,
    output_price = null,
    cached_input_price = null;
