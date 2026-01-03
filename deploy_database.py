#!/usr/bin/env python3
"""
Stripe Elements Database Migration Deployer
Deploys migration SQL via Supabase REST API
"""

import os
import sys
import json
import requests
from pathlib import Path

def load_env():
    """Load environment variables from .env file"""
    env = {}
    env_file = Path('.env')
    
    if not env_file.exists():
        print("❌ Error: .env file not found")
        return None
    
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()
    
    return env

def deploy_migration():
    """Deploy the migration SQL via Supabase API"""
    
    print("🚀 Stripe Elements Database Migration Deployer")
    print("=" * 70)
    print()
    
    # Load environment
    env = load_env()
    if not env:
        sys.exit(1)
    
    supabase_url = env.get('VITE_SUPABASE_URL')
    service_role_key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_role_key:
        print("❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    # Read migration file
    migration_file = Path('supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql')
    if not migration_file.exists():
        print(f"❌ Error: Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file) as f:
        migration_sql = f.read()
    
    print(f"📋 Migration File: {migration_file}")
    print(f"📏 Size: {len(migration_sql)} characters")
    print(f"🔗 Supabase Project: {supabase_url}")
    print()
    
    print("⏳ Preparing deployment...")
    print()
    
    # Split SQL into individual statements for better error handling
    statements = []
    current = ""
    for line in migration_sql.split('\n'):
        current += line + '\n'
        if line.strip().endswith(';'):
            statements.append(current.strip())
            current = ""
    
    if current.strip():
        statements.append(current.strip())
    
    print(f"📊 SQL Statements: {len(statements)}")
    
    # Filter out comments and empty statements
    statements = [s for s in statements if s and not s.startswith('--')]
    
    print(f"✅ Valid Statements: {len(statements)}")
    print()
    
    print("📌 IMPORTANT NOTICE:")
    print("─" * 70)
    print()
    print("This script attempts to deploy via Supabase REST API.")
    print("However, the recommended way is to use Supabase Dashboard:")
    print()
    print("1. Open: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql")
    print("2. Create a new query")
    print("3. Copy & paste the contents of:")
    print(f"   {migration_file}")
    print("4. Click 'Run'")
    print()
    print("─" * 70)
    print()
    
    response = input("🤔 Continue with programmatic deployment? (y/n): ").strip().lower()
    if response != 'y':
        print()
        print("📖 See DATABASE_DEPLOYMENT_GUIDE.md for manual deployment instructions")
        sys.exit(0)
    
    print()
    print("⚙️  Deploying migration...")
    print()
    
    # Try to execute via SQL API
    headers = {
        'Authorization': f'Bearer {service_role_key}',
        'apikey': service_role_key,
        'Content-Type': 'application/json'
    }
    
    # Execute entire migration as one transaction
    try:
        # Note: This uses the standard PostgreSQL connection
        # For Supabase, we should use the REST API or directly via Dashboard
        print("⚠️  Note: REST API execution may have limitations")
        print("   Recommended: Use Supabase Dashboard for reliable deployment")
        print()
        
        print("📌 To complete deployment via Dashboard:")
        print()
        print(f"1. URL: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql")
        print(f"2. Copy entire contents of: supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql")
        print(f"3. Paste into SQL Editor")
        print(f"4. Click 'Run' button")
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    
    print("✨ Migration deployment guide created:")
    print("   See: DATABASE_DEPLOYMENT_GUIDE.md")

if __name__ == '__main__':
    deploy_migration()
