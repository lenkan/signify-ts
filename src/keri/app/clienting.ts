import { Authenticater } from '../core/authing.ts';
import { HEADER_SIG_TIME } from '../core/httping.ts';
import { ExternalModule, IdentifierManagerFactory } from '../core/keeping.ts';
import { Tier } from '../core/salter.ts';
import { KeriaAdminClient } from './administrating.ts';
import { Identifier } from './aiding.ts';
import { Connection, State } from './connecting.ts';
import { Contacts, Challenges } from './contacting.ts';
import { Agent, Controller } from './controller.ts';
import { Oobis, Operations, KeyEvents, KeyStates, Config } from './coring.ts';
import { Credentials, Ipex, Registries, Schemas } from './credentialing.ts';
import { Delegations } from './delegating.ts';
import { Escrows } from './escrowing.ts';
import { Exchanges } from './exchanging.ts';
import { Groups } from './grouping.ts';
import { Notifications } from './notifying.ts';

const DEFAULT_BOOT_URL = 'http://localhost:3903';

/**
 * An in-memory key manager that can connect to a KERIA Agent and use it to
 * receive messages and act as a proxy for multi-signature operations and delegation operations.
 */
export class SignifyClient {
    public bran: string;
    public readonly connection: Connection;
    public readonly admin: KeriaAdminClient;

    public get url(): string {
        return this.connection.url;
    }

    public get bootUrl(): string {
        return this.admin.url;
    }

    public get controller(): Controller {
        return this.connection.controller;
    }

    public get pidx(): number {
        return this.connection.pidx;
    }

    public get tier(): Tier {
        return this.controller.tier;
    }

    public get authn(): Authenticater | null {
        return this.connection.authn;
    }

    public get agent(): Agent | null {
        return this.connection.agent;
    }

    public get manager(): IdentifierManagerFactory | null {
        return this.connection.manager;
    }

    /**
     * SignifyClient constructor
     * @param {string} url KERIA admin interface URL
     * @param {string} bran Base64 21 char string that is used as base material for seed of the client AID
     * @param {Tier} tier Security tier for generating keys of the client AID (high | mewdium | low)
     * @param {string} bootUrl KERIA boot interface URL
     * @param {ExternalModule[]} externalModules list of external modules to load
     */
    constructor(
        url: string,
        bran: string,
        tier: Tier = Tier.low,
        bootUrl: string = DEFAULT_BOOT_URL,
        externalModules: ExternalModule[] = []
    ) {
        if (bran.length < 21) {
            throw Error('bran must be 21 characters');
        }
        this.bran = bran;

        const controller = new Controller(bran, tier);
        const manager = new IdentifierManagerFactory(
            controller.salter,
            externalModules
        );

        this.connection = new Connection({
            controller,
            manager,
            url,
        });
        this.admin = new KeriaAdminClient(bootUrl);
    }

    get data() {
        return [this.url, this.bran, this.pidx, this.authn];
    }

    /**
     * Boot a KERIA agent
     * @async
     * @returns {Promise<Response>} A promise to the result of the boot
     */
    async boot(): Promise<Response> {
        return await this.admin.boot(this.controller);
    }

    /**
     * Get state of the agent and the client
     * @async
     * @returns {Promise<Response>} A promise to the state
     */
    async state(): Promise<State> {
        return await this.connection.state();
    }

    /**  Connect to a KERIA agent
     * @async
     */
    async connect() {
        await this.connection.connect();
    }

    /**
     * Fetch a resource from the KERIA agent
     * @async
     * @param {string} path Path to the resource
     * @param {string} method HTTP method
     * @param {any} data Data to be sent in the body of the resource
     * @param {Headers} [extraHeaders] Optional extra headers to be sent with the request
     * @returns {Promise<Response>} A promise to the result of the fetch
     */
    async fetch(
        path: string,
        method: string,
        data: any,
        extraHeaders?: Headers
    ): Promise<Response> {
        return await this.connection.fetch(path, method, data, extraHeaders);
    }

    /**
     * Create a Signed Request to fetch a resource from an external URL with headers signed by an AID
     * @async
     * @param {string} aidName Name or alias of the AID to be used for signing
     * @param {string} url URL of the requested resource
     * @param {RequestInit} req Request options should include:
     *     - method: HTTP method
     *     - data Data to be sent in the body of the resource.
     *              If the data is a CESR JSON string then you should also set contentType to 'application/json+cesr'
     *              If the data is a FormData object then you should not set the contentType and the browser will set it to 'multipart/form-data'
     *              If the data is an object then you should use JSON.stringify to convert it to a string and set the contentType to 'application/json'
     *     - contentType Content type of the request.
     * @returns {Promise<Request>} A promise to the created Request
     */
    async createSignedRequest(
        aidName: string,
        url: string,
        req: RequestInit
    ): Promise<Request> {
        const hab = await this.identifiers().get(aidName);
        const keeper = this.manager!.get(hab);

        const authenticator = new Authenticater(
            keeper.signers[0],
            keeper.signers[0].verfer
        );

        const headers = new Headers(req.headers);
        headers.set('Signify-Resource', hab['prefix']);
        headers.set(
            HEADER_SIG_TIME,
            new Date().toISOString().replace('Z', '000+00:00')
        );

        const signed_headers = authenticator.sign(
            new Headers(headers),
            req.method ?? 'GET',
            new URL(url).pathname
        );
        req.headers = signed_headers;

        return new Request(url, req);
    }

    /**
     * Save old client passcode in KERIA agent
     * @async
     * @param {string} passcode Passcode to be saved
     * @returns {Promise<Response>} A promise to the result of the save
     */
    async saveOldPasscode(passcode: string): Promise<Response> {
        const caid = this.controller?.pre;
        const body = { salt: passcode };
        return await fetch(this.url + '/salt/' + caid, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Delete a saved passcode from KERIA agent
     * @async
     * @returns {Promise<Response>} A promise to the result of the deletion
     */
    async deletePasscode(): Promise<Response> {
        const caid = this.controller?.pre;
        return await fetch(this.url + '/salt/' + caid, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Rotate the client AID
     * @async
     * @param {string} nbran Base64 21 char string that is used as base material for the new seed
     * @param {Array<string>} aids List of managed AIDs to be rotated
     * @returns {Promise<Response>} A promise to the result of the rotation
     */
    async rotate(nbran: string, aids: string[]): Promise<Response> {
        const data = this.controller.rotate(nbran, aids);
        return await fetch(this.url + '/agent/' + this.controller.pre, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Get identifiers resource
     * @returns {Identifier}
     */
    identifiers(): Identifier {
        return new Identifier(this.connection);
    }

    /**
     * Get OOBIs resource
     * @returns {Oobis}
     */
    oobis(): Oobis {
        return new Oobis(this.connection);
    }

    /**
     * Get operations resource
     * @returns {Operations}
     */
    operations(): Operations {
        return new Operations(this);
    }

    /**
     * Get keyEvents resource
     * @returns {KeyEvents}
     */
    keyEvents(): KeyEvents {
        return new KeyEvents(this);
    }

    /**
     * Get keyStates resource
     * @returns {KeyStates}
     */
    keyStates(): KeyStates {
        return new KeyStates(this);
    }

    /**
     * Get credentials resource
     * @returns {Credentials}
     */
    credentials(): Credentials {
        return new Credentials(this);
    }

    /**
     * Get IPEX resource
     * @returns {Ipex}
     */
    ipex(): Ipex {
        return new Ipex(this);
    }

    /**
     * Get registries resource
     * @returns {Registries}
     */
    registries(): Registries {
        return new Registries(this);
    }

    /**
     * Get schemas resource
     * @returns {Schemas}
     */
    schemas(): Schemas {
        return new Schemas(this);
    }

    /**
     * Get challenges resource
     * @returns {Challenges}
     */
    challenges(): Challenges {
        return new Challenges(this);
    }

    /**
     * Get contacts resource
     * @returns {Contacts}
     */
    contacts(): Contacts {
        return new Contacts(this);
    }

    /**
     * Get notifications resource
     * @returns {Notifications}
     */
    notifications(): Notifications {
        return new Notifications(this);
    }

    /**
     * Get escrows resource
     * @returns {Escrows}
     */
    escrows(): Escrows {
        return new Escrows(this);
    }

    /**
     * Get groups resource
     * @returns {Groups}
     */
    groups(): Groups {
        return new Groups(this);
    }

    /**
     * Get exchange resource
     * @returns {Exchanges}
     */
    exchanges(): Exchanges {
        return new Exchanges(this);
    }

    /**
     * Get delegations resource
     * @returns {Delegations}
     */
    delegations(): Delegations {
        return new Delegations(this);
    }

    /**
     * Get agent config resource
     * @returns {Config}
     */
    config(): Config {
        return new Config(this);
    }
}
