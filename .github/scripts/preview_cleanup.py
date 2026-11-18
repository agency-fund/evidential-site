#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.14"
# dependencies = [
#   "httpx2",
#   "typer",
# ]
# ///
"""Deletes the Cloudflare Previews that a site's workflow creates for pull requests (named pr-<number>).

Used by .github/workflows/preview-cleanup.yaml, once per site (--site www, --site docs). Credentials are read from environment variables
(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_TOKEN, GITHUB_REPOSITORY) by default.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

import httpx2
import typer

# Each site's Previews live on their own Worker, apart from production; keep in sync with PREVIEW_WORKER in
# sites/<site>/Taskfile.yml.
SITES = {"www": "evidential-www-preview", "docs": "evidential-docs-preview"}
PR_PREVIEW_NAME = re.compile(r"^pr-(\d+)$")


def comment_marker(site: str) -> str:
    """Marks the Preview comment on each pull request; keep in sync with .github/actions/deploy-preview/action.yml."""
    return f"<!-- {site}-preview -->"

CLOUDFLARE_PAGE_SIZE = 50

app = typer.Typer(no_args_is_help=True, add_completion=False)


@dataclass(frozen=True)
class Preview:
    id: str
    name: str


def pr_number(preview: Preview) -> int | None:
    """Returns the pull request number for previews named pr-<number>, otherwise None."""
    match = PR_PREVIEW_NAME.match(preview.name)
    return int(match.group(1)) if match else None


def previews_to_delete(
    previews: list[Preview], pull_request_state: Callable[[int], str | None], only_pr: int | None = None
) -> list[Preview]:
    """Selects pr-<number> previews whose pull request is closed (or only `only_pr`'s preview, if given).

    Previews with other names, and those whose pull request can't be found, are never selected.
    """
    selected = []
    for preview in previews:
        number = pr_number(preview)
        if number is None:
            continue
        if only_pr is not None:
            if number == only_pr:
                selected.append(preview)
        elif pull_request_state(number) == "closed":
            selected.append(preview)
    return selected


class Cloudflare:
    def __init__(self, client: httpx2.Client, account_id: str, worker: str):
        self._client = client
        self._previews_path = f"/accounts/{account_id}/workers/workers/{worker}/previews"

    def previews(self) -> list[Preview]:
        previews: list[Preview] = []
        page = 1
        while True:
            response = self._client.get(self._previews_path, params={"per_page": CLOUDFLARE_PAGE_SIZE, "page": page})
            response.raise_for_status()
            batch = response.json()["result"]
            previews.extend(Preview(id=item["id"], name=item["name"]) for item in batch)
            if len(batch) < CLOUDFLARE_PAGE_SIZE:
                return previews
            page += 1

    def delete_preview(self, preview: Preview) -> None:
        self._client.delete(f"{self._previews_path}/{preview.id}").raise_for_status()


class GitHub:
    def __init__(self, client: httpx2.Client, repository: str, site: str):
        self._client = client
        self._repository = repository
        self._site = site

    def pull_request_state(self, number: int) -> str | None:
        """Returns "open" or "closed", or None if there is no such pull request."""
        response = self._client.get(f"/repos/{self._repository}/pulls/{number}")
        if response.status_code == httpx2.codes.NOT_FOUND:
            return None
        response.raise_for_status()
        return response.json()["state"]

    def mark_preview_deleted(self, number: int) -> bool:
        """Rewrites the pull request's preview comment to say the preview is gone. Returns False if there is none."""
        url: str | None = f"/repos/{self._repository}/issues/{number}/comments?per_page=100"
        while url is not None:
            response = self._client.get(url)
            response.raise_for_status()
            for comment in response.json():
                marker = comment_marker(self._site)
                if comment["user"]["login"] == "github-actions[bot]" and comment["body"].startswith(marker):
                    body = f"{marker}\n**{self._site} preview:** deleted when this pull request was closed."
                    self._client.patch(
                        f"/repos/{self._repository}/issues/comments/{comment['id']}", json={"body": body}
                    ).raise_for_status()
                    return True
            url = response.links.get("next", {}).get("url")
        return False


def cloudflare_client(api_token: str, account_id: str, worker: str) -> Cloudflare:
    client = httpx2.Client(
        base_url="https://api.cloudflare.com/client/v4",
        headers={"Authorization": f"Bearer {api_token}"},
        timeout=30,
    )
    return Cloudflare(client, account_id, worker)


def github_client(token: str, repository: str, site: str) -> GitHub:
    client = httpx2.Client(
        base_url="https://api.github.com",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30,
    )
    return GitHub(client, repository, site)


@dataclass(frozen=True)
class Clients:
    cloudflare: Cloudflare
    github: GitHub


def delete_all(cloudflare: Cloudflare, previews: list[Preview]) -> None:
    for preview in previews:
        cloudflare.delete_preview(preview)
        typer.echo(f"Deleted Preview {preview.name}")
    typer.echo(f"Deleted {len(previews)} Preview(s).")


@app.callback()
def main(
    ctx: typer.Context,
    site: Annotated[str, typer.Option(help=f"The site whose Previews to delete: {', '.join(SITES)}.")],
    cloudflare_api_token: Annotated[
        str, typer.Option(envvar="CLOUDFLARE_API_TOKEN", show_default=False, help="Cloudflare API token.")
    ],
    cloudflare_account_id: Annotated[
        str, typer.Option(envvar="CLOUDFLARE_ACCOUNT_ID", show_default=False, help="Cloudflare account ID.")
    ],
    github_token: Annotated[
        str, typer.Option(envvar="GITHUB_TOKEN", show_default=False, help="GitHub token for the repository.")
    ],
    github_repository: Annotated[
        str, typer.Option(envvar="GITHUB_REPOSITORY", show_default=False, help="Repository, as owner/name.")
    ],
):
    """Deletes the Cloudflare Previews of closed pull requests. Pass credentials via the environment variables."""
    if site not in SITES:
        raise typer.BadParameter(f"must be one of: {', '.join(SITES)}", param_hint="--site")
    ctx.obj = Clients(
        cloudflare=cloudflare_client(cloudflare_api_token, cloudflare_account_id, SITES[site]),
        github=github_client(github_token, github_repository, site),
    )


@app.command()
def pull_request_closed(
    ctx: typer.Context,
    number: Annotated[int, typer.Argument(help="Number of the pull request that was closed.")],
):
    """Deletes the Preview of one closed pull request and updates its preview comment."""
    clients: Clients = ctx.obj
    previews = previews_to_delete(clients.cloudflare.previews(), clients.github.pull_request_state, only_pr=number)
    delete_all(clients.cloudflare, previews)
    if clients.github.mark_preview_deleted(number):
        typer.echo(f"Updated the preview comment on #{number}.")


@app.command()
def sweep(ctx: typer.Context):
    """Deletes the Preview of every closed pull request."""
    clients: Clients = ctx.obj
    delete_all(clients.cloudflare, previews_to_delete(clients.cloudflare.previews(), clients.github.pull_request_state))


if __name__ == "__main__":
    app()
