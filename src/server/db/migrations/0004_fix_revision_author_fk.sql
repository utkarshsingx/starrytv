-- 0004 — fix a contradictory foreign key on review_revisions.created_by_user_id
--
-- 0003 declared it `NOT NULL ... references users on delete set null`. Those two
-- clauses cannot both hold: when a user is deleted, the FK tries to set the
-- column NULL, which the NOT NULL rejects — so deleting any user who ever
-- authored a revision fails outright.
--
-- The fix follows the same reasoning as review_actions.actor_user_id, which
-- deliberately carries no FK: the revision's author id should survive account
-- erasure as a plain value. The revision row is still removed when appropriate,
-- via the review_id cascade (deleting a user cascades to their reviews, and a
-- review cascades to its revisions). Dropping the FK removes the conflict
-- without losing that behaviour.

alter table ugc.review_revisions
  drop constraint if exists review_revisions_created_by_user_id_fkey;
