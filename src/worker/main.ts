import { type WorkerRequest, errorText } from '../types';
import { scope, reply } from './progress';
import { parseGIF } from './decode';
import { convert } from './convert';
scope.onmessage=async (event: MessageEvent<WorkerRequest>)=>{
 try {
  const message=event.data;
  const bytes=new Uint8Array(message.buffer);
  if(message.type==='inspect'){reply({type:'info',meta:parseGIF(bytes,false)});return}
  await convert(bytes,message.settings,message.model,message.runtimeFiles);
 }catch(error){reply({type:'error',message:errorText(error)})}
};
