const {spawnSync}=require('node:child_process');
const build=spawnSync(process.execPath,['scripts/build-client.cjs'],{stdio:'inherit',env:{...process.env,GENERATE_SOURCEMAP:'false'}});
if(build.status!==0)process.exit(build.status||1);
// Vercel serves build/ and its api/ functions directly; a Cloudflare Worker is optional.
if(process.argv.includes('--sites')){
 const worker=spawnSync(process.execPath,['scripts/build-worker.mjs'],{stdio:'inherit'});
 process.exit(worker.status||0);
}
