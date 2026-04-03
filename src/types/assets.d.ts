declare module '*.otf' {
  const value: ArrayBuffer;
  export default value;
}

declare module '*.wasm' {
  const value: ArrayBuffer | WebAssembly.Module | string;
  export default value;
}
