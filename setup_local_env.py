"""Prepare local environment files without replacing teammates' existing values."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def configure(template, destination):
    sample = template.read_text(encoding='utf-8-sig')
    if not destination.exists():
        with destination.open('x', encoding='utf-8') as target:
            target.write(sample)
        print(f'Creado: {destination.relative_to(ROOT)}')
        return
    current = destination.read_text(encoding='utf-8-sig')
    existing_keys = set(re.findall(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', current, re.M))
    missing = [line for line in sample.splitlines()
               if '=' in line and not line.lstrip().startswith('#')
               and line.split('=', 1)[0].strip() not in existing_keys]
    if missing:
        with destination.open('a', encoding='utf-8') as target:
            target.write('\n# Variables locales faltantes; valores anteriores conservados.\n')
            target.write('\n'.join(missing) + '\n')
    print(f'Conservado: {destination.relative_to(ROOT)}; variables añadidas: {len(missing)}')


def main():
    configure(ROOT / 'backend/.env.example', ROOT / 'backend/.env')
    frontend = ROOT / 'frontend'
    # Vite prioritizes .env.local. Reuse it when present; otherwise preserve .env.
    destination = frontend / '.env.local'
    if not destination.exists() and (frontend / '.env').exists():
        destination = frontend / '.env'
    configure(frontend / '.env.example', destination)
    print('Revisa DB_NAME, DB_USER y DB_PASSWORD en backend/.env antes de migrar.')
    print('No se modificaron valores existentes ni se publicaron credenciales.')


if __name__ == '__main__':
    main()
