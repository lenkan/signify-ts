import { assert, beforeEach, describe, expect, it } from 'vitest';
import libsodium from 'libsodium-wrappers-sumo';
import { MockConnection } from './test-utils.ts';
import { Challenges, Contacts } from 'signify-ts';

const url = 'http://127.0.0.1:3901';

let contacts: Contacts;
let challenges: Challenges;
let connection: MockConnection;

beforeEach(async () => {
    await libsodium.ready;
    connection = new MockConnection();
    contacts = new Contacts(connection);
    challenges = new Challenges(connection);
});

describe('Contacting', () => {
    it('list contacts with filter and group', async () => {
        await contacts.list('mygroup', 'company', 'mycompany');
        const lastCall = connection.fetch.mock.lastCall!;
        assert.equal(
            lastCall[0],
            '/contacts?group=mygroup&filter_field=company&filter_value=mycompany'
        );
        assert.equal(lastCall[1], 'GET');
    });

    it('get contact by prefix', async () => {
        await contacts.get('EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao');
        const lastCall = connection.fetch.mock.lastCall!;

        expect(lastCall).toMatchObject([
            '/contacts/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao',
            'GET',
        ]);
    });

    it('add contact info', async () => {
        const info = {
            name: 'John Doe',
            company: 'My Company',
        };
        await contacts.add(
            'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao',
            info
        );
        const lastCall = connection.fetch.mock.lastCall!;
        const lastBody = JSON.parse(lastCall[1]!.body!.toString());
        assert.equal(
            lastCall[0]!,
            url + '/contacts/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao'
        );
        assert.equal(lastCall[1]!.method, 'POST');
        assert.deepEqual(lastBody, info);
    });

    it('update contact info', async () => {
        const info = {
            name: 'John Doe',
            company: 'My Company',
        };

        await contacts.update(
            'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao',
            info
        );
        const lastCall = connection.fetch.mock.lastCall!;
        const lastBody = JSON.parse(lastCall[1]!.body!.toString());
        assert.equal(
            lastCall[0]!,
            url + '/contacts/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao'
        );
        assert.equal(lastCall[1]!.method, 'PUT');
        assert.deepEqual(lastBody, info);
    });

    it('delete contact', async () => {
        await contacts.delete('EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao');
        const lastCall = connection.fetch.mock.lastCall!;
        assert.equal(
            lastCall[0]!,
            '/contacts/EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao'
        );
        assert.equal(lastCall[1]!.method, 'DELETE');
        assert.equal(lastCall[1]!.body, undefined);
    });
});

describe('Challenges', () => {
    it('Challenges', async () => {
        await challenges.generate(128);
        let lastCall =
            connection.fetch.mock.calls[
                connection.fetch.mock.calls.length - 1
            ]!;
        assert.equal(lastCall[0]!, url + '/challenges?strength=128');
        assert.equal(lastCall[1]!.method, 'GET');

        const words = [
            'shell',
            'gloom',
            'mimic',
            'cereal',
            'stool',
            'furnace',
            'nominee',
            'nation',
            'sauce',
            'sausage',
            'rather',
            'venue',
        ];
        await challenges.respond(
            'aid1',
            'EG2XjQN-3jPN5rcR4spLjaJyM4zA6Lgg-Hd5vSMymu5p',
            words
        );
        lastCall =
            connection.fetch.mock.calls[
                connection.fetch.mock.calls.length - 1
            ]!;
        assert.equal(lastCall[0]!, url + '/identifiers/aid1/exchanges');
        assert.equal(lastCall[1]!.method, 'POST');
        let lastBody = JSON.parse(lastCall[1]!.body!.toString());
        assert.equal(lastBody.tpc, 'challenge');
        assert.equal(lastBody.exn.r, '/challenge/response');
        assert.equal(
            lastBody.exn.i,
            'ELUvZ8aJEHAQE-0nsevyYTP98rBbGJUrTj5an-pCmwrK'
        );
        assert.deepEqual(lastBody.exn.a.words, words);
        assert.equal(lastBody.sigs[0].length, 88);

        await challenges.verify(
            'EG2XjQN-3jPN5rcR4spLjaJyM4zA6Lgg-Hd5vSMymu5p',
            words
        );
        lastCall =
            connection.fetch.mock.calls[
                connection.fetch.mock.calls.length - 1
            ]!;
        assert.equal(
            lastCall[0]!,
            url +
                '/challenges_verify/EG2XjQN-3jPN5rcR4spLjaJyM4zA6Lgg-Hd5vSMymu5p'
        );
        assert.equal(lastCall[1]!.method, 'POST');
        lastBody = JSON.parse(lastCall[1]!.body!.toString());
        assert.deepEqual(lastBody.words, words);

        await challenges.responded(
            'EG2XjQN-3jPN5rcR4spLjaJyM4zA6Lgg-Hd5vSMymu5p',
            'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao'
        );
        lastCall =
            connection.fetch.mock.calls[
                connection.fetch.mock.calls.length - 1
            ]!;
        assert.equal(
            lastCall[0]!,
            url +
                '/challenges_verify/EG2XjQN-3jPN5rcR4spLjaJyM4zA6Lgg-Hd5vSMymu5p'
        );
        assert.equal(lastCall[1]!.method, 'PUT');
        lastBody = JSON.parse(lastCall[1]!.body!.toString());
        assert.equal(
            lastBody.said,
            'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao'
        );
    });
});
