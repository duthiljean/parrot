# Instructions pour les assistants de code

Parrot est une app Mac qui copie toute la transcription d'une réunion Microsoft Teams. Elle lit la fenêtre de Teams grâce à l'accessibilité de macOS, fait défiler la transcription, copie le texte et propose de le coller dans Claude ou ChatGPT, ou de l'exporter.

- **Si la personne est sous Windows, sous Linux ou utilise Teams dans un navigateur**, suis [PORTAGE.md](PORTAGE.md) pour lui créer une version adaptée.
- **Sur Mac**, le fonctionnement et les fichiers sont décrits dans le [README](README.md).

## Règles

- Ne jamais envoyer le texte à une IA à la place de la personne : coller seulement, sans appuyer sur Entrée.
- Tout reste sur l'ordinateur : pas de serveur, pas de compte, pas de statistiques, pas d'API Microsoft.
- Ne jamais contourner une règle de sécurité de l'ordinateur ou de l'entreprise.
- Expliquer simplement ce que tu fais, et demander avant d'installer quoi que ce soit.
- Sur Mac, ne pas reconstruire `Parrot.app` sans prévenir : macOS retirerait l'autorisation Accessibilité.
