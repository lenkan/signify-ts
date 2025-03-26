import { Authenticater } from '../core/authing.ts';
import { HEADER_SIG_TIME } from '../core/httping.ts';
import { IdentifierManagerFactory } from '../core/keeping.ts';
import { Agent, Controller } from './controller.ts';

export interface ConnectionConfig {
    url: string;
    controller: Controller;
    manager?: IdentifierManagerFactory;
}

export interface State {
    agent: any | null;
    controller: any | null;

    ridx: number;
    pidx: number;
}

export class Connection {
    public readonly controller: Controller;
    public readonly url: string;
    pidx: number = 0;

    agent: Agent | null = null;
    manager: IdentifierManagerFactory | null = null;
    authn: Authenticater | null = null;

    constructor(config: ConnectionConfig) {
        this.controller = config.controller;
        this.url = config.url;
        this.manager =
            config.manager ??
            new IdentifierManagerFactory(this.controller.salter);
    }

    /**
     * Get state of the agent and the client
     * @async
     * @returns {Promise<Response>} A promise to the state
     */
    async state(): Promise<State> {
        const caid = this.controller?.pre;

        const res = await fetch(this.url + `/agent/${caid}`);
        if (res.status == 404) {
            throw new Error(`agent does not exist for controller ${caid}`);
        }

        const data = await res.json();

        return {
            agent: data.agent ?? {},
            controller: data.controller ?? {},
            ridx: data.ridx ?? 0,
            pidx: data.pidx ?? 0,
        };
    }

    /**  Connect to a KERIA agent
     * @async
     */
    async connect() {
        const state = await this.state();
        this.pidx = state.pidx;
        this.controller.ridx = state.ridx !== undefined ? state.ridx : 0;

        this.agent = new Agent(state.agent);

        if (this.agent.anchor != this.controller.pre) {
            throw Error(
                'commitment to controller AID missing in agent inception event'
            );
        }

        if (this.controller.serder.sad.s == 0) {
            await this.approveDelegation();
        }

        this.authn = new Authenticater(
            this.controller.signer,
            this.agent.verfer!
        );
    }

    /**
     * Fetch a resource from the KERIA agent
     * @async
     * @param {string} path Path to the resource
     * @param init HTTP method
     * @returns {Promise<Response>} A promise to the result of the fetch
     */
    async fetch(
        path: string,
        init: { method: string; body: unknown; headers?: Headers }
    ): Promise<Response> {
        const headers = new Headers();
        let signed_headers = new Headers();
        const final_headers = new Headers();

        headers.set('Signify-Resource', this.controller.pre);
        headers.set(
            HEADER_SIG_TIME,
            new Date().toISOString().replace('Z', '000+00:00')
        );
        headers.set('Content-Type', 'application/json');

        const method = init.method ?? 'GET';

        const _body = method == 'GET' ? null : JSON.stringify(init.body);

        if (this.authn) {
            signed_headers = this.authn.sign(
                headers,
                method,
                path.split('?')[0]
            );
        } else {
            throw new Error('client need to call connect first');
        }

        signed_headers.forEach((value, key) => {
            final_headers.set(key, value);
        });
        if (init.headers !== undefined) {
            init.headers.forEach((value, key) => {
                final_headers.append(key, value);
            });
        }
        const res = await fetch(this.url + path, {
            method: method,
            body: _body,
            headers: final_headers,
        });
        if (!res.ok) {
            const error = await res.text();
            const message = `HTTP ${method} ${path} - ${res.status} ${res.statusText} - ${error}`;
            throw new Error(message);
        }
        const isSameAgent =
            this.agent?.pre === res.headers.get('signify-resource');
        if (!isSameAgent) {
            throw new Error('message from a different remote agent');
        }

        const verification = this.authn.verify(
            res.headers,
            method,
            path.split('?')[0]
        );
        if (verification) {
            return res;
        } else {
            throw new Error('response verification failed');
        }
    }

    /**
     * Approve the delegation of the client AID to the KERIA agent
     * @async
     * @returns {Promise<Response>} A promise to the result of the approval
     */
    private async approveDelegation(): Promise<Response> {
        const sigs = this.controller.approveDelegation(this.agent!);

        const data = {
            ixn: this.controller.serder.sad,
            sigs: sigs,
        };

        return await fetch(
            this.url + '/agent/' + this.controller.pre + '?type=ixn',
            {
                method: 'PUT',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
