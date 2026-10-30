// Application « Transcription Teams » : charge widget.js et le programme rangés dans
// ~/Library/Application Support/Transcription Teams/, puis le lance. Garder le programme
// à part permet de le mettre à jour sans que macOS redemande les autorisations de l'app.
ObjC.import('Foundation');

function run() {
  const dir = $.NSHomeDirectory().js + '/Library/Application Support/Transcription Teams/';
  const read = (f) => {
    const s = $.NSString.stringWithContentsOfFileEncodingError($(dir + f), $.NSUTF8StringEncoding, null);
    return s.isNil() ? null : s.js;
  };
  const widget = read('widget.js'), program = read('transcription-teams-app.js');
  if (widget == null || program == null) {
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;
    app.displayDialog('Fichiers du programme introuvables dans :\n' + dir, { withTitle: 'Parrot', buttons: ['OK'], withIcon: 'stop' });
    return;
  }
  return eval(widget + '\n' + program + '\nrun([]);');
}
