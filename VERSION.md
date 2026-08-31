# Version

2.0.1

The single source of truth for the release version. Raise it in a `develop` →
`master` pull request so that CI builds and publishes a release after the merge
(without a bump, no release happens). The firmware picks this version up
automatically when the package is built (`device/version.py` is generated).
