declare module '@resvg/resvg-js' {
  export class Resvg {
    constructor(svg: string | Uint8Array, options?: unknown);
    render(): {
      asPng(): Buffer;
    };
  }
}
