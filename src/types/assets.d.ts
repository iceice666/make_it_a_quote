declare module '*.otf' {
  const value: ArrayBuffer;
  export default value;
}

declare module '*.wasm' {
  const value: ArrayBuffer | string;
  export default value;
}
