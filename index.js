const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the git URL from command line arguments
const repoUrl = process.argv[2]; // First argument is the URL
if (!repoUrl) {
    console.error('Usage: node script.js <repository-url>');
    process.exit(1);
}

const cloneDir = 'cloned-repo'; // directory to clone the repo into

try {
    // Clone the repository without checkout
    console.log('Cloning the repository...');
    execSync(`git clone --no-checkout --single-branch --depth=1 ${repoUrl} ${cloneDir}`, { stdio: 'inherit' });

    // Change directory to the cloned repository
    process.chdir(cloneDir);

    // List files and their sizes
    console.log('Listing files and their sizes...');
    const files = execSync('git ls-tree -r HEAD --name-only', { encoding: 'utf-8' }).trim().split('\n');

    const fileSizes = files.map(file => {
        const size = execSync(`git cat-file -s "HEAD:${file}"`, { encoding: 'utf-8' }).trim();
        return { file, size: parseInt(size, 10) };
    });

    // Sort files by size in descending order
    fileSizes.sort((a, b) => b.size - a.size);

    // Output the largest files
    console.log('Largest files in the repository:');
    let table =[]
    fileSizes.slice(0, 10).forEach(({ file, size }, index) => {
        const sizeInMB = (size / (1024 * 1024)).toFixed(0);
        const extension = path.extname(file).slice(1).toUpperCase();
        table.push({ Ext: extension, Size: sizeInMB + ' MB', File: file })
    });
    console.table(table);

} catch (error) {
    console.error('Error:', error.message);
} finally {
    // Clean up by deleting the cloned repository
    process.chdir('..');
    fs.rmSync(cloneDir, { recursive: true, force: true });
}

