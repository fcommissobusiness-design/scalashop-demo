DELETE FROM public.user_state WHERE user_id='08838a09-78ed-4df4-ac4c-95d25c7e111d';
DELETE FROM public.user_roles WHERE user_id='08838a09-78ed-4df4-ac4c-95d25c7e111d';
DELETE FROM public.deleted_demo_users WHERE original_user_id='08838a09-78ed-4df4-ac4c-95d25c7e111d';
DELETE FROM auth.users WHERE id='08838a09-78ed-4df4-ac4c-95d25c7e111d';