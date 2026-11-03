# Changelog

Earlier versions are in the git history and the version tags (`v0.4.0` to `v0.9.1`).

## Unreleased

- An upgrade from the page now ends as failed when DSH's plugin manager gives an answer it cannot read; before, that left a promise rejection unhandled, which ends DSH.
