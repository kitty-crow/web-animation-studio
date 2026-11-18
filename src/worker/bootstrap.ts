interface FactoryOptions {
 wasmBinary?: Uint8Array; locateFile?: (path: string)=>string;
 printErr?: (message: unknown)=>void; onAbort?: (reason: unknown)=>void;
 instantiateWasm?: (imports: WebAssembly.Imports,receive: (instance: WebAssembly.Instance,module: WebAssembly.Module)=>void)=>WebAssembly.Exports;
}
type Factory = (options: FactoryOptions)=>Promise<unknown>;
const parameters = new URL(import.meta.url).searchParams;
function required(key: string): string {
 const value=parameters.get(key);
 if(!value) throw Error('Missing runtime bootstrap parameter: '+key);
 return value;
}
const loader=required('loader'), wasm=required('wasm'), backend=required('backend');
function log(message: string): void {
 postMessage({type:'runtime-diagnostic',message:backend.toUpperCase()+' · '+message});
}
export default async function bootstrap(config: FactoryOptions = {}): Promise<unknown> {
 const {default:factory}=await import(loader) as {default:Factory};
 log('Emscripten loader entered; reading local WASM bytes');
 const response=await fetch(wasm);
 if(!response.ok)throw Error('Local WASM Blob read failed: '+response.status);
 const binary=new Uint8Array(await response.arrayBuffer());
 log('Compiling native WebAssembly module ('+binary.byteLength+' bytes)');
 const compiled=await WebAssembly.compile(binary);
 log('Native WebAssembly compilation succeeded; starting Emscripten factory');
 let rejectFailure: (error: Error)=>void=()=>undefined;
 const failure=new Promise<never>((_,reject)=>{rejectFailure=reject});
 const options: FactoryOptions={...config,wasmBinary:binary,locateFile:()=>wasm,
  printErr:message=>{log('Emscripten stderr: '+String(message));config.printErr?.(message)},
  onAbort:reason=>{const error=Error('Emscripten abort: '+String(reason));log(error.message);rejectFailure(error);config.onAbort?.(reason)},
  instantiateWasm:(imports,receive)=>{
   try {
    log('Instantiating precompiled WASM module');
    const instance=new WebAssembly.Instance(compiled,imports);
    receive(instance,compiled);
    log('Native WASM instantiation succeeded');
    return instance.exports;
   } catch(error) {
    const cause=error instanceof Error?error:Error(String(error));
    log('Native WASM instantiation failed: '+cause.message);
    rejectFailure(cause);throw cause;
   }
  }
 };
 const instance=await Promise.race([failure,Promise.resolve().then(()=>factory(options))]);
 log('Emscripten factory completed');return instance;
}
