exports.handler=(event,context)=>{
 if(context)context.callbackWaitsForEmptyEventLoop=false;
 return require("../../api.cjs").handle(event);
};
