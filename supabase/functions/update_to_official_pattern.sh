#!/bin/bash

for file in */index.ts; do
  echo "Processing $file..."
  
  # Replace imports
  perl -i -pe "s|import \{ authMeWithToken, extractBearerFromReq \} from '../_helpers\.ts';|import { createClient } from 'jsr:@supabase/supabase-js\@2'|" "$file"
  perl -i -pe "s|import \{ createClientFromRequest \} from '../supabaseClientServer\.js';||" "$file"
  
  # Replace auth pattern
  perl -i -0777 -pe "s/const token = extractBearerFromReq\(req\);\s+const user = await authMeWithToken\(token\);\s+const base44 = createClientFromRequest\(req\);/const supabase = createClient(\n        Deno.env.get('SUPABASE_URL') ?? '',\n        Deno.env.get('SUPABASE_ANON_KEY') ?? '',\n        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }\n      )\n      \n      const { data: { user } } = await supabase.auth.getUser()/g" "$file"
  
  # Replace base44.entities with supabase.from
  perl -i -pe "s/base44\.entities\.(\w+)\.filter\(\{ ([^}]+) \}\)/supabase.from('\L\$1s\E').select().eq('\$2')/g" "$file"
  perl -i -pe "s/base44\.entities\.(\w+)\.get\(([^)]+)\)/supabase.from('\L\$1s\E').select().eq('id', \$2).single()/g" "$file"
  perl -i -pe "s/base44\.entities\.(\w+)\.list\(\)/supabase.from('\L\$1s\E').select()/g" "$file"
  perl -i -pe "s/base44\.entities\.(\w+)\.create\(/supabase.from('\L\$1s\E').insert(/g" "$file"
  perl -i -pe "s/base44\.entities\.(\w+)\.update\(([^,]+), /supabase.from('\L\$1s\E').update(/g" "$file"
  perl -i -pe "s/base44\.entities\.(\w+)\.delete\(/supabase.from('\L\$1s\E').delete(/g" "$file"
done

echo "✓ Updated all functions to official Supabase pattern"
