import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_TEXT_BLOB_BYTES = 1024 * 1024;
const OBJECTS_PER_BATCH = 48;
const OUTPUT_LIMIT = 128 * 1024 * 1024;

const privateNamePattern = /(?:API[_-]?KEY|ACCESS[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|SERVICE[_-]?ROLE|CREDENTIAL|DATABASE[_-]?URL|CONNECTION[_-]?STRING|AUTHORIZATION|BEARER)/i;
const explicitPrivateNamePattern = /(?:SECRET|PASSWORD|PASSWD|PRIVATE|SERVICE[_-]?ROLE|CREDENTIAL|DATABASE[_-]?URL|CONNECTION[_-]?STRING|AUTHORIZATION|BEARER)/i;
const publicNamePattern = /(?:^|_)(?:PUBLIC|PUBLISHABLE|ANON)(?:_|$)/i;
const assignmentPattern = /^\s*(?:export\s+)?(?:(?:const|let|var)\s+)?["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*[:=]\s*["'`]?([^\s"'`,;}#]+)/;
const placeholderPattern = /^(?:<[^>]+>|your(?:[_-].*)?|replace(?:[_-].*)?|change[_-]?me|example|sample|placeholder|dummy|test|none|null|undefined|xxx+|\*+|\$\{?[A-Za-z_][A-Za-z0-9_]*}?|process\.env\..+|import\.meta\.env\..+)$/i;

const knownSecretPatterns = [
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key pattern' },
  { regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, label: 'GitHub token pattern' },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, label: 'GitHub token pattern' },
  { regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{12,}\b/g, label: 'payment secret key pattern' },
  { regex: /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g, label: 'Slack token pattern' },
  { regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g, label: 'Google API key pattern' },
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, label: 'private key block' },
];

export function isEnvironmentFilePath(filePath) {
  const name = filePath.replaceAll('\\', '/').split('/').at(-1) ?? filePath;
  return /^\.env(?:\.|$)/i.test(name);
}

function isPlaceholder(value) {
  return placeholderPattern.test(value.trim());
}

function addFinding(findings, finding) {
  const key = [finding.source, finding.path, finding.line ?? '', finding.rule, finding.name ?? ''].join('|');
  if (!findings.some((existing) => existing.key === key)) {
    findings.push({ ...finding, key });
  }
}

export function scanText(filePath, content, source = 'working tree') {
  const findings = [];

  if (isEnvironmentFilePath(filePath)) {
    addFinding(findings, {
      path: filePath,
      line: null,
      source,
      rule: 'tracked-env-file',
      description: 'tracked .env-style file',
    });
  }

  if (typeof content !== 'string' || content.includes('\0')) return findings;

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const assignment = line.match(assignmentPattern);
    if (assignment) {
      const name = assignment[1];
      const value = assignment[2].trim();
      const explicitlyPrivate = explicitPrivateNamePattern.test(name);
      const publicByName = publicNamePattern.test(name) && !explicitlyPrivate;
      if (privateNamePattern.test(name) && !publicByName && value.length >= 4 && !isPlaceholder(value)) {
        addFinding(findings, {
          path: filePath,
          line: index + 1,
          source,
          rule: 'credential-like-assignment',
          name,
          description: 'possible private credential assignment',
        });
      }
    }

    for (const { regex, label } of knownSecretPatterns) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        addFinding(findings, {
          path: filePath,
          line: index + 1,
          source,
          rule: 'known-secret-pattern',
          description: label,
        });
      }
    }
  });

  return findings;
}

export function formatFinding(finding) {
  const location = finding.line === null ? finding.path : `${finding.path}:${finding.line}`;
  const source = finding.source === 'history' ? 'history' : 'tracked file';
  const variable = finding.name ? ` (${finding.name})` : '';
  return `REVIEW [${source}] ${location} — ${finding.description}${variable}`;
}

function runGit(args, cwd, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: OUTPUT_LIMIT,
    ...options,
  });
}

function collectWorkingTreeFindings(root) {
  const findings = [];
  const trackedPaths = runGit(['ls-files', '-z', '--cached'], root)
    .split('\0')
    .filter(Boolean);

  for (const filePath of trackedPaths) {
    let content = '';
    try {
      const absolutePath = resolve(root, ...filePath.split('/'));
      const fileInfo = lstatSync(absolutePath);
      if (fileInfo.isFile() && fileInfo.size <= MAX_TEXT_BLOB_BYTES) {
        content = readFileSync(absolutePath, 'utf8');
      }
    } catch {
      // Missing or unreadable working-tree files are still checked in history.
    }
    findings.push(...scanText(filePath, content, 'working tree'));
  }

  return findings;
}

function parseBatchObjects(buffer) {
  const objects = [];
  let offset = 0;

  while (offset < buffer.length) {
    const headerEnd = buffer.indexOf(10, offset);
    if (headerEnd < 0) break;
    const header = buffer.toString('utf8', offset, headerEnd).split(' ');
    const [objectId, type, sizeText] = header;
    const size = Number(sizeText);
    const contentStart = headerEnd + 1;
    if (!objectId || !Number.isFinite(size) || size < 0 || contentStart + size >= buffer.length + 1) break;
    const content = buffer.subarray(contentStart, contentStart + size);
    objects.push({ objectId, type, size, content });
    offset = contentStart + size + 1;
  }

  return objects;
}

function collectHistoryFindings(root) {
  const findings = [];
  const objectPaths = new Map();
  const objectLines = runGit(['rev-list', '--objects', '--all'], root).split(/\r?\n/);

  for (const entry of objectLines) {
    const separator = entry.indexOf(' ');
    if (separator < 0) continue;
    const objectId = entry.slice(0, separator);
    const objectPath = entry.slice(separator + 1);
    if (!objectPath) continue;
    if (!objectPaths.has(objectId)) objectPaths.set(objectId, new Set());
    objectPaths.get(objectId).add(objectPath);
  }

  const objectIds = [...objectPaths.keys()];
  for (let start = 0; start < objectIds.length; start += OBJECTS_PER_BATCH) {
    const batchIds = objectIds.slice(start, start + OBJECTS_PER_BATCH);
    const metadata = runGit(
      ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
      root,
      { input: `${batchIds.join('\n')}\n` },
    );
    const blobIds = metadata
      .split(/\r?\n/)
      .map((line) => {
        const [objectId, type, sizeText] = line.split(' ');
        return type === 'blob' && Number(sizeText) <= MAX_TEXT_BLOB_BYTES ? objectId : null;
      })
      .filter(Boolean);

    for (let blobStart = 0; blobStart < blobIds.length; blobStart += OBJECTS_PER_BATCH) {
      const blobBatch = blobIds.slice(blobStart, blobStart + OBJECTS_PER_BATCH);
      const result = spawnSync('git', ['cat-file', '--batch'], {
        cwd: root,
        input: `${blobBatch.join('\n')}\n`,
        maxBuffer: OUTPUT_LIMIT,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error('Git could not read one or more history objects.');

      for (const object of parseBatchObjects(result.stdout)) {
        if (object.type !== 'blob' || object.content.includes(0)) continue;
        const content = object.content.toString('utf8');
        for (const filePath of objectPaths.get(object.objectId) ?? []) {
          findings.push(...scanText(filePath, content, 'history'));
        }
      }
    }
  }

  return findings;
}

export function scanRepository(cwd = process.cwd()) {
  const root = runGit(['rev-parse', '--show-toplevel'], cwd).trim();
  const findings = [...collectWorkingTreeFindings(root), ...collectHistoryFindings(root)];
  const unique = new Map();
  for (const finding of findings) {
    const key = [finding.source, finding.path, finding.line ?? '', finding.rule, finding.name ?? ''].join('|');
    unique.set(key, finding);
  }
  return [...unique.values()];
}

function main() {
  const findings = scanRepository();
  if (findings.length === 0) {
    console.log('No tracked .env-style files or likely private credentials were detected in the working tree or available Git history.');
    console.log('This heuristic check cannot guarantee that every secret was found.');
    return;
  }

  console.log(`Repository security review found ${findings.length} item(s):`);
  for (const finding of findings) console.log(formatFinding(finding));
  console.log('Matched credential values are not displayed. Review each item; findings do not prove a credential is active.');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Repository security check could not complete: ${message}`);
    process.exitCode = 2;
  }
}