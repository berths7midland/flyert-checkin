# GitHub Upload and Secrets Setup

This repository is ready to push to GitHub.

Current local repository:

```text
D:\workspace\flyert-checkin
```

Current branch:

```text
main
```

Configured remote:

```text
https://github.com/berths7midland/flyert-checkin.git
```

## Push

If the GitHub repository already exists, run:

```powershell
cd D:\workspace\flyert-checkin
git push -u origin main
```

If the repository does not exist, create it on GitHub first:

```text
Repository name: flyert-checkin
Visibility: Private recommended
Do not initialize with README, .gitignore, or license
```

Then run the push command above.

## Required GitHub Secret

After pushing, open:

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Create:

```text
FLYERT_COOKIE
```

Paste the full browser Cookie value.

## Optional GitHub Secrets

Add these after the real Flyert check-in request is captured:

```text
FLYERT_CHECKIN_URL
FLYERT_CHECKIN_METHOD
FLYERT_CHECKIN_BODY
FLYERT_CHECKIN_CONTENT_TYPE
FLYERT_SUCCESS_KEYWORDS
FLYERT_ALREADY_KEYWORDS
FLYERT_EXTRA_HEADERS
FLYERT_REFERER
FLYERT_USER_AGENT
FLYERT_SKIP_HOME_CHECK
```

Optional GitHub variable:

```text
FLYERT_BASE_URL
```

## Workflow

The GitHub Actions workflow is:

```text
.github/workflows/flyert-checkin.yml
```

It runs twice daily:

```text
20 0 * * *
40 12 * * *
```

That is about `08:20` and `20:40` Beijing/Singapore time.

Manual run path:

```text
Actions -> Flyert Check-in -> Run workflow
```
