-- Проверка, зарегистрирован ли email (для API регистрации с service_role).
-- Выполнить в Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.auth_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email IS NOT NULL
      AND lower(trim(email)) = lower(trim(check_email))
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO service_role;
