# Gavel élesítése – teendők holnapra

Az egész oldal már működik **demó módban** (kulcsok nélkül): a Google-gomb ilyenkor egy helyi demó fiókkal léptet be, és minden a böngészőben marad. Ha az alábbiakat megcsinálod, valódi Google-belépés és fiókhoz kötött, eszközök között szinkronizált mentés lesz belőle.

Kb. **30–40 perc**, sorrendben haladj.

---

## 1. Supabase (adatbázis + bejelentkezés) – kb. 10 perc

1. Menj a **https://supabase.com** oldalra → **Start your project** → lépj be (GitHubbal vagy e-maillel).
2. **New project**
   - Name: `gavel`
   - Database password: generálj egyet, és **mentsd el** valahova.
   - Region: **Central EU (Frankfurt)** – ez van a legközelebb.
   - Free plan → **Create new project**. Várj 1–2 percet.
3. Bal oldalt **SQL Editor** → **New query** → másold be a `supabase/schema.sql` fájl **teljes** tartalmát → **Run**. Azt kell írnia: *Success. No rows returned.*
4. Bal oldalt **Project Settings** (fogaskerék) → **API**:
   - **Project URL** → ez lesz a `supabaseUrl`
   - **anon public** kulcs → ez lesz a `supabaseAnonKey`
   - (A **service_role** kulcsot **soha** ne tedd be sehova, az titkos.)

## 2. A kulcsok beírása – 1 perc

Nyisd meg a `config.js` fájlt, és töltsd ki:

```js
window.GAVEL_CONFIG = {
  supabaseUrl: 'https://IDE-A-SAJAT.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
  contactEmail: 'a-te-email-cimed@pelda.hu',
};
```

Az anon kulcs nyugodtan lehet nyilvános, azt pont erre tervezték. Az adatokat a sémában lévő szabályok védik: mindenki csak a saját sessionjeit látja.

## 3. Google-bejelentkezés – kb. 15 perc

1. Menj a **https://console.cloud.google.com** oldalra → fent **Select a project** → **New project** → név: `Gavel` → **Create**.
2. Bal menü: **APIs & Services** → **OAuth consent screen** (vagy **Google Auth Platform**) → **Get started**:
   - App name: `Gavel`
   - User support email: a te címed
   - Audience: **External**
   - Contact email: a te címed → **Create**
3. **Branding** fül: ide írd be az oldalad címét, valamint az adatvédelmi és a feltételek oldal linkjét, ha már megvan a domain (lásd 4. pont):
   - `https://A-DOMAINED/privacy`
   - `https://A-DOMAINED/terms`
4. **Clients** → **Create client**:
   - Application type: **Web application**
   - Name: `Gavel web`
   - **Authorized JavaScript origins:** `https://A-DOMAINED` (és a Cloudflare-es címed is, pl. `https://gavel.pages.dev`)
   - **Authorized redirect URIs:** `https://IDE-A-SAJAT.supabase.co/auth/v1/callback`
     (a pontos címet a Supabase is kiírja: Authentication → Sign In / Providers → Google)
   - **Create** → kapsz egy **Client ID**-t és egy **Client secret**-et.
5. Vissza a **Supabase**-be: **Authentication** → **Sign In / Providers** → **Google** → kapcsold be → másold be a Client ID-t és a Client secretet → **Save**.
6. Supabase: **Authentication** → **URL Configuration**:
   - **Site URL:** `https://A-DOMAINED`
   - **Redirect URLs:** add hozzá ezeket:
     - `https://A-DOMAINED/**`
     - `https://gavel.pages.dev/**` (a saját Cloudflare-címeddel)
     - `http://localhost:5517/**` (ha gépen is tesztelnéd)

Csak nevet, e-mailt és profilképet kérünk, ezért a Google-nek nem kell külön ellenőriznie az appot. Élesítés előtt az **Audience** oldalon nyomd meg a **Publish app** gombot, különben csak a tesztfelhasználóként felvett címek tudnak belépni.

## 4. Közzététel a Cloudflare Pages-en – kb. 5 perc

A kód már fent van a GitHubon a `gavel` repóban.
1. **https://dash.cloudflare.com** → lépj be → bal oldalt **Compute (Workers & Pages)** → **Create** → **Pages** fül → **Connect to Git**.
2. Kapcsold össze a GitHub-fiókodat, és válaszd ki a **gavel** repót → **Begin setup**.
3. Beállítások:
   - Project name: `gavel` (ebből lesz a cím: `https://gavel.pages.dev`)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: **üres**
   - Build output directory: **`/`**
4. **Save and Deploy**. Kb. egy perc múlva kész. Kapsz egy címet, pl. `https://gavel.pages.dev`. Ezt írd be a 3. pontban a Google-höz és a Supabase-hez.
5. Ezután minden `git push` a `main` ágra magától frissíti az oldalt.

**Saját domain (opcionális):** a Cloudflare-ben **Pages projekt → Custom domains → Set up a custom domain**. Ha a domain is a Cloudflare-nél van, egy kattintás.

Tipp: a Cloudflare a `login.html`-t magától `/login` címen szolgálja ki. Ez rendben van, a belépés így is működik.

## 5. Kipróbálás

1. Nyisd meg az oldalt → **Start free with Google** → válaszd ki a fiókod.
2. Végigmész a bevezetőn (onboarding) → létrejön az első bizottságod → megnyílik a Gavel.
3. A jobb felső sarokban a profilképeden lévő **zöld pötty** azt jelenti, hogy a mentés a fiókodban van.
4. Nyisd meg a telefonodon is, lépj be ugyanazzal a Google-fiókkal: ott lesznek a sessionjeid.

---

## Ha valami nem megy

| Hiba | Megoldás |
|---|---|
| `redirect_uri_mismatch` a Google-nél | A Google Clientben a redirect URI pontosan `https://...supabase.co/auth/v1/callback` legyen. |
| Belépés után visszadob a login oldalra | Supabase → URL Configuration → Redirect URLs alatt legyen ott a domained `/**` végződéssel. |
| „Access blocked: app is in testing” | Google → Audience → **Publish app**, vagy vedd fel magad tesztfelhasználónak. |
| Narancs pötty a profilképen | Nincs internet, vagy hibás a Supabase-kulcs. A gépen minden megmarad, és később szinkronizál. |

## Fájlok röviden

- `index.html` – bemutató oldal
- `login.html` – Google-belépés
- `onboarding.html` – animált bevezető az első belépés után
- `app/` – maga a Gavel (`app/cloud.js`: szinkron és fiókmenü)
- `privacy.html`, `terms.html` – adatvédelem és feltételek
- `config.js` – **ide jönnek a kulcsok**
- `supabase/schema.sql` – adatbázis
- `tools/build-app.mjs` – ha a Gavel appot módosítjuk: az új fájlt másold a `tools/app-source.html` helyére, majd futtasd: `node tools/build-app.mjs`
