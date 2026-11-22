const fs = require("node:fs");
const keys = require("./key.json");
function grade(answers) {
  if (!Array.isArray(answers) || answers.length !== keys.length) throw Error("Bài làm không hợp lệ");
  const points = keys.map((key,i) => {
    const value = String(answers[i] ?? "").trim();
    if (i>=18 && i<22) {
      const count = [...key].filter((v,j)=>v===value[j]).length;
      return [0,.1,.25,.5,1][count];
    }
    if (i>=22 && /^[-+]?\d+(?:[.,]\d+)?$/.test(value))
      return Number(value.replace(",","."))===Number(key.replace(",",".")) ? .25 : 0;
    return key===value ? .25 : 0;
  });
  return {points,total:Number(points.reduce((a,b)=>a+b,0).toFixed(2)),keys};
}
module.exports={grade};
