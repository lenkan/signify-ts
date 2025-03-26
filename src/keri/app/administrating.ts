import { Controller } from './controller.ts';

export class KeriaAdminClient {
    url: string;
    constructor(url: string) {
        this.url = url;
    }

    async boot(controller: Controller): Promise<Response> {
        const [evt, sign] = controller.event ?? [];
        const data = {
            icp: evt.sad,
            sig: sign.qb64,
            stem: controller.stem,
            pidx: 1,
            tier: controller.tier,
        };

        return await fetch(this.url + '/boot', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
