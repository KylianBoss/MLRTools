EMPLACEMENT DE LA DOCUMENTATION
================================

La documentation technique et d'exploitation de MLR Tools N'EST PAS dans ce
dossier. Elle est maintenue dans un dépôt PRIVÉ séparé, qui constitue la
SEULE source de vérité :

    Dépôt privé : KylianBoss/MLRTools-docs  (GitHub, privé)
    Copie locale : C:\IT\MLRTools-docs

POURQUOI séparé ?
  La doc contient des informations d'infrastructure internes (hôtes de base
  de données, utilisateurs, topologie réseau, procédures). Elle ne doit pas
  être rendue publique via ce dépôt de code (qui est public).

NE PAS recréer de fichiers .md de documentation dans ce dossier :
  - ils seraient ignorés par git (.gitignore : *.md) et donc invisibles,
  - et surtout cela recréerait une seconde copie qui divergerait de la
    source unique (le dépôt privé).

Pour modifier la doc : éditer directement dans C:\IT\MLRTools-docs, puis
commit + push sur le dépôt privé.

(Ce dossier ne conserve que index.html et examples/, qui appartiennent au
dépôt de code public.)
