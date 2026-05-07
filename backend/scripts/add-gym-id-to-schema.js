/**
 * Script to add gym_id field to ALL studio_template models in the Prisma schema.
 *
 * For each model that has @@schema("studio_template"):
 *  1. Adds `gym_id String @db.Uuid` after the `id` line
 *  2. Adds `@@index([gym_id])` before the @@map line
 *
 * Run: node backend/scripts/add-gym-id-to-schema.js
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const lines = fs.readFileSync(SCHEMA_PATH, 'utf-8').split('\n');

const output = [];
let insideModel = false;
let currentModelName = '';
let isStudioTemplate = false;
let hasGymId = false;
let idLineIndex = -1;
let mapLineIndex = -1;
let modelStartIndex = -1;

// Buffer to collect a full model, then decide whether to modify
let modelBuffer = [];

function processModel(buffer, isTemplate) {
  if (!isTemplate) {
    return buffer; // Not a studio_template model, pass through unchanged
  }

  // Check if gym_id already exists
  const alreadyHasGymId = buffer.some(line => /^\s+gym_id\s/.test(line));
  if (alreadyHasGymId) {
    return buffer; // Already has gym_id
  }

  const result = [];
  let addedGymId = false;
  let addedIndex = false;

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer[i];
    result.push(line);

    // After the @id line, add gym_id
    if (!addedGymId && /^\s+\w+\s+.*@id\b/.test(line)) {
      // Determine indentation from the id line
      const indent = line.match(/^(\s+)/)?.[1] || '  ';
      result.push(`${indent}gym_id          String   @db.Uuid`);
      addedGymId = true;
    }

    // Before @@map, add @@index([gym_id]) if not already there
    if (!addedIndex && /^\s+@@map\(/.test(line)) {
      const indent = line.match(/^(\s+)/)?.[1] || '  ';
      // Insert before @@map
      result.splice(result.length - 1, 0, `${indent}@@index([gym_id])`);
      addedIndex = true;
    }
  }

  return result;
}

let buffer = [];
let inModel = false;
let templateModel = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (/^model\s+\w+\s*\{/.test(line)) {
    // Starting a new model
    inModel = true;
    templateModel = false;
    buffer = [line];
    continue;
  }

  if (inModel) {
    buffer.push(line);

    if (/@@schema\("studio_template"\)/.test(line)) {
      templateModel = true;
    }

    // End of model
    if (/^\}/.test(line.trim()) && line.trim() === '}') {
      const processed = processModel(buffer, templateModel);
      output.push(...processed);
      inModel = false;
      buffer = [];
      continue;
    }
    continue;
  }

  output.push(line);
}

// Write back
fs.writeFileSync(SCHEMA_PATH, output.join('\n'));
console.log('Done! gym_id added to all studio_template models.');
console.log('Run `npx prisma format` to clean up formatting.');
