"""Package the complete adapted sources and shared dependencies for redistribution."""
from pathlib import Path
import zipfile
root = Path('public/games')
for name in ['taptaptap', 'hextris', 'ohhi', 'flappy']:
    with zipfile.ZipFile(root / (name + '-source.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((root / name).rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(root))
        for shared in ['session.js', 'touch-events.js']:
            archive.write(root / shared, shared)
