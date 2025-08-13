// Migration script to move hardcoded playbook files to knowledge base
// Note: This script has been executed and the hardcoded files have been removed
import { db } from '../lib/database';
import * as schema from '../lib/database/schema';

// Migration completed - interfaces no longer needed

async function migratePlaybookFiles() {
  console.log('✅ Migration already completed - hardcoded playbook files have been moved to knowledge base');
  console.log('📁 Files migrated:');
  console.log('   - senior-investors-playbook.md');
  console.log('   - playbook-qa.md');
  console.log('   - playbook-timeline.md');
  console.log('🗑️  Original hardcoded TypeScript files have been removed');
  return;

  try {
    // Check if files already exist to avoid duplicates
    const existingFiles = await db.select().from(schema.knowledgeBaseFiles);
    const existingFilenames = new Set(existingFiles.map(f => f.filename));

    for (const { filename, article, fileExtension } of articlesToMigrate) {
      if (existingFilenames.has(filename)) {
        console.log(`⚠️  Skipping ${filename} - already exists in knowledge base`);
        continue;
      }

      console.log(`📝 Migrating ${filename}...`);

      // Convert Article to markdown content
      const markdownContent = convertArticleToMarkdown(article);
      
      // Create indexed content for better search
      const indexedContent = createIndexedContent(article);

      // Insert into knowledge base
      await db.insert(schema.knowledgeBaseFiles).values({
        id: `migrated_${article.id}`,
        filename,
        content: markdownContent,
        fileType: 'text/markdown',
        indexedContent,
        uploadedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully migrated ${filename}`);
    }

    console.log('🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update KnowledgeSearchService to use database');
    console.log('2. Remove hardcoded imports');
    console.log('3. Delete the hardcoded playbook files');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

function convertArticleToMarkdown(article: typeof seniorInvestorsPlaybook): string {
  const markdown = `# ${article.title}

**Category:** ${article.category}  
**Read Time:** ${article.readTime} minutes  
**Last Updated:** ${article.lastUpdated}

## Summary

${article.summary}

## Content

${article.content}

## Tags

${article.tags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ')}
`;

  return markdown;
}

function createIndexedContent(article: typeof seniorInvestorsPlaybook): string {
  // Create searchable content optimized for Q&A matching
  const indexedContent = `
TITLE: ${article.title}

SUMMARY: ${article.summary}

CATEGORY: ${article.category}

TAGS: ${article.tags.join(', ')}

KEY_CONCEPTS: ${extractKeyConcepts(article.content)}

CONTENT: ${article.content}
`.trim();

  return indexedContent;
}

function extractKeyConcepts(content: string): string {
  // Extract key financial concepts from content for better matching
  const keyConcepts: string[] = [];
  
  // Look for numbered lists, bullet points, and key phrases
  const conceptPatterns = [
    /(?:^|\n)[\d\-\*\#]+\.?\s*([^\n]+)/gm,  // Numbered/bulleted items
    /\*\*([^*]+)\*\*/g,  // Bold text
    /## ([^\n]+)/g,      // Headers
    /The (\w+(?:\s+\w+){0,3}) (?:is|are|rule|strategy|approach)/gi  // "The X rule/strategy"
  ];

  for (const pattern of conceptPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      keyConcepts.push(...matches);
    }
  }

  // Add specific financial terms found in content
  const financialTerms = [
    '3% rule', 'withdrawal strategy', 'corpus allocation', 'arbitrage fund', 
    'Nifty 50', 'two-fund portfolio', 'safe bucket', 'growth bucket',
    'sequence of returns', 'healthcare shield', 'estate planning'
  ];

  for (const term of financialTerms) {
    if (content.toLowerCase().includes(term.toLowerCase())) {
      keyConcepts.push(term);
    }
  }

  return Array.from(new Set(keyConcepts))
    .slice(0, 20) // Limit to top 20 concepts
    .join(', ');
}

// Run migration if called directly
if (require.main === module) {
  migratePlaybookFiles()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migratePlaybookFiles };