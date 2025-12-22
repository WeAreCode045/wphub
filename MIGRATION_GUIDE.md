# 🚀 Base44 → Supabase Migratie Scripts

Complete toolkit voor het migreren van Base44 data naar Supabase.

## 📦 Wat zit erin?

### Scripts

| Script | Commando | Beschrijving |
|--------|----------|--------------|
| **Migratie** | `npm run migrate` | Volledige migratie van alle entities |
| **Verificatie** | `npm run verify-migration` | Controleer migratie resultaten |
| **Sync** | `npm run sync` | Incrementele sync (laatste 24u) |
| **Inspectie** | `npm run inspect-entities` | Analyseer Base44 data structuur |

### Bestanden

```
scripts/
├── migrate-to-supabase.js     # Hoofdscript voor migratie
├── verify-migration.js        # Verificatie script
├── incremental-sync.js        # Incrementele synchronisatie
├── inspect-base44-entities.js # Data inspectie tool
├── supabase-schema.sql        # Database schema definitie
├── MIGRATION_README.md        # Uitgebreide documentatie
└── .env.example               # Voorbeeld configuratie
```

## 🎯 Quick Start

### 1. Installeer dependencies
```bash
npm install
```

### 2. Configureer Supabase
Kopieer `.env.example` naar `.env` en vul je Supabase credentials in:
```bash
cp scripts/.env.example .env
```

### 3. Maak database schema aan
Voer `scripts/supabase-schema.sql` uit in je Supabase SQL Editor

### 4. Run migratie
```bash
npm run migrate
```

### 5. Verificeer resultaat
```bash
npm run verify-migration
```

## 📊 Gemigreerde Entities

Het script migreert **19 entities**:

### Core Data
- ✅ Users - Gebruikers & authenticatie
- ✅ Sites - WordPress websites
- ✅ Plugins - Plugin bibliotheek
- ✅ Themes - Theme bibliotheek

### Organisatie
- ✅ Teams - Team structuren
- ✅ TeamRoles - Rollen & permissies
- ✅ TeamMembers - Team leden
- ✅ Projects - Projecten
- ✅ ProjectTemplates - Project sjablonen

### Communicatie
- ✅ Messages - Berichten
- ✅ Notifications - Meldingen
- ✅ SupportTickets - Support tickets

### Financieel
- ✅ SubscriptionPlans - Abonnementen
- ✅ UserSubscriptions - Gebruiker abonnementen
- ✅ Invoices - Facturen

### Systeem
- ✅ ActivityLogs - Activiteiten
- ✅ SiteSettings - Platform instellingen
- ✅ Connectors - WPHub connector versies
- ✅ PluginInstallations - Installatie tracking

## 🔧 Features

### Data Transformatie
- Automatische ID mapping (Base44 → Supabase)
- Timestamp conversie
- Array/JSON field normalisatie
- Type conversie & validatie

### Error Handling
- Batch processing (100 records per keer)
- Retry logic
- Gedetailleerde error logging
- Rollback support via upsert

### Performance
- Parallelle batch inserts
- Indexed columns
- Optimized queries
- Progress tracking

## 📖 Documentatie

Zie [scripts/MIGRATION_README.md](scripts/MIGRATION_README.md) voor:
- Gedetailleerde installatie instructies
- Troubleshooting guide
- Post-migratie stappen
- Row Level Security setup
- API migratie voorbeelden

## 🛠️ Troubleshooting

### "Entity niet beschikbaar"
Sommige entities zijn mogelijk niet beschikbaar in de Base44 SDK. Het script slaat deze automatisch over.

### "Table does not exist"
Run eerst het SQL schema in Supabase.

### "Permission denied"
Gebruik de **Service Role Key**, niet de public/anon key.

### Database connectie timeout
Verhoog de batch size in het script of run meerdere keren voor grote datasets.

## 🔐 Beveiliging

⚠️ **Belangrijke Security Notes:**

1. **Service Role Key**: Gebruik deze alleen server-side, nooit in frontend code
2. **Environment Variables**: Voeg `.env` toe aan `.gitignore`
3. **RLS Policies**: Configureer Row Level Security na migratie (zie docs)
4. **API Keys**: Roteer Base44 credentials na succesvolle migratie

## 📈 Performance Tips

Voor grote datasets (>10.000 records):

1. Verhoog `BATCH_SIZE` in het script naar 500-1000
2. Run migratie per entity voor betere controle
3. Gebruik `npm run sync` voor incrementele updates
4. Monitor Supabase dashboard voor query performance

## 🤝 Support

Bij problemen:
1. Check console output voor error details
2. Bekijk Supabase logs in dashboard
3. Run `npm run verify-migration` voor diagnostics
4. Zie uitgebreide docs in `MIGRATION_README.md`

## 📝 License

Same as parent project
