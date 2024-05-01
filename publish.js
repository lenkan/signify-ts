/* eslint-disable no-undef */
import semver from 'semver';
import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

function resolveNpmTag(version) {
    const prerelease = semver.prerelease(version);

    if (prerelease === null) {
        return 'latest';
    }

    if (typeof prerelease[0] !== 'string') {
        throw new Error(`Invalid prerelease tag`);
    }

    return prerelease[0];
}

function resolveNpmVersion(ref, packageVersion) {
    if (!ref || !ref.startsWith('/refs/tags/')) {
        const sha = execSync('git rev-parse --short HEAD');
        const version = semver.parse(`${packageVersion}-dev.${sha}`);
        return version;
    }

    const tagVersion = semver.parse(ref.substring(10));
    if (!tagVersion) {
        throw new Error(`${ref} is not a valid semver format`);
    }

    if (
        !semver.satisfies(tagVersion, '^' + packageVersion, {
            includePrerelease: true,
        })
    ) {
        const msg = `${tagVersion} does not match package version ${packageVersion}`;
        throw new Error(msg);
    }

    return tagVersion;
}

const packageJSON = JSON.parse(await readFile('./package.json', 'utf8'));
const tagVersion = resolveNpmVersion(
    process.env.GITHUB_REF,
    packageJSON.version
);
const tag = resolveNpmTag(tagVersion);

packageJSON.name = process.env.NPM_PACKAGE_NAME ?? packageJSON.name;
packageJSON.version = tagVersion.version;

await writeFile('package.json', JSON.stringify(packageJSON, null, 2) + '\n');

execSync(`npm publish --tag ${tag}`, { stdio: 'inherit' });
