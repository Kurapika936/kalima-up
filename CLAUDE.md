# Kalima Up — consignes pour Claude

Application perso d'apprentissage du darija (arabe marocain) : traduction FR⇄darija, carnet de mots,
révision en liste et en flashcards, onglet 🎓 Prof. C'est la jumelle de Word Up (app d'anglais, dépôt
`kurapika936/carnet`) : mêmes fonctionnalités, même présentation, seule la langue change.
Installée sur l'iPhone et le PC du propriétaire. Toujours répondre en français.

## Fichiers
- `index.html` : toute l'app (HTML, CSS, JS dans un seul fichier). Partie de l'index.html de Word Up v39.
- `sw.js` : cache hors ligne. `const VERSION = "kalima-vN"` = **numéro de version de l'app**.
- `manifest.webmanifest`, `kalima-*.png` : nom et icônes de l'app installée.
- `relais/worker.js` : code du relais Cloudflare (Worker `kalima-relais`, base KV `kalima-mots` à lui).
- `relais/wrangler.toml` + `.github/workflows/relais.yml` : **déploiement automatique du relais**. Tout push
  sur `main` qui touche `relais/` met le Worker à jour (GitHub Actions + Wrangler). L'identifiant de la base KV
  est retrouvé par son nom `kalima-mots` (le déploiement s'arrête s'il ne la trouve pas). Secrets GitHub :
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Les secrets du Worker (`ANTHROPIC_KEY`, `OPENAI_KEY`,
  `APP_PASSWORD`) restent sur Cloudflare et ne sont jamais touchés ; `keep_vars = true` garde les variables
  texte du tableau de bord. Après un push, vérifier le résultat avec
  `gh run list --repo Kurapika936/kalima-up --workflow relais.yml` (et `gh run view <id> --log-failed`).
  Le relais doit donc être testé (relais local simulé) **avant** de pousser, comme l'app.
- `HISTORIQUE.md` : ce que chaque version a apporté.
- Hébergement : GitHub Pages, branche `main`, https://kurapika936.github.io/kalima-up/

## Règles propres au darija (à respecter dans toute modification)
- **Jamais d'écriture arabe à l'écran.** Le darija s'écrit en lettres latines avec chiffres, comme sur
  WhatsApp (3 = ع, 7 = ح, 9 = ق, 2 = ء, kh = خ, gh = غ, ch = ش). `noAr()` retire toute écriture arabe
  de ce qui vient de Claude, côté app et côté relais.
- **Orthographe fixe** : les règles et la liste de référence sont dans `SPELLING` (relais). Le relais
  demande `temperature: 0`, retirée automatiquement par les modèles qui la refusent (Claude Opus/Sonnet 5.5…). Darija du quotidien, pas l'arabe classique ; variante de Casablanca/Rabat, et la
  différence régionale est signalée dans la note.
- **Voix 🔊** : aucune voix ne lit le darija en lettres latines. Claude donne aussi l'écriture arabe
  du mot et de l'exemple (champs `ar` et `exAr`), gardée en coulisse et lue par une voix arabe de
  l'appareil (réglable dans ⚙️ Réglages). Mot sans `ar` (écrit à la main, importé, modifié) : l'app la
  demande au relais (`{script:true}`) au premier 🔊 puis la garde. Si le darija d'un mot est modifié,
  son `ar` est vidé.
- Dans les données, `en` et `exEn` contiennent **le darija** (noms gardés de Word Up pour que le code
  reste identique) ; `origin: "en"` veut dire « darija → français ».
- « Déjà dans ton carnet » tolère les petites différences d'orthographe (`djKeys` : chokran = choukran
  = shukran, 3afak = 3afek, bslama = beslama, mzyan = mzian…).
- Pas de DeepL (il ne gère pas le darija). Deux IA au choix dans ⚙️ Réglages : **Claude** ou **ChatGPT**
  (API OpenAI), l'autre sert de secours (`withEngine` dans le relais). L'app envoie `engine: "claude"|"openai"`
  dans chaque demande ; les deux reçoivent exactement les mêmes consignes darija. Modèle ChatGPT : variable
  `OPENAI_MODEL` (défaut `chat-latest`, le modèle de l'app ChatGPT). Les réglages OpenAI refusés par un
  modèle (température, effort de réflexion, format JSON) sont retirés automatiquement.
- Modèle Claude par défaut : `claude-opus-5-5` (variable `CLAUDE_MODEL` pour en changer). Les modèles récents
  réfléchissent avant de répondre : `callClaude` laisse de la place (`max_tokens` ≥ 8000) et retire les réglages
  refusés ; l'app attend jusqu'à 45 s une traduction, 90 s une réponse du Prof, 120 s une leçon ou un tri.
- Couleurs : thème marocain à elle (sable, rouge, vert, safran, frise de zellige sous le titre), différent
  de Word Up. Variables CSS en haut de `index.html` ; `--blue` = couleur principale (rouge), nom gardé de Word Up.

## Cohabitation avec Word Up (même site kurapika936.github.io)
- Clés localStorage : toutes préfixées `kalima-up-` (Word Up utilise `carnet-anglais-`). Ne jamais
  réutiliser une clé de Word Up.
- Caches du service worker : préfixe `kalima-`. `sw.js` ne supprime **que** ses propres anciens caches.
  Le `sw.js` de Word Up supprime, lui, tous les caches qui ne sont pas les siens quand il se met à jour :
  Kalima Up reconstruit alors son cache toute seule à la prochaine ouverture (en ligne).
- Relais séparé : avant toute synchro, l'app vérifie (ping) que le relais répond `app: "kalima-up"`,
  pour ne jamais envoyer de mots de darija dans la base de Word Up.
- Une sauvegarde de Word Up est refusée à l'import.
- Ne rien modifier dans le dépôt `carnet` depuis une tâche sur Kalima Up.

## Publier une nouvelle version
1. Modifier, puis tester dans un navigateur headless (Playwright) avant de pousser.
2. Incrémenter `VERSION` dans `sw.js` : prendre **le plus grand numéro déjà publié + 1**
   (voir « Retrouver une version » ci-dessous). Sans ça, l'app installée ne se met pas à jour.
3. Commit avec un message en français, puis `git push origin HEAD:main`.
   (Les tags git ne passent pas par le proxy de la session : on ne s'en sert pas.)
4. Ajouter une ligne dans `HISTORIQUE.md` (même commit).

## Retrouver une version
Le numéro de chaque version est dans `sw.js` de chaque commit. Pour lister « commit → version » :
```sh
git fetch --depth=1000 origin main
for c in $(git rev-list --reverse origin/main); do
  v=$(git show $c:sw.js 2>/dev/null | grep -o 'kalima-v[0-9]*' | head -1)
  [ -n "$v" ] && echo "$c $v $(git log -1 --format=%s $c)"
done
```
Si plusieurs commits ont le même numéro (commits de doc sans changement d'app), prendre le **dernier**.

## Règle « Rollback N »
Quand le propriétaire écrit **« Rollback N »** (ex. « Rollback 3 »), revenir à la version N, sans redemander :
1. Trouver le commit de la version N avec la commande ci-dessus. Si N n'existe pas, lister les
   versions disponibles et proposer la plus proche.
2. Restaurer les fichiers de l'app tels qu'en vN : `git checkout <commit> -- index.html sw.js manifest.webmanifest`
   ainsi que les icônes présentes dans ce commit. Supprimer les fichiers d'app qui n'existaient pas en vN
   (sauf `CLAUDE.md`, `HISTORIQUE.md`, `relais/`, `README.md`, qui restent à jour).
3. Mettre `VERSION` à **(plus grand numéro existant + 1)**, jamais N lui-même (sinon le cache
   de l'iPhone ne se rafraîchit pas). Le contenu est celui de vN, seul le numéro change.
   Garder le préfixe `kalima-v` (jamais `carnet-v`).
4. Tester rapidement (page chargée sans erreur), commit « Rollback vers la version N », push,
   et ajouter la ligne correspondante dans `HISTORIQUE.md`.
5. Dire au propriétaire ce qu'il perd par rapport à la version d'avant (voir `HISTORIQUE.md`), notamment :
   - avant v3 : plus de choix Claude / ChatGPT (l'app utilise Claude ; si le relais n'a que la clé OpenAI,
     ChatGPT répond quand même) ;
   - avant v2 : couleurs de Word Up (bleu) au lieu du thème marocain.
   Ses mots ne sont jamais touchés : ils sont dans le téléphone et dans la base Cloudflare, pas dans le code.
6. Un rollback se défait par un autre rollback (« Rollback 2 » pour revenir à la version d'avant).

Le relais Cloudflare reste compatible avec toutes les versions de l'app : un rollback de l'app
ne demande normalement pas de changer le relais.
