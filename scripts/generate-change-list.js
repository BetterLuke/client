'use strict';

const { execSync } = require('child_process');

const wrapText = require('wrap-text');

/**
 * Return a `Date` indicating when a Git tag was created.
 */
function getTagDate(tag) {
  const result = execSync(`git tag --list "${tag}" "--format=%(taggerdate)"`, {
    encoding: 'utf-8',
  });
  return new Date(result.trim());
}

/**
 * Return the name of the most recently created Git tag.
 */
function getLastTag() {
  const result = execSync('git tag --list --sort=-taggerdate', {
    encoding: 'utf-8',
  });
  const tags = result.split('\n').map(line => line.trim());

  if (tags.length === 0) {
    return null;
  }
  return tags[0];
}

/**
 * Iterate over pages of items in a GitHub API response and yield each item.
 */
async function* iterateItems(octokit, response) {
  let isFirstPage = true;
  while (isFirstPage || octokit.hasNextPage(response)) {
    isFirstPage = false;
    for (let item of response.data) {
      yield item;
    }
    response = await octokit.getNextPage(response);
  }
}

/**
 * Return a list of PRs merged since `tag`, sorted in ascending order of merge date.
 */
async function getPRsMergedSince(octokit, org, repo, tag) {
  const tagDate = getTagDate(tag);

  let response = await octokit.pullRequests.getAll({
    owner: org,
    repo,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
  });

  const prs = [];
  for await (const pr of iterateItems(octokit, response)) {
    if (!pr.merged_at) {
      // This PR was closed without being merged.
      continue;
    }

    // Stop once we get to a PR that was last updated before the tag was created.
    const lastUpdateDate = new Date(pr.updated_at);
    if (lastUpdateDate < tagDate) {
      break;
    }

    // Only include PRs which were merged _after_ the tag was created.
    const mergeDate = new Date(pr.merged_at);
    if (mergeDate > tagDate) {
      prs.push(pr);
    }
  }

  // Sort PRs by merge date in ascending order.
  return prs.sort((a, b) => {
    const aMergedAt = new Date(a.merged_at);
    const bMergedAt = new Date(b.merged_at);
    return aMergedAt < bMergedAt ? -1 : 1;
  });
}

function currentGitHubRepo() {
  return {
    org: 'hypothesis',
    repo: 'client',
  };
}

/**
 * Format a list of pull requests from the GitHub API into a markdown list.
 *
 * Each item in the list includes the PR title, number and link.
 */
function formatChangeList(pullRequests) {
  return pullRequests
    .map(pr => `- ${pr.title} [#${pr.number}](${pr.url})`)
    .map(item => wrapText(item, 90))
    // Align the start of lines after the first with the text in the first line.
    .map(item => item.replace(/\n/mg, '\n  '))
    .join('\n\n');
}

/**
 * Return a markdown-formatted changelog of changes since a given tag.
 */
async function changelistSinceTag(octokit, tag=getLastTag()) {
  const { org, repo } = currentGitHubRepo();
  const mergedPRs = await getPRsMergedSince(octokit, org, repo, tag);
  return formatChangeList(mergedPRs);
}

module.exports = {
  changelistSinceTag,
};
