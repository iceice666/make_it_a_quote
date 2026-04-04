declare module '@resvg/resvg-js' {
  export class Resvg {
    constructor(svg: string | Uint8Array, options?: unknown);
    imagesToResolve(): string[];
    resolveImage(href: string, buffer: Buffer | Uint8Array): void;
    render(): {
      asPng(): Buffer;
    };
  }
}
