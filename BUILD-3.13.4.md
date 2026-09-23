# GGC Build 3.13.4 — Delete Competition fix
Built from stable 3.13.3.
- Delete Competition now physically removes the competition from state.comps.
- Removes all scorecards belonging to the deleted competition.
- Retains a compact audit record of the deletion.
- Clears the saved active competition pointer when deleting that competition.
- Immediately saves the resulting state to Supabase instead of relying only on delayed autosave.
- No changes to scoring, societies, auth, or Realtime subscription.
