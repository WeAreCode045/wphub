# Database Migration Scripts

Deze map bevat scripts voor database migraties en onderhoud.

## Beschikbare Scripts

### `migrate-plugin-urls.js`
**Doel:** Migreert lokale plugin download URLs naar Supabase storage URLs.

**Wat het doet:**
- Haalt alle plugins op uit de `plugins` tabel
- Voor elke versie in de `versions` array:
  - Controleert of de `download_url` een `base44.app` URL is
  - Vervangt deze door de corresponderende Supabase storage URL
  - Slaat de `wordpress.org` URLs en al gemigreerde URLs ongewijzigd
- Update de plugin records in de database

**Gebruik:**
```bash
node scripts/migrate-plugin-urls.js
```

**Resultaat:** Alle lokale plugin bestanden worden nu geserveerd vanaf Supabase storage in plaats van de oude base44.app URLs.

### `migrate-plugins-to-bucket.js`
**Doel:** Migreert plugin bestanden van externe Supabase storage naar de lokale Plugins bucket.

**Wat het doet:**
- Haalt alle plugins op met externe Supabase URLs (qtrypzzcjebvfcihiynt.supabase.co)
- Downloadt elk bestand van de externe storage
- Uploadt het naar de lokale Plugins bucket
- Update de download_url in de database naar de nieuwe lokale URL
- Slaat WordPress.org URLs en al gemigreerde URLs over

**Gebruik:**
```bash
node scripts/migrate-plugins-to-bucket.js
```

**Resultaat:** Alle lokale plugin bestanden worden nu geserveerd vanaf de eigen Supabase Plugins bucket.

### `migrate-themes-to-bucket.js`
**Doel:** Migreert theme bestanden van externe Supabase storage naar de lokale Themes bucket.

**Wat het doet:**
- Haalt alle themes op met externe Supabase URLs (qtrypzzcjebvfcihiynt.supabase.co)
- Downloadt elk bestand van de externe storage
- Uploadt het naar de lokale Themes bucket
- Update de download_url in de database naar de nieuwe lokale URL
- Slaat WordPress.org URLs over

**Gebruik:**
```bash
node scripts/migrate-themes-to-bucket.js
```

**Resultaat:** Alle lokale theme bestanden worden nu geserveerd vanaf de eigen Supabase Themes bucket.

### `check-user-references.js`
**Doel:** Controleert referenties naar gebruikers in alle tabellen.

**Wat het doet:**
- Controleert of alle foreign keys naar users geldig zijn
- Rapporteert orphaned records in sites, plugins, teams, en activity_logs

**Gebruik:**
```bash
node scripts/check-user-references.js
```

## Uitvoering

Alle scripts gebruiken de service role key voor volledige database toegang. Zorg ervoor dat de `.env` variabelen correct zijn ingesteld:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Maak scripts uitvoerbaar voordat gebruik:
```bash
chmod +x scripts/*.js
```