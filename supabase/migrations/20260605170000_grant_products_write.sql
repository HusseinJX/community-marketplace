-- products previously had only GRANT SELECT to anon (it was written solely by
-- the connector-agent's service role via Composio sync). Phase 2 added in-app
-- product writes through the anon-key client (vendor product CRUD + AI capture),
-- so anon/authenticated now need write privileges too. RLS policy already open.
GRANT INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
