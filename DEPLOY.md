# Deploy naar eigen server

## Belangrijk: Environment Variabelen

De app heeft Supabase credentials nodig tijdens de build. Zorg dat je deze waarden hebt:

```bash
VITE_SUPABASE_URL=https://ossyxxlplvqakowiwbok.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT
VITE_APP_NAME="WP Hub"
VITE_APP_DOMAIN=https://wphub.pro
```

## Optie 1: Docker Image builden en pushen

### 1. Build de Docker image lokaal met environment variabelen
```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://ossyxxlplvqakowiwbok.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT \
  --build-arg VITE_APP_NAME="WP Hub" \
  --build-arg VITE_APP_DOMAIN=https://wphub.pro \
  -t wphub:latest .
```

### 2. Tag de image voor je registry
```bash
# Als je een registry gebruikt (bijv. Docker Hub, GitHub Container Registry)
docker tag wphub:latest your-registry.com/wphub:latest
docker push your-registry.com/wphub:latest
```

### 3. Deploy op je server
SSH naar je server en run:
```bash
# Pull de nieuwe image
docker pull your-registry.com/wphub:latest

# Stop de oude container
docker stop wphub || true
docker rm wphub || true

# Start de nieuwe container
docker run -d \
  --name wphub \
  -p 80:80 \
  --restart unless-stopped \
  your-registry.com/wphub:latest
```

## Optie 2: Direct builden op server (aanbevolen)

### 1. Push code naar repository
```bash
git add .
git commit -m "Fix: Add Nginx SPA routing for /login"
git push
```

### 2. SSH naar server en deploy
```bash
# SSH naar je server
ssh user@wphub.pro

# Ga naar de app directory
cd /path/to/wphub

# Pull laatste wijzigingen
git pull

# Rebuild Docker image met environment variabelen
docker build \
  --build-arg VITE_SUPABASE_URL=https://ossyxxlplvqakowiwbok.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT \
  --build-arg VITE_APP_NAME="WP Hub" \
  --build-arg VITE_APP_DOMAIN=https://wphub.pro \
  -t wphub:latest .

# Stop oude container en start nieuwe
docker stop wphub && docker rm wphub
docker run -d \
  --name wphub \
  -p 80:80 \
  --restart unless-stopped \
  wphub:latest

# Check logs
docker logs -f wphub
```

## Optie 3: Met docker-compose (aanbevolen voor herhaalde deploys)

### 1. Maak docker-compose.yml op je server:
```yaml
version: '3.8'

services:
  wphub:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: https://ossyxxlplvqakowiwbok.supabase.co
        VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT
        VITE_APP_NAME: "WP Hub"
        VITE_APP_DOMAIN: https://wphub.pro
    ports:
      - "80:80"
    restart: unless-stopped
```

### 2. Deploy
```bash
# SSH naar server
ssh user@wphub.pro

# Ga naar app directory
cd /path/to/wphub

# Pull wijzigingen
git pull

# Rebuild en restart
docker-compose up -d --build

# Check status
docker-compose logs -f
```

## Verificatie

Na deployment, test deze URLs:
- https://wphub.pro/ - Homepage
- https://wphub.pro/login - Login pagina (zou nu moeten werken!)
- https://wphub.pro/dashboard - Dashboard

## Troubleshooting

### Als /login nog steeds 404 geeft:
```bash
# Check of Nginx config correct is geladen
docker exec wphub cat /etc/nginx/conf.d/default.conf

# Check Nginx logs
docker logs wphub

# Herstart Nginx binnen de container
docker exec wphub nginx -s reload
```

### Check welke files in de container zitten:
```bash
docker exec wphub ls -la /usr/share/nginx/html
```

Je zou moeten zien:
- index.html
- assets/
- Andere static files

## Wijzigingen in deze deploy

✅ **nginx.conf toegevoegd** - SPA routing configuratie  
✅ **Dockerfile aangepast** - Nginx config wordt gekopieerd  
✅ **try_files directive** - Alle routes worden naar index.html gestuurd  

Dit zorgt ervoor dat React Router alle routes kan afhandelen, inclusief `/login`!

## Supabase Edge Functions Deployment

### CORS Fix Deployment

De edge functions bevatten nu CORS headers om cross-origin requests toe te staan. Deploy deze met:

```bash
# Install Supabase CLI indien nog niet geïnstalleerd
npm install -g supabase

# Login naar Supabase
supabase login

# Link project
supabase link --project-ref ossyxxlplvqakowiwbok

# Deploy alle edge functions
supabase functions deploy

# Of deploy een specifieke functie
supabase functions deploy listSitePlugins
```

### Verificatie van Edge Functions

Test of CORS correct werkt:
```bash
# Test OPTIONS preflight request
curl -X OPTIONS https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/listSitePlugins \
  -H "Access-Control-Request-Method: POST" \
  -H "Origin: https://www.wphub.pro" \
  -v

# Verwachte response headers:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

Zie [supabase/CORS_CONFIGURATION.md](supabase/CORS_CONFIGURATION.md) voor meer details over de CORS implementatie.
