CREATE OR REPLACE FUNCTION public.prevent_protected_tutorial_blank_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protected_user_id uuid := 'e7a93a94-878e-45de-97eb-5bae42052044'::uuid;
  old_has_content boolean;
  new_has_content boolean;
BEGIN
  IF NEW.user_id <> protected_user_id THEN
    RETURN NEW;
  END IF;

  old_has_content :=
    COALESCE(jsonb_array_length(COALESCE(OLD.data->'products', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(OLD.data->'clients', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(OLD.data->'orders', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(OLD.data->'casualSales', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(OLD.data->'deliveries', '[]'::jsonb)), 0) > 0;

  new_has_content :=
    COALESCE(jsonb_array_length(COALESCE(NEW.data->'products', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(NEW.data->'clients', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(NEW.data->'orders', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(NEW.data->'casualSales', '[]'::jsonb)), 0) > 0 OR
    COALESCE(jsonb_array_length(COALESCE(NEW.data->'deliveries', '[]'::jsonb)), 0) > 0;

  IF old_has_content AND NOT new_has_content THEN
    NEW.data := OLD.data;
    NEW.version := OLD.version;
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_protected_tutorial_blank_state ON public.user_state;
CREATE TRIGGER prevent_protected_tutorial_blank_state
BEFORE UPDATE OF data ON public.user_state
FOR EACH ROW
EXECUTE FUNCTION public.prevent_protected_tutorial_blank_state();