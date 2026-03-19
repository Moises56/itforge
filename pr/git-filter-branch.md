git filter-branch --env-filter '
export GIT_AUTHOR_NAME="Moises56"
export GIT_AUTHOR_EMAIL="moiavil56@gmail.com"
export GIT_COMMITTER_NAME="Moises56"
export GIT_COMMITTER_EMAIL="moiavil56@gmail.com"
' --force -- --all

# Primero verifica qué emails tienen los commits
git log --format="%an <%ae>" --all

# Ahora reescribe TODOS los commits (reemplaza tu-email con tu email real de GitHub)
git filter-branch -f --env-filter '
export GIT_AUTHOR_NAME="Moises56"
export GIT_AUTHOR_EMAIL="moiavil56@gmail.com"
export GIT_COMMITTER_NAME="Moises56"
export GIT_COMMITTER_EMAIL="moiavil56@gmail.com"
' -- --all

# Force push
git push --force origin main