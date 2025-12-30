# Base44 naar Supabase Migratie

Dit script migreert alle data van Base44 naar Supabase.

## Voorbereiding

### 1. Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Maak een nieuw project aan
3. Noteer de **Project URL** en **Service Role Key** (te vinden in Project Settings > API)

### 2. Database Schema Aanmaken

Voer het SQL schema uit in je Supabase database:

```bash
# Optie 1: Via Supabase Dashboard
# - Ga naar SQL Editor in je Supabase dashboard
# - Kopieer de inhoud van scripts/supabase-schema.sql
# - Voer het uit

# Optie 2: Via psql (als je directe database toegang hebt)
psql -h <your-project>.supabase.co -U postgres -d postgres -f scripts/supabase-schema.sql
```

### 3. Environment Variabelen Instellen

Voeg de volgende variabelen toe aan je `.env` bestand:

```env
# Supabase configuratie
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Dependencies Installeren

```bash
npm install
```

## Migratie Uitvoeren

### 1. Inspecteer Base44 Entities (optioneel)

Voor je migreert, kun je de structuur van je Base44 data inspecteren:

```bash
npm run inspect-entities
```

Dit toont alle velden en types voor elke entity.

### 2. Volledige Migratie

Migreer alle entities van Base44 naar Supabase:

```bash
npm run migrate
# of direct:
node scripts/migrate-to-supabase.js
```

### 3. Verificatie

Na de migratie, controleer of alles correct is gemigreerd:

```bash
npm run verify-migration
```

Dit script toont:
- Aantal records per tabel
- Status van foreign key relaties
- Eventuele fouten

### 4. Incrementele Synchronisatie

Voor periodieke updates (laatste 24 uur):

```bash
npm run sync
```

Dit synchroniseert alleen gewijzigde/nieuwe data.

## Entities die worden gemigreerd

Het script migreert de volgende entities:

- ✅ **Users** - Gebruikers met authenticatie data
- ✅ **Sites** - WordPress websites
- ✅ **Plugins** - Plugin library
- ✅ **Themes** - Theme library
- ✅ **Teams** - Team structuren
- ✅ **TeamRoles** - Team rollen en permissies
- ✅ **TeamMembers** - Team members
- ✅ **Projects** - Projecten
- ✅ **ProjectTemplates** - Project templates
- ✅ **Messages** - Berichten tussen gebruikers
- ✅ **Notifications** - Notificaties
- ✅ **ActivityLog** - Activiteiten log
- ✅ **SupportTickets** - Support tickets
- ✅ **SubscriptionPlans** - Abonnement plannen
- ✅ **UserSubscriptions** - Gebruiker abonnementen
- ✅ **Invoices** - Facturen
- ✅ **SiteSettings** - Platform instellingen
- ✅ **Connectors** - WPHub connector versies
- ✅ **PluginInstallations** - Plugin installaties op sites

## Data Transformatie

Het script voert automatisch de volgende transformaties uit:

1. **ID Mapping**: Base44 ID's worden opgeslagen in `base44_id` kolom
2. **Timestamp Conversie**: `created_date` → `created_at`, `updated_date` → `updated_at`
3. **UUID Generatie**: Nieuwe UUID primary keys voor Supabase
4. **Relatie Mapping**: Foreign keys worden correct gemapt

## Problemen Oplossen

### "Entity niet beschikbaar in Base44 SDK"

Sommige entities zijn mogelijk niet beschikbaar via de Base44 SDK. Dit is normaal en het script slaat deze over.

### "Table does not exist"

Zorg ervoor dat je het SQL schema hebt uitgevoerd voordat je de migratie start.

### "Permission denied"

Controleer of je de **Service Role Key** gebruikt (niet de `anon` key).

### Batch Fouten

Als er fouten optreden bij het inserten van batches:
- Controleer de data types in het schema
- Kijk naar de error messages voor specifieke velden
- Pas indien nodig de `transformData` functie aan

## Na de Migratie

### 1. Data Verificatie

Controleer of alle data correct is gemigreerd:

```sql
-- Tel records per tabel
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### 2. Relaties Controleren

Controleer of foreign keys correct zijn:

```sql
-- Bijvoorbeeld: Sites met teams
SELECT s.name, t.name as team_name
FROM sites s
LEFT JOIN teams t ON s.team_id = t.id
LIMIT 10;
```

### 3. Row Level Security (RLS) Instellen

Voor productie moet je RLS policies toevoegen:

```sql
-- Voorbeeld voor users tabel
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Herhaal voor andere tabellen
```

### 4. API Access Patterns

Update je applicatie code om Supabase te gebruiken i.p.v. Base44:

```javascript
// Oud (Base44)
const sites = await entities.Site.list();

// Nieuw (Supabase)
const { data: sites } = await supabase
  .from('sites')
  .select('*');
```

## Incrementele Updates

Als je later opnieuw wilt migreren (zonder duplicaten):

Het script gebruikt `upsert` met `base44_id` als conflict target, dus:
- Bestaande records worden geüpdatet
- Nieuwe records worden toegevoegd

## Performance Tips

Voor grote datasets:

1. **Verhoog Batch Size**: Pas `BATCH_SIZE` aan in het script (standaard 100)
2. **Parallelle Migratie**: Splits entities over meerdere script runs
3. **Database Indexen**: Indexes worden automatisch aangemaakt via het schema

## Support

Bij problemen:
1. Check de console output voor specifieke error messages
2. Controleer de Supabase logs in het dashboard
3. Verifieer dat alle environment variabelen correct zijn ingesteld
