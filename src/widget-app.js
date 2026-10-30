// App « Parrot Widget » (compilée avec widget.js, reste ouverte) : affiche la progression puis
// la carte finale. Elle n'a besoin d'aucune autorisation Accessibilité.
ObjC.import('Foundation');

function run() {
  try {
    showWidget();
  } catch (e) {
    // Garder une trace de l'erreur plutôt qu'une boîte de dialogue
    ttWrite('erreur-widget.log', new Date().toISOString() + ' ' + e.message + '\n' + (e.stack || ''));
    $.NSApp.terminate(null);
  }
}
