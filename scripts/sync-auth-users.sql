-- Synchroniseer users tabel met Supabase Auth
-- Dit zorgt ervoor dat users in de users tabel automatisch gelinkt worden aan auth.users

-- 1. Functie om user aan te maken in users tabel na signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, status, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'active',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger op auth.users voor nieuwe users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Functie om user te updaten in users tabel wanneer auth.users update
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET 
    email = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger op auth.users voor updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 5. Functie om user te verwijderen uit users tabel wanneer auth.users verwijderd wordt
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger op auth.users voor deletes
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- 7. Functie om auth user aan te maken wanneer user wordt toegevoegd aan public.users
CREATE OR REPLACE FUNCTION public.create_auth_user_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  temp_password TEXT;
  auth_user_id UUID;
BEGIN
  -- Check of er al een auth user bestaat met dit email
  SELECT id INTO auth_user_id 
  FROM auth.users 
  WHERE email = NEW.email 
  LIMIT 1;
  
  IF auth_user_id IS NULL THEN
    -- Genereer een random wachtwoord (16 karakters)
    temp_password := encode(gen_random_bytes(12), 'base64');
    
    -- Maak auth user aan via auth.users tabel
    -- Note: Dit is een workaround omdat we geen direct access hebben tot auth.admin API
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      aud,
      role
    ) VALUES (
      NEW.id,
      '00000000-0000-0000-0000-000000000000',
      NEW.email,
      crypt(temp_password, gen_salt('bf')),
      NOW(), -- Auto-confirm email
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', NEW.full_name, 'role', NEW.role),
      NOW(),
      NOW(),
      '',
      'authenticated',
      'authenticated'
    );
    
    RAISE NOTICE 'Created auth user for % with temporary password', NEW.email;
  ELSE
    -- Update public.users id om te matchen met bestaande auth user
    NEW.id := auth_user_id;
    RAISE NOTICE 'Linked user % to existing auth user %', NEW.email, auth_user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger op public.users voor nieuwe users (BEFORE INSERT)
DROP TRIGGER IF EXISTS on_public_user_created ON public.users;
CREATE TRIGGER on_public_user_created
  BEFORE INSERT ON public.users
  FOR EACH ROW 
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION public.create_auth_user_for_new_user();

-- 9. Link bestaande users in users tabel aan auth.users (voor gemigreerde data)
-- Dit script zoekt naar users met email die nog niet gelinkt zijn en maakt auth users aan
DO $$
DECLARE
  user_record RECORD;
  auth_user_id UUID;
  temp_password TEXT;
BEGIN
  FOR user_record IN 
    SELECT id, email, full_name, role 
    FROM public.users 
    WHERE id NOT IN (SELECT id FROM auth.users)
    AND email IS NOT NULL
  LOOP
    -- Check of er al een auth user bestaat met dit email
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = user_record.email 
    LIMIT 1;
    
    IF auth_user_id IS NOT NULL THEN
      -- Update de user record met de correcte auth user id
      UPDATE public.users 
      SET id = auth_user_id 
      WHERE id = user_record.id;
      
      RAISE NOTICE 'Linked user % to existing auth user %', user_record.email, auth_user_id;
    ELSE
      -- Maak auth user aan voor bestaande user
      temp_password := encode(gen_random_bytes(12), 'base64');
      
      BEGIN
        INSERT INTO auth.users (
          id,
          instance_id,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          aud,
          role
        ) VALUES (
          user_record.id,
          '00000000-0000-0000-0000-000000000000',
          user_record.email,
          crypt(temp_password, gen_salt('bf')),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', user_record.full_name, 'role', user_record.role),
          NOW(),
          NOW(),
          '',
          'authenticated',
          'authenticated'
        );
        
        RAISE NOTICE 'Created auth user for existing user %', user_record.email;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create auth user for %: %', user_record.email, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 10. Maak foreign key constraint (optioneel - kan problemen geven met bestaande data)
-- ALTER TABLE public.users 
--   ADD CONSTRAINT users_id_fkey 
--   FOREIGN KEY (id) 
--   REFERENCES auth.users(id) 
--   ON DELETE CASCADE;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user record in public.users when a new auth user is created';
COMMENT ON FUNCTION public.handle_user_update() IS 'Automatically updates user email in public.users when auth.users is updated';
COMMENT ON FUNCTION public.handle_user_delete() IS 'Automatically deletes user record from public.users when auth user is deleted';
COMMENT ON FUNCTION public.create_auth_user_for_new_user() IS 'Automatically creates an auth user when a new user is inserted into public.users';

-- Test de synchronisatie
-- SELECT 'Setup complete! Users in public.users will now automatically sync with auth.users' as status;
