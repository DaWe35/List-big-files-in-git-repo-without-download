const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optionally, use a GitHub token for authenticated requests

// Read the git URL from environment variable
const repoUrl = process.env.GIT_REPO_URL;
if (!repoUrl) {
    console.error('Error: GIT_REPO_URL environment variable not set');
    process.exit(1);
}

// Define a list of common files/directories to exclude
const exclusions = [
    'node_modules/',
    'tests/',
    'package.json',
    'package-lock.json',
    '.gitignore',
    '.git',
    'yarn.lock',
    '.npmrc',
    '.editorconfig',
    '.prettierrc',
    '.eslintrc',
    'README.md',
    'LICENSE',
    'CHANGELOG.md'
];

async function getRepos(url) {
    let repos = [];
    const usernameOrOrg = url.split('/').pop();
    const apiUrl = `${GITHUB_API_URL}/users/${usernameOrOrg}/repos`;

    try {
        const response = await axios.get(apiUrl, {
            headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
        });
        repos = response.data.map(repo => repo.clone_url);
    } catch (error) {
        console.error(`Error fetching repositories for ${usernameOrOrg}:`, error.message);
        process.exit(1);
    }

    return repos;
}

function analyzeRepo(repoUrl) {
    const cloneDir = 'cloned-repo';

    try {
        // Clone the repository without checkout
        console.log(`Cloning the repository: ${repoUrl}`);
        execSync(`git clone --no-checkout --single-branch --depth=1 ${repoUrl} ${cloneDir}`, { stdio: 'inherit' });

        // Change directory to the cloned repository
        process.chdir(cloneDir);

        // Determine the default branch
        const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf-8' }).trim().split('/').pop();

        // List files and their sizes
        console.log('Listing files and their sizes...');
        const files = execSync(`git ls-tree -r ${defaultBranch} --name-only`, { encoding: 'utf-8' }).trim().split('\n');

        // Filter out excluded files
        const filteredFiles = files.filter(file => !exclusions.some(exclusion => file.includes(exclusion)));

        const fileSizes = filteredFiles.map(file => {
            const size = execSync(`git cat-file -s "${defaultBranch}:${file}"`, { encoding: 'utf-8' }).trim();
            return { file, size: parseInt(size, 10), repoUrl };
        });

        // Clean up by deleting the cloned repository
        process.chdir('..');
        fs.rmSync(cloneDir, { recursive: true, force: true });

        return fileSizes;
    } catch (error) {
        console.error('Error:', error.message);
        process.chdir('..');
        if (fs.existsSync(cloneDir)) {
            fs.rmSync(cloneDir, { recursive: true, force: true });
        }
        return [];
    }
}

async function main() {
    let repos = [];

    if (repoUrl.includes('github.com')) {
        const urlParts = repoUrl.split('/');
        if (urlParts.length === 5 && (urlParts[3] === 'users' || urlParts[3] === 'orgs')) {
            // It's a user or organization URL
            repos = await getRepos(repoUrl);
        } else {
            // It's a repository URL
            repos = [repoUrl];
        }
    } else {
        console.error('Invalid URL format. Must be a GitHub repository or user/organization URL.');
        process.exit(1);
    }

    let allFileSizes = [];

    for (const repo of repos) {
        const fileSizes = analyzeRepo(repo);
        allFileSizes = allFileSizes.concat(fileSizes);
    }

    // Sort files by size in descending order
    allFileSizes.sort((a, b) => b.size - a.size);

    // Output the largest files
    console.log('Largest files across all repositories:');
    let table = [];
    allFileSizes.slice(0, 25).forEach(({ file, size, repoUrl }, index) => {
        const sizeInMB = (size / (1024 * 1024)).toFixed(2);
        const extension = path.extname(file).slice(1).toUpperCase();
        const fileUrl = `${repoUrl.replace(/\.git$/, '')}/blob/${defaultBranch}/${file}`;
        table.push({ Ext: extension, Size: sizeInMB + ' MB', URL: fileUrl });
    });
    console.table(table);
}

main().catch(error => {
    console.error('Error:', error.message);
});
