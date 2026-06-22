ALTER FUNCTION public.prevent_protected_tutorial_blank_state() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.prevent_protected_tutorial_blank_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_protected_tutorial_blank_state() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_protected_tutorial_blank_state() FROM authenticated;