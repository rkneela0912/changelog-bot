const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const path = require('path');

/**
 * Categorizes a PR based on its labels
 */
function categorizeChange(labels) {
  const labelNames = labels.map(l => l.name.toLowerCase());
  
  if (labelNames.some(l => ['breaking', 'breaking-change', 'major'].includes(l))) {
    return '💥 Breaking Changes';
  }
  if (labelNames.some(l => ['feature', 'enhancement', 'feat'].includes(l))) {
    return '✨ Features';
  }
  if (labelNames.some(l => ['bug', 'bugfix', 'fix'].includes(l))) {
    return '🐛 Bug Fixes';
  }
  if (labelNames.some(l => ['documentation', 'docs'].includes(l))) {
    return '📚 Documentation';
  }
  if (labelNames.some(l => ['performance', 'perf'].includes(l))) {
    return '⚡ Performance';
  }
  if (labelNames.some(l => ['refactor', 'refactoring'].includes(l))) {
    return '♻️ Refactoring';
  }
  if (labelNames.some(l => ['test', 'tests'].includes(l))) {
    return '✅ Tests';
  }
  if (labelNames.some(l => ['chore', 'maintenance'].includes(l))) {
    return '🔧 Maintenance';
  }
  if (labelNames.some(l => ['dependencies', 'deps'].includes(l))) {
    return '📦 Dependencies';
  }
  
  return '🔄 Other Changes';
}

/**
 * Formats a single PR entry for the changelog
 */
function formatChangelogEntry(pr, categorize) {
  const title = pr.title;
  const number = pr.number;
  const author = pr.user.login;
  const url = pr.html_url;
  
  return `- ${title} ([#${number}](${url})) by @${author}`;
}

/**
 * Groups PRs by category
 */
function groupByCategory(prs, shouldCategorize) {
  if (!shouldCategorize) {
    return { '🔄 Changes': prs };
  }
  
  const grouped = {};
  
  for (const pr of prs) {
    const category = categorizeChange(pr.labels);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(pr);
  }
  
  return grouped;
}

/**
 * Generates the changelog content for the new version
 */
function generateChangelogSection(version, prs, shouldCategorize) {
  const date = new Date().toISOString().split('T')[0];
  const versionHeader = version ? `## [${version}] - ${date}` : `## [Unreleased]`;
  
  const grouped = groupByCategory(prs, shouldCategorize);
  
  let content = `${versionHeader}\n\n`;
  
  // Sort categories to show breaking changes first
  const categoryOrder = [
    '💥 Breaking Changes',
    '✨ Features',
    '🐛 Bug Fixes',
    '⚡ Performance',
    '♻️ Refactoring',
    '📚 Documentation',
    '✅ Tests',
    '📦 Dependencies',
    '🔧 Maintenance',
    '🔄 Other Changes',
    '🔄 Changes'
  ];
  
  for (const category of categoryOrder) {
    if (grouped[category] && grouped[category].length > 0) {
      content += `### ${category}\n\n`;
      for (const pr of grouped[category]) {
        content += formatChangelogEntry(pr, shouldCategorize) + '\n';
      }
      content += '\n';
    }
  }
  
  return content;
}

/**
 * Fetches merged PRs since the last release
 */
async function fetchMergedPRs(octokit, owner, repo, includeLabels, excludeLabels) {
  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
    per_page: 100
  });
  
  // Filter for merged PRs only
  let mergedPRs = pulls.filter(pr => pr.merged_at);
  
  // Apply label filters
  if (excludeLabels && excludeLabels.length > 0) {
    mergedPRs = mergedPRs.filter(pr => {
      const prLabels = pr.labels.map(l => l.name.toLowerCase());
      return !excludeLabels.some(exclude => prLabels.includes(exclude.toLowerCase()));
    });
  }
  
  if (includeLabels && includeLabels.length > 0) {
    mergedPRs = mergedPRs.filter(pr => {
      const prLabels = pr.labels.map(l => l.name.toLowerCase());
      return includeLabels.some(include => prLabels.includes(include.toLowerCase()));
    });
  }
  
  return mergedPRs;
}

/**
 * Updates or creates the CHANGELOG.md file
 */
async function updateChangelog(changelogPath, newContent) {
  let existingContent = '';
  
  try {
    existingContent = await fs.readFile(changelogPath, 'utf8');
  } catch (error) {
    // File doesn't exist, create a new one with header
    existingContent = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }
  
  // Find where to insert the new content
  // Look for the first ## heading after the main # Changelog heading
  const lines = existingContent.split('\n');
  let insertIndex = -1;
  let foundMainHeading = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      foundMainHeading = true;
      continue;
    }
    if (foundMainHeading && lines[i].startsWith('## ')) {
      insertIndex = i;
      break;
    }
  }
  
  let updatedContent;
  if (insertIndex === -1) {
    // No existing version sections, append to the end
    updatedContent = existingContent.trimEnd() + '\n\n' + newContent;
  } else {
    // Insert before the first version section
    lines.splice(insertIndex, 0, newContent);
    updatedContent = lines.join('\n');
  }
  
  await fs.writeFile(changelogPath, updatedContent);
}

/**
 * Main function
 */
async function run() {
  try {
    // Get inputs
    const token = core.getInput('github_token', { required: true });
    const changelogPath = core.getInput('changelog_path') || 'CHANGELOG.md';
    const version = core.getInput('version');
    const includeLabelsInput = core.getInput('include_labels');
    const excludeLabelsInput = core.getInput('exclude_labels');
    const shouldCategorize = core.getInput('categorize') === 'true';
    
    // Parse label inputs
    const includeLabels = includeLabelsInput 
      ? includeLabelsInput.split(',').map(l => l.trim()).filter(l => l)
      : [];
    const excludeLabels = excludeLabelsInput
      ? excludeLabelsInput.split(',').map(l => l.trim()).filter(l => l)
      : [];
    
    core.info(`Changelog path: ${changelogPath}`);
    core.info(`Version: ${version || 'Unreleased'}`);
    core.info(`Categorize: ${shouldCategorize}`);
    
    // Get GitHub context
    const context = github.context;
    const octokit = github.getOctokit(token);
    
    const { owner, repo } = context.repo;
    
    core.info(`Repository: ${owner}/${repo}`);
    
    // Fetch merged PRs
    core.info('Fetching merged pull requests...');
    const mergedPRs = await fetchMergedPRs(octokit, owner, repo, includeLabels, excludeLabels);
    
    if (mergedPRs.length === 0) {
      core.warning('No merged pull requests found to add to changelog.');
      core.setOutput('updated', 'false');
      core.setOutput('changes_count', '0');
      return;
    }
    
    core.info(`Found ${mergedPRs.length} merged pull requests`);
    
    // Generate changelog content
    const changelogContent = generateChangelogSection(version, mergedPRs, shouldCategorize);
    
    // Update the changelog file
    const fullPath = path.resolve(process.cwd(), changelogPath);
    await updateChangelog(fullPath, changelogContent);
    
    core.info(`✅ Successfully updated ${changelogPath}`);
    core.setOutput('updated', 'true');
    core.setOutput('changes_count', mergedPRs.length.toString());
    
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();

