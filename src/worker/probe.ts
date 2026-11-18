import type { InferenceSession, Tensor } from 'onnxruntime-web';
import type { Ort, Report } from './ort';
import { runtimeProbeModel } from './runtime';
export async function probeRuntime(ort: Ort,options: InferenceSession.SessionOptions,bootstrapFailure: Promise<never>,report: Report): Promise<void> {
 report('runtime probe session','Initialising tiny ONNX test session…',31,'Separates runtime / backend startup from RVM graph loading. Startup watchdog: 120 seconds.');
   const probeStart=performance.now();let probe: InferenceSession | null=null,probeInput: Tensor | null=null,probeOutput: InferenceSession.ReturnType | null=null;
   try{
    probe=await Promise.race([ort.InferenceSession.create(runtimeProbeModel(),options),bootstrapFailure]);
    report('runtime probe inference','Running tiny ONNX test inference…',32,'Test graph created in '+((performance.now()-probeStart)/1000).toFixed(2)+'s');
    probeInput=new ort.Tensor('float32',new Float32Array([2]),[1]);
    probeOutput=await probe.run({x:probeInput});const check=await probeOutput.y.getData() as Float32Array;if(check.length!==1||Math.abs(check[0]-2)>1e-6)throw Error('ONNX runtime test produced an incorrect result.');
    report('runtime probe cleanup','Releasing test session…',32,'Runtime test passed; releasing test resources.');
   }finally{try{probeInput?.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}if(probeOutput)for(const t of Object.values(probeOutput)){try{t.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}}if(probe)await probe.release()}

}
