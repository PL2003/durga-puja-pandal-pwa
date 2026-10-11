/** Ambient types layered over the `open-location-code` package (in case it ships no d.ts). */
declare module "open-location-code" {
  export interface CodeArea {
    code: string;
    codeLength: number;
    latitudeLo: number;
    latitudeHi: number;
    longitudeLo: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
  }
  export class OpenLocationCode {
    static encode(latitude: number, longitude: number, codeLength?: number): string;
    static decode(code: string): CodeArea;
    static isValid(code: string): boolean;
    static isShort(code: string): boolean;
    static isFull(code: string): boolean;
    static shorten(code: string, latitude: number, longitude: number): string;
    static recoverNearest(shortCode: string, referenceLatitude: number, referenceLongitude: number): string;
  }
}
