# Changelog Bot 🤖

[![Build Status](https://github.com/YOUR_USERNAME/changelog-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/changelog-bot/actions/workflows/ci.yml) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/YOUR_USERNAME/changelog-bot)](https://github.com/YOUR_USERNAME/changelog-bot/releases) [![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful and easy-to-use GitHub Action that automatically generates and updates your `CHANGELOG.md` file based on merged Pull Requests. Say goodbye to manual changelog entries and hello to streamlined, professional release notes!

This action scans for merged PRs, categorizes them based on their labels (e.g., `bug`, `feature`, `breaking-change`), and prepends a beautifully formatted summary to your changelog. It's designed to be a core part of your CI/CD pipeline, ensuring your project's history is always up-to-date.

## Why Use Changelog Bot?

- **✅ Automate Everything:** Stop manually tracking changes. Let the bot do the work.
- **✨ Professional & Consistent:** Generate clean, organized, and professional release notes every time.
- **🏷️ Smart Categorization:** Uses PR labels to intelligently group changes into sections like `Features`, `Bug Fixes`, and `Breaking Changes`.
- **🚀 Accelerate Your Workflow:** Integrates seamlessly into your release process, whether you're creating a new version tag or merging to `main`.
- **👥 Community Friendly:** Makes it easy for contributors to see the impact of their work.

## Features

- **Automatic Changelog Generation:** Scans merged PRs and generates a new entry.
- **Semantic Categorization:** Groups PRs by labels (`feature`, `bug`, `docs`, etc.).
- **Version Stamping:** Automatically adds the version number and date for a release.
- **Customizable Filters:** Include or exclude PRs based on their labels.
- **Flexible Workflow Integration:** Trigger it on pushes, tags, or manually.
- **Zero Configuration (almost):** Works out of the box with sensible defaults.

## Usage

### Basic Usage (on merge to `main`)

This workflow runs every time a PR is merged into the `main` branch. It will add the merged PR to an "Unreleased" section in your `CHANGELOG.md`.

1.  Create a workflow file in your repository at `.github/workflows/update-changelog.yml`:

    ```yaml
    name: Update Changelog

    on:
      push:
        branches:
          - main

    jobs:
      update-changelog:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout code
            uses: actions/checkout@v4
            with:
              # We need the full history to fetch all PRs
              fetch-depth: 0

          - name: Update Changelog
            uses: YOUR_USERNAME/changelog-bot@v1
            with:
              github_token: ${{ secrets.GITHUB_TOKEN }}

          - name: Commit and push changes
            run: |
              git config --local user.email "github-actions[bot]@users.noreply.github.com"
              git config --local user.name "github-actions[bot]"
              git add CHANGELOG.md
              # Commit only if there are changes
              if ! git diff --staged --quiet; then
                git commit -m "docs: update CHANGELOG.md [skip ci]"
                git push
              fi
    ```

### Release Usage (on creating a version tag)

This workflow runs when you push a new version tag (e.g., `v1.2.0`). It will gather all PRs since the last tag and create a new version section in the changelog.

1.  Create a workflow file at `.github/workflows/release.yml`:

    ```yaml
    name: Create Release with Changelog

    on:
      push:
        tags:
          - 'v*'

    jobs:
      release:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout code
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - name: Get version from tag
            id: get_version
            run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

          - name: Update Changelog
            id: changelog
            uses: YOUR_USERNAME/changelog-bot@v1
            with:
              github_token: ${{ secrets.GITHUB_TOKEN }}
              version: ${{ steps.get_version.outputs.VERSION }}

          - name: Commit changelog
            # Only run if the changelog was updated
            if: steps.changelog.outputs.updated == 'true'
            run: |
              git config --local user.email "github-actions[bot]@users.noreply.github.com"
              git config --local user.name "github-actions[bot]"
              git add CHANGELOG.md
              git commit -m "docs: update CHANGELOG for v${{ steps.get_version.outputs.VERSION }}"
              git push

          - name: Create GitHub Release
            uses: softprops/action-gh-release@v1
            with:
              # Use the generated changelog section as the release body
              body_path: CHANGELOG.md
              # Get the release name from the tag
              name: Release v${{ steps.get_version.outputs.VERSION }}
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ```

## Inputs

| Input              | Description                                                                                               | Default          | Required |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ---------------- | :------: |
| `github_token`     | Your GitHub token. Use `${{ secrets.GITHUB_TOKEN }}`.                                                       | -                |  `true`  |
| `changelog_path`   | The path to your changelog file.                                                                          | `CHANGELOG.md`   | `false`  |
| `version`          | The version number for this release (e.g., `1.2.0`). If not provided, changes are added to `[Unreleased]`. | -                | `false`  |
| `include_labels`   | Comma-separated list of PR labels to **only** include. Leave empty to include all merged PRs.             | -                | `false`  |
| `exclude_labels`   | Comma-separated list of PR labels to exclude from the changelog.                                          | `skip-changelog` | `false`  |
| `categorize`       | Automatically categorize changes based on labels (`true`/`false`).                                          | `true`           | `false`  |

## Outputs

| Output          | Description                                    |
| --------------- | ---------------------------------------------- |
| `updated`       | Whether the changelog was updated (`true`/`false`). |
| `changes_count` | The number of changes added to the changelog.  |

## Label Categories

When `categorize` is `true`, the bot uses the following labels to group changes. The first matching label found on a PR determines its category.

| Category               | Labels                                        |
| ---------------------- | --------------------------------------------- |
| 💥 Breaking Changes    | `breaking`, `breaking-change`, `major`        |
| ✨ Features            | `feature`, `enhancement`, `feat`              |
| 🐛 Bug Fixes           | `bug`, `bugfix`, `fix`                        |
| 📚 Documentation       | `documentation`, `docs`                       |
| ⚡ Performance          | `performance`, `perf`                         |
| ♻️ Refactoring         | `refactor`, `refactoring`                     |
| ✅ Tests               | `test`, `tests`                               |
| 🔧 Maintenance         | `chore`, `maintenance`                        |
| 📦 Dependencies        | `dependencies`, `deps`                        |
| 🔄 Other Changes       | (Default if no other category matches)        |

## Contributing

Contributions are welcome! If you have a suggestion or find a bug, please open an issue. For pull requests, please follow the guidelines in `CONTRIBUTING.md`.

## License

This project is licensed under the [MIT License](LICENSE).

