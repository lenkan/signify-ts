import libsodium from 'libsodium-wrappers-sumo';
import { Matter, MatterArgs, MtrDex } from './matter';
import secp256r1 from 'ecdsa-secp256r1';

type VerifyFunction = (
    sig: Uint8Array,
    ser: string | Uint8Array,
    key: Uint8Array
) => boolean;

/**
 * @description  Verfer: subclass of Matter, helps to verify signature of serialization
 *  using .raw as verifier key and .code as signature cypher suite
 */
export class Verfer extends Matter {
    private readonly _verify: VerifyFunction;

    constructor({ raw, code, qb64, qb64b, qb2 }: MatterArgs) {
        super({ raw, code, qb64, qb64b, qb2 });

        switch (this.code) {
            case MtrDex.Ed25519N:
            case MtrDex.Ed25519:
                this._verify = this._ed25519;
                break;
            case MtrDex.ECDSA_256r1N:
            case MtrDex.ECDSA_256r1:
                this._verify = this._secp256r1;
                break;
            default:
                throw new Error(
                    `Unsupported code = ${this.code} for verifier.`
                );
        }
    }

    verify(sig: Uint8Array, ser: string | Uint8Array): boolean {
        return this._verify(sig, ser, this.raw);
    }

    _ed25519: VerifyFunction = (sig, ser, key) => {
        try {
            return libsodium.crypto_sign_verify_detached(sig, ser, key);
        } catch (error) {
            throw new Error(error as string);
        }
    };

    _secp256r1: VerifyFunction = (sig, ser, key) => {
        try {
            const publicKey = secp256r1.fromCompressedPublicKey(key);
            return publicKey.verify(ser, sig);
        } catch (error) {
            throw new Error(error as string);
        }
    };
}
