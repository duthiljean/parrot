# Adapter Parrot à un autre ordinateur

Ce guide est écrit pour les assistants de code (Claude Code, Codex, Cursor, GitHub Copilot…) qui aident quelqu'un à faire fonctionner Parrot ailleurs que sur Mac. Il décrit ce que Parrot doit faire et comment la version Mac s'y prend. Les pistes pour Windows n'ont pas été testées par le projet.

Si tu es un assistant de code : avant d'écrire du code, demande à la personne quel système elle utilise, si elle a la nouvelle application Teams, et si elle a une réunion avec une transcription pour tester. Explique chaque étape avec des mots simples, et ne fais rien que la personne n'a pas accepté.

## Ce que doit faire la version adaptée

1. La personne ouvre la réunion dans Teams, sur l'onglet **Transcription**, puis lance Parrot avec un raccourci clavier. Pas de terminal au quotidien.
2. Parrot trouve la transcription dans la fenêtre de Teams et la fait défiler du début à la fin, sans que la personne touche à quoi que ce soit.
3. Une petite fenêtre affiche la progression pendant la copie.
4. À la fin, tout le texte est dans le presse-papiers, une ligne par réplique :

   ```
   [0:00] Marie Dupont : Bonjour à tous, on commence ?
   [0:06] Paul Martin : Oui, je partage mon écran.
   ```

5. Une fenêtre de fin permet de :
   - nettoyer le texte : retirer les « euh », fusionner les répliques consécutives d'une même personne, masquer les heures ;
   - coller dans Claude ou ChatGPT : ouvrir l'app (ou le site), ouvrir une nouvelle conversation et coller, **sans jamais envoyer** ;
   - exporter en Word, PDF ou TXT dans le dossier Téléchargements.

## Règles à garder

- **Ne jamais envoyer le texte à une IA à la place de la personne.** Parrot colle, la personne relit et envoie elle-même. Ne jamais simuler la touche Entrée dans un assistant.
- Avant chaque frappe simulée, vérifier que la bonne fenêtre est au premier plan. Sinon, arrêter et dire que le texte est dans le presse-papiers.
- Tout reste sur l'ordinateur : pas de serveur, pas de compte, pas de statistiques, pas d'API Microsoft, pas d'identifiants Teams.
- Parrot lit seulement ce que Teams affiche à l'écran, comme un lecteur d'écran.
- Les données locales (dernière transcription, préférences) vont dans un dossier de l'utilisateur, par exemple `%APPDATA%\Parrot` sous Windows.
- Garder le fichier `LICENSE` (licence MIT).

## Comment la version Mac s'y prend

Le code se trouve dans `src/transcription-teams-app.js` pour la lecture et dans `src/widget.js` pour les fenêtres. Les noms de fonctions ci-dessous permettent de s'y retrouver.

### 1. Trouver la transcription

Parrot lit l'arbre d'accessibilité de la fenêtre de Teams, celui qu'utilisent les lecteurs d'écran (fonction `findList`).

- Il cherche une **liste** dont au moins deux éléments ressemblent à un en-tête de réplique : un nom suivi d'une durée, par exemple `Marie Dupont 2 minutes 40 secondes` ou `Paul Martin 1 hour 3 minutes 5 seconds`. Une conversation qui contient « il y a 5 minutes » ne doit pas suffire.
- Expression utilisée pour reconnaître ces lignes (français et anglais) :

  ```
  ^\S.*\s(?:\d+\s+(?:heures?|hours?|minutes?)\s+)*\d+\s+(?:secondes?|seconds?)$
  ```

- Le chemin trouvé est mémorisé dans un fichier, pour aller plus vite la fois suivante.
- La recherche s'arrête au bout de 12 secondes avec un message clair plutôt que de tourner sans fin.
- Sur Mac, il faut activer `AXEnhancedUserInterface` pour que Teams expose le contenu de ses pages.

### 2. Lire toute la transcription

Teams ne garde en mémoire qu'une partie des répliques : la liste est « virtualisée », d'où l'impossibilité de tout sélectionner d'un coup. Parrot procède donc par tranches (fonctions `readVisible` et `scrollTo`, puis la boucle principale).

1. Il revient à la première réplique affichée.
2. Il lit les répliques présentes : nom, heure (convertie en secondes) et texte.
3. Il demande à Teams d'afficher la **dernière réplique lue** (`AXScrollToVisible` sur Mac), ce qui charge les suivantes.
4. Il attend que la liste change, puis qu'elle ne bouge plus, avant de relire.
5. Il recommence jusqu'à la fin.

Précautions qui comptent :

- **Lecture stable** : les noms et les textes arrivent en plusieurs requêtes. Parrot relit les étiquettes après coup et recommence si elles ont changé entre-temps.
- **Continuité** : la dernière réplique lue doit encore être présente à la lecture suivante. Sinon, des répliques ont été sautées : Parrot revient en arrière jusqu'à la retrouver.
- **Doublons** : une réplique est identifiée par `heure | nom | 30 premiers caractères`. Si elle réapparaît plus longue, on garde la version la plus longue.
- **Fin** : la dernière ligne d'une transcription Teams indique que la transcription est arrêtée (« transcription arrêtée », « stopped transcription »). Elle peut aussi apparaître au milieu si la transcription a été relancée : on vérifie une fois de plus avant de s'arrêter. Sans cette ligne, on s'arrête après trois tentatives sans nouvelle réplique.
- **Progression** : Teams ne donne pas la durée réelle. Le créneau prévu de la réunion (par exemple « 17:00 – 17:30 ») sert d'estimation, plafonnée à 95 % tant que la lecture n'est pas finie.

À la fin, les répliques sont triées par heure, mises au format ci-dessus et copiées dans le presse-papiers.

### 3. Nettoyer le texte

Dans `src/widget.js` (fonctions `stripFillers` et voisines) :

- les « euh » sont retirés avec cette expression, appliquée jusqu'à ce que le texte ne change plus :

  ```
  (^|[\s,;:.!?…«"'(—–-])(?:euh+|heu+|hum+|hmm+|mmh+|mh+|uh+|um+)(?=$|[\s,;:.!?…»"')—–-])[,;…]*
  ```

- les répliques vides après nettoyage sont supprimées ;
- les répliques consécutives d'une même personne sont fusionnées ;
- les heures peuvent être masquées.

Les préférences par défaut sont : sans « euh », répliques fusionnées, heures affichées.

### 4. Coller dans Claude ou ChatGPT

Fonction `pasteIntoAssistant` :

1. Ouvrir l'app Claude ou ChatGPT. Si elle n'est pas installée, ouvrir `https://claude.ai/new` ou `https://chatgpt.com` et laisser la personne coller elle-même.
2. Attendre que l'app soit au premier plan.
3. Ouvrir une nouvelle conversation (⌘N sur Mac). **Vérifier le raccourci dans l'app installée** : il peut être différent ailleurs, et il change parfois d'une version à l'autre.
4. Vérifier encore que l'app est au premier plan, puis coller.
5. Ne pas appuyer sur Entrée.

### 5. Exporter

Fonction `ttExport` : le fichier est nommé `Transcription - <titre de la réunion> - <date>.<extension>` dans Téléchargements, sans jamais écraser un fichier existant (ajouter ` (2)`, ` (3)`…). Le Word et le PDF partent d'une page HTML simple : nom en gras, heure en gris, texte en dessous.

## Pistes pour Windows (non testées)

La nouvelle application Teams pour Windows affiche ses pages avec WebView2, le moteur d'Edge. Son contenu devrait donc être lisible avec **UI Automation**, l'équivalent Windows de l'accessibilité de macOS. Il faut le vérifier sur l'ordinateur de la personne, avec un outil comme Accessibility Insights ou Inspect.

| Sur Mac | Équivalent probable sous Windows |
|---|---|
| Arbre d'accessibilité (`AXUIElement`) | UI Automation (`System.Windows.Automation` ou l'API COM `IUIAutomation`) |
| Liste `AXList` et ses éléments | Contrôles `List` et `ListItem`, ou `Group` et `Text` selon ce qu'expose Teams |
| `AXDescription`, `AXValue` | Propriétés `Name`, et `ValuePattern` ou `TextPattern` |
| `AXScrollToVisible` | `ScrollItemPattern.ScrollIntoView()` |
| Presse-papiers | `Set-Clipboard`, ou l'API presse-papiers de Windows |
| Raccourci clavier global | Raccourci (`.lnk`) du menu Démarrer avec une « Touche de raccourci », ou un vrai raccourci global (`RegisterHotKey`) |
| Dossier Téléchargements | `[Environment]::GetFolderPath` ou le dossier connu `Downloads` |

Outils possibles, du plus simple au plus complet :

- **PowerShell** (Windows PowerShell 5.1, présent sur Windows 10 et 11) : rien à installer. UI Automation par `Add-Type -AssemblyName UIAutomationClient`, fenêtres en WinForms ou WPF, lancement par un raccourci du menu Démarrer qui exécute `powershell -WindowStyle Hidden -File …` avec une touche de raccourci comme Ctrl+Alt+T.
- **Python** avec `uiautomation` ou `pywinauto`, transformé en `.exe` avec PyInstaller.
- **AutoHotkey v2** avec une bibliothèque UI Automation, pratique pour le raccourci global.
- **C# / .NET**, pour une vraie application.

Pour l'export : TXT en UTF-8 sans difficulté ; Word en `.docx` (ou un fichier HTML ouvert par Word) ; PDF avec Edge en mode sans fenêtre (`msedge --headless --print-to-pdf=…`) ou l'imprimante « Microsoft Print to PDF ».

Points d'attention :

- L'entreprise peut bloquer les scripts PowerShell ou les applications non signées. Ne contourne jamais une règle de sécurité : propose une autre solution ou laisse la personne voir avec son service informatique.
- La structure de l'arbre UI Automation peut changer avec une mise à jour de Teams. Repère la liste par son contenu (les en-têtes de réplique), pas par une position fixe.
- Teams peut être dans une autre langue que le français ou l'anglais : ajoute alors les mots « heures », « minutes », « secondes » et « transcription arrêtée » de cette langue.

## Linux et Teams dans un navigateur

Microsoft ne propose plus d'application Teams pour Linux : on passe par le navigateur. Une extension de navigateur pourrait lire le panneau Transcription de `teams.microsoft.com` dans la page elle-même et suivre la même méthode : lire, faire défiler jusqu'à la dernière réplique lue, recommencer. Cette piste n'a pas été testée.

## Tester

1. Prends une réunion avec une transcription d'au moins 20 minutes.
2. Compare le début, le milieu et la fin du texte copié avec ce qu'affiche Teams.
3. Vérifie qu'il n'y a ni doublon ni trou : les heures doivent se suivre.
4. Prévois un mode test qui affiche le nombre de répliques, la durée, et le nombre de retours en arrière, comme `--debug` sur Mac.

## Partager ton adaptation

Tu peux publier ta version sous licence MIT, en gardant le fichier `LICENSE`. Précise qu'elle est indépendante de ce projet et de Microsoft, et sur quel système tu l'as testée.
