/* eslint-disable no-undef */
import semver from 'semver';
import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

const TAG_REF_PREFIX = 'refs/tags/v';

async function publish() {
    const packageJSON = JSON.parse(await readFile('./package.json', 'utf8'));
    const ref = process.env.GITHUB_REF;

    const packageVersion = semver.parse(packageJSON.version);

    if (!ref) {
        throw new Error('No GITHUB_REF value set');
    }

    if (!ref.startsWith(TAG_REF_PREFIX)) {
        console.log(`${ref} is not a release tag, exiting`);
        return;
    }

    const tagVersion = semver.parse(ref.substring(11));
    if (!tagVersion) {
        throw new Error(`${tagVersion} is not a valid semver version`);
    }

    if (
        !semver.satisfies(tagVersion, '^' + packageVersion.version, {
            includePrerelease: true,
        })
    ) {
        throw new Error(
            `${tagVersion} does not match package version ${packageVersion}`
        );
    }

    const tag = formatTag(tagVersion);

    packageJSON.name = process.env.NPM_PACKAGE_NAME ?? packageJSON.name;
    packageJSON.version = tagVersion.version;

    await writeFile(
        'package.json',
        JSON.stringify(packageJSON, null, 2) + '\n'
    );

    execSync(`npm publish --tag ${tag}`, { stdio: 'inherit' });
}

await publish();

function formatTag(versionTag) {
    const prerelease = semver.prerelease(versionTag);
    if (prerelease === null) {
        return 'latest';
    }

    if (typeof prerelease[0] !== 'string') {
        throw new Error(`Invalid prerelease tag`);
    }

    return prerelease[0];
}
