# Project architecture rules

- Keep repository security auditing in a local Node/Git command rather than the browser app, because browser code cannot inspect the Git index or commit history.