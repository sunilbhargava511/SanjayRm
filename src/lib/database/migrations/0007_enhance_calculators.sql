-- Migration: 0007_enhance_calculators.sql
-- Add enhanced calculator fields to support both URL and code-based calculators

-- Add new columns to calculators table
ALTER TABLE calculators ADD COLUMN calculator_type TEXT DEFAULT 'url';
ALTER TABLE calculators ADD COLUMN code_content TEXT;
ALTER TABLE calculators ADD COLUMN artifact_url TEXT;
ALTER TABLE calculators ADD COLUMN file_name TEXT;
ALTER TABLE calculators ADD COLUMN is_published INTEGER DEFAULT 1;

-- Update existing calculators to have proper calculator_type
UPDATE calculators SET calculator_type = 'url' WHERE calculator_type IS NULL;

-- Make calculator_type NOT NULL after setting defaults
-- Note: SQLite doesn't support ALTER COLUMN, so we'll handle this in the init-database route

-- Update the existing Claude calculator to include artifact URL for reference
UPDATE calculators 
SET 
  artifact_url = 'https://claude.ai/public/artifacts/24299228-9301-464d-ae2d-b367413a6cc7',
  calculator_type = 'url'
WHERE id = 'calc_claude_test';