// Keep build caches inside the checkout even when dependencies are shared read-only.
process.env.NODE_ENV='production';
process.env.DISABLE_ESLINT_PLUGIN='true';
const path=require('node:path');
const paths=require('react-scripts/config/paths');
paths.appWebpackCache=path.resolve('.cache/webpack');
paths.appTsBuildInfoFile=path.resolve('.cache/tsconfig.tsbuildinfo');
const configPath=require.resolve('react-scripts/config/webpack.config');
const configFactory=require(configPath);
require.cache[configPath].exports=(...args)=>{
 const config=configFactory(...args);
 function patch(rules){for(const rule of rules||[]){if(rule.options&&'cacheDirectory' in rule.options)rule.options.cacheDirectory=false;if(rule.oneOf)patch(rule.oneOf);if(rule.rules)patch(rule.rules);}}
 patch(config.module.rules);return config;
};
require('react-scripts/scripts/build');
