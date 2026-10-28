-- admin-payment-proof verifies the caller's current membership with a server
-- client. RLS bypass alone does not grant access to the membership table.
-- Grant only the column used by the authorization lookup, without mutations.
GRANT SELECT (user_id) ON public.admin_users TO service_role;
NOTIFY pgrst, 'reload schema';
