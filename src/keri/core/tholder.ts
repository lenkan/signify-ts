import { Matter, NumDex } from './matter';
import { CesrNumber } from './number';
import { Fraction, format, sum, fraction } from 'mathjs';

export interface TholderArgs {
    thold?: number | Fraction[][];
    limen?: string;
    sith?: string | number | (string | string[])[];
}

type WeightedTholderConfig = {
    weighted: true;
    thold: Fraction[][];
    size: number;
    number: undefined;
};

type UnweightedTholderConfig = {
    weighted: false;
    thold: number;
    size: number;
    number: CesrNumber;
};

type TholderConfig = WeightedTholderConfig | UnweightedTholderConfig;

export class Tholder {
    private _config: TholderConfig;

    constructor(kargs: TholderArgs) {
        if (kargs.thold !== undefined) {
            this._config = this._processThold(kargs.thold);
        } else if (kargs.limen != undefined) {
            this._config = this._processLimen(kargs.limen);
        } else if (kargs.sith !== undefined) {
            this._config = this._processSith(kargs.sith);
        } else {
            throw new Error('Missing threshold expression');
        }
    }

    get weighted(): boolean {
        return this._config.weighted;
    }

    get thold(): number | Fraction[][] {
        return this._config.thold;
    }

    get size(): number {
        return this._config.size;
    }

    get limen(): Uint8Array | undefined {
        return this._config.number?.qb64b;
    }

    get sith(): string | string[] | string[][] {
        if (this._config.weighted) {
            const sith = this._config.thold.map((clause: Fraction[]) => {
                return clause.map((c) => {
                    if (0 < Number(c) && Number(c) < 1) {
                        return format(c, { fraction: 'ratio' });
                    } else {
                        return format(c, { fraction: 'decimal' });
                    }
                });
            });

            if (sith.length == 1) {
                return sith[0];
            }

            return sith;
        } else {
            return this.thold.toString(16);
        }
    }

    get json(): string {
        return JSON.stringify(this.sith);
    }

    get num(): number | undefined {
        return this._config.weighted ? undefined : this._config.thold;
    }

    private _processThold(thold: number | Fraction[][]): TholderConfig {
        if (typeof thold === 'number') {
            return this._processUnweighted(thold);
        } else {
            return this._processWeighted(thold);
        }
    }

    private _processLimen(limen: string): TholderConfig {
        const matter = new Matter({ qb64: limen });
        if (NumDex.has(matter.code)) {
            const number = new CesrNumber({
                raw: matter.raw,
                code: matter.code,
            });
            return this._processUnweighted(number.num);
        } else {
            throw new Error('Invalid code for limen=' + matter.code);
        }
    }

    private _processSith(
        sith: string | number | (string | string[])[]
    ): TholderConfig {
        if (typeof sith == 'number') {
            return this._processUnweighted(sith);
        } else if (typeof sith == 'string' && sith.indexOf('[') == -1) {
            return this._processUnweighted(parseInt(sith, 16));
        } else {
            let _sith: unknown = sith;
            if (typeof sith === 'string') {
                _sith = JSON.parse(sith);
            }

            if (!Array.isArray(_sith)) {
                throw new Error('Weight list was not an array');
            }

            if (_sith.length == 0) {
                throw new Error('Empty weight list');
            }

            const mask = _sith.map((x: unknown) => {
                return typeof x !== 'string';
            });

            if (mask.length > 0 && !mask.every((x: boolean) => x)) {
                _sith = [_sith];
            }

            if (!Array.isArray(_sith)) {
                throw new Error('Weight list was not an array');
            }

            for (const c of _sith) {
                const mask = c.map((x: unknown) => {
                    return typeof x === 'string';
                });
                if (mask.length > 0 && !mask.every((x: boolean) => x)) {
                    throw new Error(
                        'Invalid sith, some weights in clause ' +
                            mask +
                            ' are non string'
                    );
                }
            }

            const thold = this._processClauses(_sith);
            return this._processWeighted(thold);
        }
    }

    private _processClauses(sith: string[][]): Fraction[][] {
        const thold: Fraction[][] = [];
        sith.forEach((clause) => {
            thold.push(
                clause.map((w) => {
                    return this.weight(w);
                })
            );
        });
        return thold;
    }

    private _processUnweighted(thold: number): TholderConfig {
        if (thold < 0) {
            throw new Error('Non-positive int threshold = {thold}.');
        }

        return {
            weighted: false,
            thold,
            size: thold,
            number: new CesrNumber({}, thold),
        };
    }

    private _processWeighted(thold: Fraction[][]): TholderConfig {
        for (const clause of thold) {
            if (Number(sum(clause)) < 1) {
                throw new Error(
                    'Invalid sith clause: ' +
                        thold +
                        'all clause weight sums must be >= 1'
                );
            }
        }

        return {
            weighted: true,
            thold,
            size: thold.reduce((acc, currentValue) => {
                return acc + currentValue.length;
            }, 0),
            number: undefined,
        };
    }

    private weight(w: string): Fraction {
        return fraction(w);
    }

    private _satisfy_weighted(indices: number[], thold: Fraction[][]) {
        if (indices.length === 0) {
            return false;
        }

        const indexes: Set<number> = new Set(indices.sort());
        const sats = new Array(indices.length).fill(false);
        for (const idx of indexes) {
            sats[idx] = true;
        }
        let wio = 0;
        for (const clause of thold) {
            let cw = 0;
            for (const w of clause) {
                if (sats[wio]) {
                    cw += Number(w);
                }
                wio += 1;
            }
            if (cw < 1) {
                return false;
            }
        }

        return true;
    }

    public satisfy(indices: number[]): boolean {
        if (this._config.weighted) {
            return this._satisfy_weighted(indices, this._config.thold);
        } else {
            return (
                this._config.thold > 0 && indices.length >= this._config.thold
            ); // at least one
        }
    }
}
