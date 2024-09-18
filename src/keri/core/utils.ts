import { Counter, CtrDex } from './counter';
import { Seqner } from './seqner';
import { Prefixer } from './prefixer';
import { Saider } from './saider';
import { Serder } from './serder';

export function arrayEquals(ar1: Uint8Array, ar2: Uint8Array) {
    return (
        ar1.length === ar2.length &&
        ar1.every((val, index) => val === ar2[index])
    );
}

export function nowUTC(): Date {
    return new Date();
}

export function intToBytes(value: number, length: number): Uint8Array {
    const byteArray = new Uint8Array(length); // Assuming a 4-byte integer (32 bits)

    for (let index = byteArray.length - 1; index >= 0; index--) {
        const byte = value & 0xff;
        byteArray[index] = byte;
        value = (value - byte) / 256;
    }
    return byteArray;
}

export function bytesToInt(ar: Uint8Array): number {
    let value = 0;
    for (let i = 0; i < ar.length; i++) {
        value = value * 256 + ar[i];
    }
    return value;
}

export function serializeACDCAttachment(anc: Serder): Uint8Array {
    const prefixer = new Prefixer({ qb64: anc.pre });
    const seqner = new Seqner({ sn: anc.sn });
    const saider = new Saider({ qb64: anc.ked['d'] });
    const craw = new Uint8Array();
    const ctr = new Counter({ code: CtrDex.SealSourceTriples, count: 1 }).qb64b;
    const prefix = prefixer.qb64b;
    const seq = seqner.qb64b;
    const said = saider.qb64b;
    const newCraw = new Uint8Array(
        craw.length + ctr.length + prefix.length + seq.length + said.length
    );
    newCraw.set(craw);
    newCraw.set(ctr, craw.length);
    newCraw.set(prefix, craw.length + ctr.length);
    newCraw.set(seq, craw.length + ctr.length + prefix.length);
    newCraw.set(said, craw.length + ctr.length + prefix.length + seq.length);
    return newCraw;
}

export function serializeIssExnAttachment(anc: Serder): Uint8Array {
    const seqner = new Seqner({ sn: anc.sn });
    const ancSaider = new Saider({ qb64: anc.ked['d'] });
    const coupleArray = new Uint8Array(
        seqner.qb64b.length + ancSaider.qb64b.length
    );
    coupleArray.set(seqner.qb64b);
    coupleArray.set(ancSaider.qb64b, seqner.qb64b.length);
    const counter = new Counter({
        code: CtrDex.SealSourceCouples,
        count: 1,
    });
    const counterQb64b = counter.qb64b;
    const atc = new Uint8Array(counter.qb64b.length + coupleArray.length);
    atc.set(counterQb64b);
    atc.set(coupleArray, counterQb64b.length);

    if (atc.length % 4 !== 0) {
        throw new Error(
            `Invalid attachments size: ${atc.length}, non-integral quadlets detected.`
        );
    }
    const pcnt = new Counter({
        code: CtrDex.AttachedMaterialQuadlets,
        count: Math.floor(atc.length / 4),
    });
    const msg = new Uint8Array(pcnt.qb64b.length + atc.length);
    msg.set(pcnt.qb64b);
    msg.set(atc, pcnt.qb64b.length);

    return msg;
}
