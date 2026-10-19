"""Package the complete adapted sources and shared dependencies for redistribution."""
from pathlib import Path
import zipfile
public = Path('public')
root = public / 'games'
for name in ['taptaptap', 'hextris', 'ohhi', 'flappy']:
    with zipfile.ZipFile(root / (name + '-source.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((root / name).rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(public))
        # Preserve the public layout so shared CSS imports work after extraction.
        for shared in ['session.js', 'touch-events.js', 'cartoon.css']:
            path = root / shared
            archive.write(path, path.relative_to(public))
        palette = public / 'assets/party-theme.css'
        archive.write(palette, palette.relative_to(public))
