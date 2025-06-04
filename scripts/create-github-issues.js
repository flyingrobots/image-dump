#!/usr/bin/env node

/**
 * Script to create GitHub issues from feature specifications
 * 
 * Usage: node scripts/create-github-issues.js [--dry-run]
 * 
 * This will:
 * 1. Read all feature specs from docs/features/
 * 2. Create corresponding GitHub issues
 * 3. Organize them into milestones
 */

const fs = require('fs').promises;
const path = require('path');

// Feature categories mapped to milestones
const MILESTONES = {
  'security': 'Phase 4: Security & Validation',
  'api': 'Phase 5: Web Interface & API',
  'developer': 'Phase 6: Developer Experience',
  'advanced': 'Phase 7: Advanced Image Processing',
  'monitoring': 'Phase 8: Infrastructure & Monitoring',
  'intelligence': 'Phase 9: Intelligence & Automation'
};

// Feature list with categories
const FEATURES = [
  // Security & Validation
  { file: 'image-validation.md', milestone: 'security', priority: 'high' },
  { file: 'resource-limits.md', milestone: 'security', priority: 'high' },
  { file: 'malicious-detection.md', milestone: 'security', priority: 'high' },
  
  // API & Web Interface
  { file: 'rest-api.md', milestone: 'api', priority: 'high' },
  { file: 'web-ui.md', milestone: 'api', priority: 'medium' },
  { file: 'batch-operations.md', milestone: 'api', priority: 'medium' },
  
  // Developer Experience
  { file: 'vscode-extension.md', milestone: 'developer', priority: 'medium' },
  { file: 'cli-packaging.md', milestone: 'developer', priority: 'medium' },
  { file: 'pre-commit-hooks.md', milestone: 'developer', priority: 'low' },
  
  // Advanced Processing
  { file: 'blurhash-generation.md', milestone: 'advanced', priority: 'medium' },
  { file: 'heic-support.md', milestone: 'advanced', priority: 'high' },
  { file: 'svg-optimization.md', milestone: 'advanced', priority: 'medium' },
  
  // Monitoring
  { file: 'bandwidth-tracking.md', milestone: 'monitoring', priority: 'high' },
  { file: 'performance-metrics.md', milestone: 'monitoring', priority: 'medium' },
  { file: 'error-alerting.md', milestone: 'monitoring', priority: 'high' },
  
  // Intelligence
  { file: 'smart-cropping.md', milestone: 'intelligence', priority: 'low' },
  { file: 'duplicate-detection.md', milestone: 'intelligence', priority: 'medium' },
  { file: 'content-aware-compression.md', milestone: 'intelligence', priority: 'low' }
];

async function parseFeatureSpec(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract title
    const titleMatch = lines[0].match(/^# Feature: (.+)$/);
    const title = titleMatch ? titleMatch[1] : 'Unknown Feature';
    
    // Extract overview
    const overviewIndex = lines.findIndex(line => line.includes('## Overview'));
    let overview = '';
    if (overviewIndex !== -1) {
      for (let i = overviewIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith('##')) break;
        overview += lines[i] + '\n';
      }
    }
    
    return { title, overview: overview.trim() };
  } catch (error) {
    return null;
  }
}

async function generateIssueContent(feature) {
  const specPath = path.join(__dirname, '../docs/features', feature.file);
  const spec = await parseFeatureSpec(specPath);
  
  if (!spec) {
    return {
      title: feature.file.replace('.md', '').replace(/-/g, ' '),
      body: `Feature specification needed. See docs/features/${feature.file}`
    };
  }
  
  const labels = [
    'enhancement',
    `priority:${feature.priority}`,
    MILESTONES[feature.milestone].toLowerCase().split(':')[0]
  ];
  
  const body = `
${spec.overview}

## 📋 Implementation Tracking

This issue tracks the implementation of the ${spec.title} feature.

**Milestone**: ${MILESTONES[feature.milestone]}  
**Priority**: ${feature.priority}  
**Specification**: [View Full Spec](../docs/features/${feature.file})

## Tasks

- [ ] Review and finalize specification
- [ ] Design implementation approach
- [ ] Implement core functionality
- [ ] Add comprehensive tests
- [ ] Update documentation
- [ ] Create usage examples

## Acceptance Criteria

See the [full specification](../docs/features/${feature.file}) for detailed acceptance criteria and test plans.

---
*This issue was generated from the feature specification. Please keep the spec document updated as implementation progresses.*
`;

  return {
    title: `[Feature] ${spec.title}`,
    body: body.trim(),
    labels,
    milestone: MILESTONES[feature.milestone]
  };
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log(isDryRun ? '🔍 DRY RUN MODE\n' : '🚀 Creating GitHub Issues\n');
  
  console.log('The following issues would be created:\n');
  
  for (const feature of FEATURES) {
    const issue = await generateIssueContent(feature);
    
    console.log(`📝 ${issue.title}`);
    console.log(`   Milestone: ${issue.milestone}`);
    console.log(`   Labels: ${issue.labels.join(', ')}`);
    console.log('');
    
    if (isDryRun && process.argv.includes('--verbose')) {
      console.log('   Body Preview:');
      console.log('   ' + issue.body.split('\n').slice(0, 5).join('\n   '));
      console.log('   ...\n');
    }
  }
  
  if (!isDryRun) {
    console.log(`
To actually create these issues, you'll need to use the GitHub CLI:

1. Install GitHub CLI: https://cli.github.com/
2. Authenticate: gh auth login
3. Run the issue creation commands:
`);
    
    for (const feature of FEATURES) {
      const issue = await generateIssueContent(feature);
      const labels = issue.labels.join(',');
      console.log(`gh issue create --title "${issue.title}" --body "${issue.body.replace(/"/g, '\\"')}" --label "${labels}"`);
    }
  } else {
    console.log('\nTo create these issues, run without --dry-run flag');
  }
}

main().catch(console.error);